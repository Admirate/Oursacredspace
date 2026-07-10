jest.mock("../netlify/functions/helpers/prisma", () =>
  require("./__mocks__/prisma")
);

jest.mock("../netlify/functions/helpers/logger", () => ({
  withSentry: (_name: string, fn: any) => fn,
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), payment: jest.fn() },
}));

import {
  BOOKING_HOLD_MS,
  RESUME_HOLD_MS,
  CHECKOUT_TIMEOUT_MS,
  MIN_CHECKOUT_WINDOW_MS,
  ABSOLUTE_HOLD_CEILING_MS,
  holdCutoff,
  holdHasExpired,
  newHoldExpiry,
  occupiesSeatWhere,
  expireStaleHolds,
  lockResourceForBooking,
  ensureCheckoutWindow,
  refreshHoldForResume,
} from "../netlify/functions/helpers/bookingHold";
import { prisma } from "./__mocks__/prisma";
import { logger } from "../netlify/functions/helpers/logger";

const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000);
const msFromNow = (ms: number) => new Date(Date.now() + ms);

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.$transaction as jest.Mock).mockImplementation((fn: any) => fn(prisma));
  (prisma.booking.findMany as jest.Mock).mockResolvedValue([]);
  (prisma.booking.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
});

describe("hold window invariant", () => {
  // If the hold could lapse before checkout closes, Razorpay could capture a
  // payment against seats we already released. This is the load-bearing
  // constraint behind the whole design; assert it rather than trusting a comment.
  it("reserves more than the Razorpay checkout timeout for a fresh booking", () => {
    expect(BOOKING_HOLD_MS).toBeGreaterThan(CHECKOUT_TIMEOUT_MS);
  });

  it("requires a checkout window strictly larger than the checkout timeout", () => {
    expect(MIN_CHECKOUT_WINDOW_MS).toBeGreaterThan(CHECKOUT_TIMEOUT_MS);
  });

  // ensureCheckoutWindow tops a hold up to BOOKING_HOLD_MS. That top-up is
  // useless unless a full hold clears the window it is meant to guarantee.
  it("can always satisfy the checkout window by granting a full hold", () => {
    expect(BOOKING_HOLD_MS).toBeGreaterThanOrEqual(MIN_CHECKOUT_WINDOW_MS);
  });

  it("gives an emailed resume link far longer than a fresh booking", () => {
    expect(RESUME_HOLD_MS).toBeGreaterThan(BOOKING_HOLD_MS);
    expect(ABSOLUTE_HOLD_CEILING_MS).toBeGreaterThan(RESUME_HOLD_MS);
  });
});

describe("holdHasExpired", () => {
  it("is false while the stored deadline is in the future", () => {
    expect(
      holdHasExpired({ createdAt: new Date(), holdExpiresAt: msFromNow(60_000) })
    ).toBe(false);
  });

  it("is true once the stored deadline has passed", () => {
    expect(
      holdHasExpired({ createdAt: minutesAgo(20), holdExpiresAt: msFromNow(-1000) })
    ).toBe(true);
  });

  // The regression this column exists to prevent: a booking reached via an
  // emailed resume link is old but its hold was refreshed, so it is still live.
  // Deriving the deadline from createdAt declared these dead on arrival.
  it("is false for an old booking whose hold was extended", () => {
    expect(
      holdHasExpired({ createdAt: minutesAgo(25), holdExpiresAt: msFromNow(RESUME_HOLD_MS) })
    ).toBe(false);
  });

  describe("legacy rows written before holdExpiresAt existed", () => {
    it("falls back to createdAt + BOOKING_HOLD_MS (inside the window)", () => {
      const createdAt = new Date(Date.now() - (BOOKING_HOLD_MS - 5000));
      expect(holdHasExpired({ createdAt, holdExpiresAt: null })).toBe(false);
    });

    it("falls back to createdAt + BOOKING_HOLD_MS (outside the window)", () => {
      const createdAt = new Date(Date.now() - (BOOKING_HOLD_MS + 5000));
      expect(holdHasExpired({ createdAt, holdExpiresAt: null })).toBe(true);
    });
  });
});

describe("newHoldExpiry", () => {
  it("defaults to BOOKING_HOLD_MS from now", () => {
    const delta = newHoldExpiry().getTime() - Date.now();
    expect(delta).toBeGreaterThan(BOOKING_HOLD_MS - 1000);
    expect(delta).toBeLessThanOrEqual(BOOKING_HOLD_MS);
  });

  it("honours an explicit window", () => {
    const delta = newHoldExpiry(RESUME_HOLD_MS).getTime() - Date.now();
    expect(delta).toBeGreaterThan(RESUME_HOLD_MS - 1000);
  });
});

describe("ensureCheckoutWindow", () => {
  const live = () => ({
    id: "bkg-1",
    createdAt: minutesAgo(1),
    holdExpiresAt: msFromNow(10_000), // live, but nowhere near enough for checkout
  });

  it("extends a hold that is too short to outlast the checkout modal", async () => {
    const granted = await ensureCheckoutWindow(live());

    expect(granted).not.toBeNull();
    expect(granted!.getTime()).toBeGreaterThanOrEqual(Date.now() + MIN_CHECKOUT_WINDOW_MS);

    const arg = (prisma.booking.updateMany as jest.Mock).mock.calls[0][0];
    expect(arg.where).toMatchObject({ id: "bkg-1", status: "PENDING_PAYMENT" });
    expect(arg.data.holdExpiresAt).toBeInstanceOf(Date);
  });

  it("leaves an already-sufficient hold untouched", async () => {
    const granted = await ensureCheckoutWindow({
      id: "bkg-1",
      createdAt: minutesAgo(1),
      holdExpiresAt: msFromNow(RESUME_HOLD_MS),
    });

    expect(granted).not.toBeNull();
    // No write: shortening or churning a healthy hold buys nothing.
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  // Reviving a lapsed hold would re-take a seat that is back in inventory and
  // may already have been sold to someone else.
  it("refuses to revive a hold that already lapsed", async () => {
    const granted = await ensureCheckoutWindow({
      id: "bkg-1",
      createdAt: minutesAgo(30),
      holdExpiresAt: msFromNow(-1000),
    });

    expect(granted).toBeNull();
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it("refuses once the absolute ceiling leaves too little room for checkout", async () => {
    const granted = await ensureCheckoutWindow({
      id: "bkg-1",
      // Ceiling is createdAt + ABSOLUTE_HOLD_CEILING_MS, which is ~10s away:
      // not enough for a full checkout window, so no order may be created.
      createdAt: new Date(Date.now() - (ABSOLUTE_HOLD_CEILING_MS - 10_000)),
      holdExpiresAt: msFromNow(5_000),
    });

    expect(granted).toBeNull();
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  // A booking confirmed or expired between our read and the write must not be
  // resurrected: updateMany re-checks status under the row lock and matches 0.
  it("returns null when the guarded update matches no row", async () => {
    (prisma.booking.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

    expect(await ensureCheckoutWindow(live())).toBeNull();
  });
});

describe("refreshHoldForResume", () => {
  it("grants the long resume window to a live booking", async () => {
    const granted = await refreshHoldForResume({
      id: "bkg-1",
      createdAt: minutesAgo(4),
      holdExpiresAt: msFromNow(30_000),
    });

    expect(granted).not.toBeNull();
    // Comfortably longer than the 5-minute window an emailed link used to race.
    expect(granted!.getTime()).toBeGreaterThan(Date.now() + BOOKING_HOLD_MS);
  });

  it("never revives a booking whose hold already lapsed", async () => {
    const granted = await refreshHoldForResume({
      id: "bkg-1",
      createdAt: minutesAgo(30),
      holdExpiresAt: msFromNow(-1),
    });

    expect(granted).toBeNull();
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
  });

  it("clamps the new deadline to the absolute ceiling", async () => {
    const createdAt = new Date(Date.now() - (ABSOLUTE_HOLD_CEILING_MS - 2 * 60 * 1000));
    const granted = await refreshHoldForResume({
      id: "bkg-1",
      createdAt,
      holdExpiresAt: msFromNow(60_000),
    });

    expect(granted).not.toBeNull();
    expect(granted!.getTime()).toBeLessThanOrEqual(
      createdAt.getTime() + ABSOLUTE_HOLD_CEILING_MS
    );
  });
});

describe("lockResourceForBooking", () => {
  const tx = () => ({ $queryRaw: jest.fn().mockResolvedValue([]) }) as any;

  it("takes a row lock on the class row for a CLASS booking", async () => {
    const t = tx();
    await lockResourceForBooking(t, { classSessionId: "cls-1" });

    expect(t.$queryRaw).toHaveBeenCalledTimes(1);
    // Tagged-template call: [strings, ...values]. Assert it's a FOR UPDATE on
    // class_sessions and that the id is a bound parameter (not interpolated).
    const [strings, id] = t.$queryRaw.mock.calls[0];
    const sql = strings.join("?");
    expect(sql).toMatch(/class_sessions/);
    expect(sql).toMatch(/FOR UPDATE/);
    expect(id).toBe("cls-1");
  });

  it("takes a row lock on the event row for an EVENT booking", async () => {
    const t = tx();
    await lockResourceForBooking(t, { eventId: "evt-1" });

    const [strings, id] = t.$queryRaw.mock.calls[0];
    const sql = strings.join("?");
    expect(sql).toMatch(/events/);
    expect(sql).toMatch(/FOR UPDATE/);
    expect(id).toBe("evt-1");
  });

  it("is a no-op for a SPACE booking (no resource id)", async () => {
    const t = tx();
    await lockResourceForBooking(t, {});
    expect(t.$queryRaw).not.toHaveBeenCalled();
  });
});

describe("occupiesSeatWhere", () => {
  // The clause whose deadline lives on the row (the normal case).
  const storedClause = () =>
    occupiesSeatWhere().OR.find(
      (c: any) => c.status === "PENDING_PAYMENT" && c.holdExpiresAt?.gt
    ) as any;

  // The fallback clause for rows written before holdExpiresAt existed.
  const legacyClause = () =>
    occupiesSeatWhere().OR.find(
      (c: any) => c.status === "PENDING_PAYMENT" && c.holdExpiresAt === null
    ) as any;

  it("counts CONFIRMED bookings regardless of age", () => {
    expect(occupiesSeatWhere().OR).toContainEqual({ status: "CONFIRMED" });
  });

  it("counts unpaid bookings whose stored deadline has not passed", () => {
    const before = Date.now();
    const clause = storedClause();

    expect(clause).toBeDefined();
    // Compared against NOW, not against createdAt — that is the whole point.
    const gt = clause.holdExpiresAt.gt.getTime();
    expect(gt).toBeGreaterThanOrEqual(before - 1000);
    expect(gt).toBeLessThanOrEqual(Date.now() + 1000);
  });

  // Without this clause a legacy row would match nothing, silently stop
  // occupying its seat, and let us overbook.
  it("still honours legacy rows via createdAt + BOOKING_HOLD_MS", () => {
    const clause = legacyClause();

    expect(clause).toBeDefined();
    const cutoff = clause.createdAt.gte.getTime();
    expect(cutoff).toBeLessThanOrEqual(Date.now() - BOOKING_HOLD_MS + 1000);
    expect(cutoff).toBeGreaterThanOrEqual(Date.now() - BOOKING_HOLD_MS - 1000);
  });

  it("excludes soft-deleted bookings", () => {
    expect(occupiesSeatWhere().deletedAt).toBeNull();
  });

  it("recomputes the deadline on each call rather than freezing at import", () => {
    const first = storedClause().holdExpiresAt.gt.getTime();
    jest.spyOn(Date, "now").mockReturnValue(Date.now() + 60_000);
    const second = storedClause().holdExpiresAt.gt.getTime();
    (Date.now as jest.Mock).mockRestore();

    expect(second).toBeGreaterThan(first);
  });
});

describe("expireStaleHolds", () => {
  it("does nothing when there is nothing stale", async () => {
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([]);

    const n = await expireStaleHolds({ classSessionId: "cls-1" });

    expect(n).toBe(0);
    expect(prisma.booking.updateMany).not.toHaveBeenCalled();
    expect(prisma.statusHistory.createMany).not.toHaveBeenCalled();
  });

  it("expires stale holds and writes one audit row per booking", async () => {
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([
      { id: "bkg-1" },
      { id: "bkg-2" },
    ]);

    const n = await expireStaleHolds({ classSessionId: "cls-1" });

    expect(n).toBe(2);
    expect(prisma.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "EXPIRED" }),
      })
    );
    const createManyArg = (prisma.statusHistory.createMany as jest.Mock).mock.calls[0][0];
    expect(createManyArg.data).toHaveLength(2);
    expect(createManyArg.data[0]).toMatchObject({
      bookingId: "bkg-1",
      fromStatus: "PENDING_PAYMENT",
      toStatus: "EXPIRED",
    });
  });

  it("only sweeps rows still PENDING_PAYMENT, so a concurrent payment is never clobbered", async () => {
    (prisma.booking.findMany as jest.Mock).mockResolvedValue([{ id: "bkg-1" }]);

    await expireStaleHolds({ eventId: "evt-1" });

    const updateArg = (prisma.booking.updateMany as jest.Mock).mock.calls[0][0];
    // Re-asserted in the WHERE clause: a booking confirmed between the read and
    // this write must not be flipped to EXPIRED.
    expect(updateArg.where.status).toBe("PENDING_PAYMENT");
  });

  it("selects only stale, non-deleted, unpaid bookings in the given scope", async () => {
    await expireStaleHolds({ classSessionId: "cls-9" });

    const where = (prisma.booking.findMany as jest.Mock).mock.calls[0][0].where;
    expect(where.status).toBe("PENDING_PAYMENT");
    expect(where.deletedAt).toBeNull();
    expect(where.classSessionId).toBe("cls-9");

    // Stale = stored deadline passed, or a legacy row past the old fixed window.
    const [stored, legacy] = where.OR;
    expect(stored.holdExpiresAt.lte.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
    expect(legacy.holdExpiresAt).toBeNull();
    expect(legacy.createdAt.lt.getTime()).toBeLessThanOrEqual(holdCutoff().getTime() + 1000);
  });

  // An extended hold (resume link, or a checkout top-up) must survive the sweep,
  // otherwise the sweep re-creates the bug the deadline column was added to fix.
  it("does not sweep a booking whose hold was extended into the future", async () => {
    await expireStaleHolds({ eventId: "evt-1" });

    const where = (prisma.booking.findMany as jest.Mock).mock.calls[0][0].where;
    const stillHeld = { holdExpiresAt: msFromNow(RESUME_HOLD_MS) };

    // The stored clause requires holdExpiresAt <= now; a future deadline fails it.
    expect(stillHeld.holdExpiresAt.getTime()).toBeGreaterThan(
      where.OR[0].holdExpiresAt.lte.getTime()
    );
  });

  // Capacity is already safe without the sweep, so a DB failure here must not
  // fail the caller's booking request.
  it("swallows database errors and reports zero swept", async () => {
    (prisma.booking.findMany as jest.Mock).mockRejectedValue(new Error("DB down"));

    await expect(expireStaleHolds({ classSessionId: "cls-1" })).resolves.toBe(0);
    expect(logger.error).toHaveBeenCalledWith(
      "expireStaleHolds failed",
      expect.any(Error),
      expect.anything()
    );
  });
});
