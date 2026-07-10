import { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { logger } from "./logger";

/**
 * Serialize concurrent bookings for a single class/event inside a transaction.
 *
 * The in-transaction capacity re-check is an aggregate READ. Under Postgres's
 * default READ COMMITTED isolation a plain read takes no lock, so two requests
 * racing for the last seat both read the same pre-commit count, both pass, and
 * the resource is overbooked.
 *
 * We take a row-level `SELECT ... FOR UPDATE` on the resource's own row (the
 * "SELECT FOR UPDATE" the original code only claimed to do). Every booking for
 * that resource must acquire the same row lock, so they run one at a time —
 * the loser blocks until the winner commits, then its aggregate re-reads a
 * snapshot that includes the winner's new booking. Bookings for other
 * resources are unaffected. The lock releases at transaction end.
 *
 * A row lock (unlike a session-scoped advisory lock) is fully compatible with
 * Supabase's PgBouncer transaction-mode pooler, since it lives and dies within
 * the pinned transaction.
 */
export const lockResourceForBooking = async (
  tx: Prisma.TransactionClient,
  resource: { classSessionId?: string; eventId?: string }
): Promise<void> => {
  // Table names are hard-coded per branch (never interpolated from input); the
  // id is a bound parameter. FOR UPDATE on a non-existent id simply locks zero
  // rows — existence is enforced elsewhere.
  if (resource.classSessionId) {
    await tx.$queryRaw`SELECT id FROM class_sessions WHERE id = ${resource.classSessionId} FOR UPDATE`;
  } else if (resource.eventId) {
    await tx.$queryRaw`SELECT id FROM events WHERE id = ${resource.eventId} FOR UPDATE`;
  }
};

/**
 * How long a freshly created unpaid booking holds its seats.
 *
 * A PENDING_PAYMENT booking reserves inventory. Without a bound, an
 * unauthenticated caller can create bookings with `quantity: 10`, never pay,
 * and make a class or event read as fully booked forever — a free
 * denial-of-inventory attack. The rate limiter caps how fast that happens,
 * not whether it happens.
 *
 * INVARIANT: the REMAINING hold at the moment checkout opens MUST exceed the
 * Razorpay checkout `timeout` in src/hooks/usePayment.ts (240s / 4 min).
 * Otherwise a payment can capture against a booking whose seats were already
 * released — charging the customer for inventory we may have since resold.
 * verifyPayment detects that and refuses to confirm (409 + refund alert), but
 * the customer is out the money until the refund lands, so the window is the
 * primary defence and verifyPayment is the backstop.
 *
 * Note "remaining", not "total". This constant alone does NOT satisfy the
 * invariant: a booking is 5 minutes old the instant its hold lapses, and the
 * resume-payment link is by definition opened on an aging booking. The
 * deadline is therefore stored on the row (`Booking.holdExpiresAt`) and
 * extended by `ensureCheckoutWindow` before checkout is allowed to open.
 */
export const BOOKING_HOLD_MS = 5 * 60 * 1000;

/**
 * Hold granted when a resume-payment link is emailed. Much longer than
 * BOOKING_HOLD_MS because the customer has to receive the mail, notice it, and
 * open it — none of which fits inside 5 minutes.
 */
export const RESUME_HOLD_MS = 30 * 60 * 1000;

/** Mirrors the Razorpay checkout `timeout` in src/hooks/usePayment.ts. */
export const CHECKOUT_TIMEOUT_MS = 240 * 1000;

/**
 * The hold must outlast the checkout modal with room for clock skew and the
 * round trip that opens it.
 */
export const MIN_CHECKOUT_WINDOW_MS = CHECKOUT_TIMEOUT_MS + 30 * 1000;

/**
 * Absolute ceiling on how far a hold may be pushed out, measured from
 * `createdAt`. Each extension is legitimate on its own, but without a ceiling
 * a caller holding a valid accessToken could refresh forever and squat on a
 * seat they never pay for.
 */
export const ABSOLUTE_HOLD_CEILING_MS = 60 * 60 * 1000;

/** Legacy fallback cutoff: rows predating `holdExpiresAt` behave as before. */
export const holdCutoff = (): Date => new Date(Date.now() - BOOKING_HOLD_MS);

/** A booking's seat-hold deadline, whether stored or derived from a legacy row. */
type HeldBooking = { createdAt: Date; holdExpiresAt?: Date | null };

const effectiveHoldExpiry = (booking: HeldBooking): Date =>
  booking.holdExpiresAt ?? new Date(booking.createdAt.getTime() + BOOKING_HOLD_MS);

/** A fresh deadline `ms` from now. */
export const newHoldExpiry = (ms: number = BOOKING_HOLD_MS): Date =>
  new Date(Date.now() + ms);

/**
 * Prisma `where` fragment matching bookings that currently occupy a seat:
 * anything CONFIRMED, plus unpaid bookings still inside their hold window.
 *
 * This is the authoritative capacity rule. It is correct even if the expiry
 * sweep below never runs, because it compares the deadline against `now` at
 * read time rather than trusting the persisted status.
 *
 * The third clause covers rows written before `holdExpiresAt` existed. Without
 * it those bookings would match nothing, silently stop occupying their seats,
 * and let us overbook. The migration backfills them, so this is belt-and-braces.
 */
export const occupiesSeatWhere = () => ({
  deletedAt: null,
  OR: [
    { status: BookingStatus.CONFIRMED },
    {
      status: BookingStatus.PENDING_PAYMENT,
      // Read the clock via Date.now() (not `new Date()`) so the deadline is
      // recomputed per call and stays consistent with holdHasExpired.
      holdExpiresAt: { gt: new Date(Date.now()) },
    },
    {
      status: BookingStatus.PENDING_PAYMENT,
      holdExpiresAt: null,
      createdAt: { gte: holdCutoff() },
    },
  ],
});

/** True when an unpaid booking has outlived its hold and must not be resumed or paid. */
export const holdHasExpired = (booking: HeldBooking): boolean =>
  effectiveHoldExpiry(booking).getTime() <= Date.now();

/**
 * Flip unpaid bookings whose hold has lapsed to EXPIRED, with an audit row.
 *
 * `occupiesSeatWhere` already prevents these rows from consuming inventory;
 * this sweep exists so the persisted state matches reality — admin views,
 * the duplicate/resume check, and dashboard stats all read `status` directly.
 *
 * Best-effort and scoped to the resource being booked, so it stays cheap. A
 * failure here must never fail the caller's request: capacity is already safe
 * without it.
 */
export const expireStaleHolds = async (scope: {
  classSessionId?: string;
  eventId?: string;
}): Promise<number> => {
  const now = new Date(Date.now());
  const cutoff = holdCutoff();

  try {
    const stale = await prisma.booking.findMany({
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        deletedAt: null,
        // Mirror of occupiesSeatWhere's unpaid clauses, negated: a row is stale
        // once its stored deadline has passed, or — for legacy rows with no
        // deadline — once it is older than the original fixed window.
        OR: [
          { holdExpiresAt: { lte: now } },
          { holdExpiresAt: null, createdAt: { lt: cutoff } },
        ],
        ...scope,
      },
      select: { id: true },
      take: 500,
    });

    if (stale.length === 0) return 0;
    const ids = stale.map((b) => b.id);

    await prisma.$transaction(async (tx) => {
      // Re-assert the status in the WHERE clause: a concurrent verifyPayment
      // or webhook may have confirmed one of these between the read above and
      // this write, and a confirmed booking must never be expired out from
      // under a customer who paid.
      await tx.booking.updateMany({
        where: { id: { in: ids }, status: BookingStatus.PENDING_PAYMENT },
        data: {
          status: BookingStatus.EXPIRED,
          cancelledAt: new Date(),
          cancelReason: "Auto-expired: payment not completed within the hold window",
        },
      });

      await tx.statusHistory.createMany({
        data: ids.map((id) => ({
          bookingId: id,
          fromStatus: BookingStatus.PENDING_PAYMENT,
          toStatus: BookingStatus.EXPIRED,
          changedBy: "SYSTEM",
          reason: "Auto-expired: payment not completed within the hold window",
        })),
      });
    });

    logger.info("Expired stale booking holds", { count: ids.length, ...scope });
    return ids.length;
  } catch (error) {
    logger.error("expireStaleHolds failed", error, scope);
    return 0;
  }
};

/**
 * Push a live hold out to `now + ms`, bounded by ABSOLUTE_HOLD_CEILING_MS.
 *
 * SAFETY: extending a hold that has NOT lapsed never overbooks. The booking has
 * occupied its seat continuously since creation, so no capacity re-check is
 * needed — we are keeping a reservation, not taking a new one. Reviving a
 * LAPSED hold would be a different matter (the seat is back in inventory and
 * may already be sold), which is why every caller must reject an expired
 * booking first and why the guard below re-asserts it.
 *
 * The `updateMany ... WHERE status = PENDING_PAYMENT` re-evaluates the
 * predicate under a row lock, so a booking confirmed or expired concurrently
 * yields count 0 rather than being clobbered.
 *
 * Returns the new deadline, or null when the hold cannot be extended.
 */
const extendHold = async (
  booking: { id: string } & HeldBooking,
  ms: number
): Promise<Date | null> => {
  if (holdHasExpired(booking)) return null;

  const ceiling = booking.createdAt.getTime() + ABSOLUTE_HOLD_CEILING_MS;
  const target = Math.min(Date.now() + ms, ceiling);

  // Never shorten an existing hold (e.g. a 30-min resume hold followed by a
  // 5-min checkout top-up).
  const current = effectiveHoldExpiry(booking).getTime();
  if (current >= target) return new Date(current);

  const claimed = await prisma.booking.updateMany({
    where: { id: booking.id, status: BookingStatus.PENDING_PAYMENT, deletedAt: null },
    data: { holdExpiresAt: new Date(target) },
  });

  return claimed.count === 1 ? new Date(target) : null;
};

/**
 * Guarantee the hold outlives the checkout modal about to be opened.
 *
 * This is what makes the INVARIANT above true in practice. Called by
 * createRazorpayOrder immediately before an order is created, so the window is
 * measured from when checkout actually opens rather than from `createdAt`.
 *
 * Returns null when the booking cannot be given a full checkout window — either
 * its hold already lapsed, or it has hit ABSOLUTE_HOLD_CEILING_MS. Callers must
 * refuse to open checkout in that case: no money should move against a seat we
 * cannot promise to hold.
 */
export const ensureCheckoutWindow = async (
  booking: { id: string } & HeldBooking
): Promise<Date | null> => {
  if (holdHasExpired(booking)) return null;

  const required = Date.now() + MIN_CHECKOUT_WINDOW_MS;

  // Already comfortable — don't churn the row on every checkout open.
  const current = effectiveHoldExpiry(booking).getTime();
  if (current >= required) return new Date(current);

  // The ceiling would cap the extension below a usable checkout window, so no
  // amount of extending helps. Bail before writing anything.
  const ceiling = booking.createdAt.getTime() + ABSOLUTE_HOLD_CEILING_MS;
  if (ceiling < required) return null;

  const extended = await extendHold(booking, BOOKING_HOLD_MS);
  if (!extended) return null;
  return extended.getTime() >= required ? extended : null;
};

/**
 * Grant a booking the longer RESUME_HOLD_MS window because a resume-payment
 * link is being emailed to its owner. Without this the link races the original
 * 5-minute hold and is dead on arrival.
 */
export const refreshHoldForResume = async (
  booking: { id: string } & HeldBooking
): Promise<Date | null> => extendHold(booking, RESUME_HOLD_MS);
