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
 * How long an unpaid booking may hold its seats.
 *
 * A PENDING_PAYMENT booking reserves inventory. Without a bound, an
 * unauthenticated caller can create bookings with `quantity: 10`, never pay,
 * and make a class or event read as fully booked forever — a free
 * denial-of-inventory attack. The rate limiter caps how fast that happens,
 * not whether it happens.
 *
 * INVARIANT: this window MUST stay strictly greater than the Razorpay
 * checkout `timeout` in src/hooks/usePayment.ts (currently 240s / 4 min).
 * If checkout could outlive the hold, a payment would capture against a
 * booking whose seats had already been released — charging the customer for
 * inventory we may have since sold to someone else. verifyPayment detects
 * that case and refuses to confirm (returning 409 + a refund alert), but the
 * customer is still out the money until the refund lands, so the window is
 * the primary defence and verifyPayment is the backstop.
 */
export const BOOKING_HOLD_MS = 5 * 60 * 1000;

/** Bookings created before this instant no longer hold their seats. */
export const holdCutoff = (): Date => new Date(Date.now() - BOOKING_HOLD_MS);

/**
 * Prisma `where` fragment matching bookings that currently occupy a seat:
 * anything CONFIRMED, plus unpaid bookings still inside their hold window.
 *
 * This is the authoritative capacity rule. It is correct even if the expiry
 * sweep below never runs, because it filters on `createdAt` at read time
 * rather than trusting the persisted status.
 */
export const occupiesSeatWhere = () => ({
  deletedAt: null,
  OR: [
    { status: BookingStatus.CONFIRMED },
    {
      status: BookingStatus.PENDING_PAYMENT,
      createdAt: { gte: holdCutoff() },
    },
  ],
});

/** True when an unpaid booking has outlived its hold and must not be resumed or paid. */
export const holdHasExpired = (createdAt: Date): boolean =>
  createdAt.getTime() < holdCutoff().getTime();

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
  const cutoff = holdCutoff();

  try {
    const stale = await prisma.booking.findMany({
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        createdAt: { lt: cutoff },
        deletedAt: null,
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
          reason: `Auto-expired: payment not completed within ${BOOKING_HOLD_MS / 60000} minutes`,
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
