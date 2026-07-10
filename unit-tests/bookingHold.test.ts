jest.mock("../netlify/functions/helpers/prisma", () =>
  require("./__mocks__/prisma")
);

jest.mock("../netlify/functions/helpers/logger", () => ({
  withSentry: (_name: string, fn: any) => fn,
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), payment: jest.fn() },
}));

import {
  BOOKING_HOLD_MS,
  holdCutoff,
  holdHasExpired,
  occupiesSeatWhere,
  expireStaleHolds,
  lockResourceForBooking,
} from "../netlify/functions/helpers/bookingHold";
import { prisma } from "./__mocks__/prisma";
import { logger } from "../netlify/functions/helpers/logger";

// Mirrors the Razorpay checkout `timeout` in src/hooks/usePayment.ts.
const CHECKOUT_TIMEOUT_MS = 240 * 1000;

const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000);

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.$transaction as jest.Mock).mockImplementation((fn: any) => fn(prisma));
  (prisma.booking.findMany as jest.Mock).mockResolvedValue([]);
});

describe("hold window invariant", () => {
  // If the hold could lapse before checkout closes, Razorpay could capture a
  // payment against seats we already released. This is the load-bearing
  // constraint behind the whole design; assert it rather than trusting a comment.
  it("outlives the Razorpay checkout timeout", () => {
    expect(BOOKING_HOLD_MS).toBeGreaterThan(CHECKOUT_TIMEOUT_MS);
  });
});

describe("holdHasExpired", () => {
  it("is false for a booking created just now", () => {
    expect(holdHasExpired(new Date())).toBe(false);
  });

  it("is false just inside the window", () => {
    expect(holdHasExpired(new Date(Date.now() - (BOOKING_HOLD_MS - 5000)))).toBe(false);
  });

  it("is true just outside the window", () => {
    expect(holdHasExpired(new Date(Date.now() - (BOOKING_HOLD_MS + 5000)))).toBe(true);
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
  it("counts CONFIRMED bookings regardless of age", () => {
    const where = occupiesSeatWhere();
    expect(where.OR).toContainEqual({ status: "CONFIRMED" });
  });

  it("counts unpaid bookings only inside the hold window", () => {
    const before = Date.now();
    const where = occupiesSeatWhere();
    const pending = where.OR.find((c: any) => c.status === "PENDING_PAYMENT") as any;

    expect(pending).toBeDefined();
    // The cutoff must be BOOKING_HOLD_MS in the past, not "any time".
    const cutoff = pending.createdAt.gte.getTime();
    expect(cutoff).toBeLessThanOrEqual(before - BOOKING_HOLD_MS + 50);
    expect(cutoff).toBeGreaterThanOrEqual(before - BOOKING_HOLD_MS - 1000);
  });

  it("excludes soft-deleted bookings", () => {
    expect(occupiesSeatWhere().deletedAt).toBeNull();
  });

  it("recomputes the cutoff on each call rather than freezing at import", () => {
    const first = (occupiesSeatWhere().OR[1] as any).createdAt.gte.getTime();
    const later = new Date(Date.now() + 60_000);
    jest.spyOn(Date, "now").mockReturnValue(later.getTime());
    const second = (occupiesSeatWhere().OR[1] as any).createdAt.gte.getTime();
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
    expect(where.createdAt.lt.getTime()).toBeLessThanOrEqual(
      holdCutoff().getTime() + 1000
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
