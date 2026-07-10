-- ============================================
-- EXPLICIT SEAT-HOLD DEADLINE ON BOOKINGS
-- ============================================
-- Additive + idempotent so it can be run against production without a reset.
--
-- WHY
-- The hold deadline used to be derived as `created_at + BOOKING_HOLD_MS`
-- (5 minutes). That is only correct when checkout opens immediately after the
-- booking is created. It is wrong for the resume-payment link, which is emailed
-- against an already-aging booking: by the time the mail is delivered, read and
-- clicked, the 5 minutes are gone. The link either 400s ("This booking has
-- expired") or — worse — lets Razorpay checkout open with seconds of hold left,
-- so the booking flips to EXPIRED underneath an open checkout modal and any
-- capture becomes an unconfirmable charge that must be refunded.
--
-- Making the deadline an absolute, stored instant lets it be EXTENDED: when a
-- resume link is issued, and again when checkout is opened, so the hold always
-- outlives the Razorpay checkout `timeout`.
--
-- BACKFILL
-- Existing rows keep their old semantics exactly: created_at + 5 minutes.
-- SPACE bookings reserve no seats, so their hold stays NULL.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS hold_expires_at timestamptz(3);

UPDATE bookings
SET hold_expires_at = created_at + INTERVAL '5 minutes'
WHERE hold_expires_at IS NULL
  AND type <> 'SPACE';

-- Supports the capacity read path (occupiesSeatWhere) and the expiry sweep,
-- both of which filter on status + hold_expires_at.
CREATE INDEX IF NOT EXISTS bookings_status_hold_expires_at_idx
  ON bookings(status, hold_expires_at);

-- Partial index for the pg_cron expiry job. Replaces the created_at-based one
-- from migration-v2.sql / enable_booking_expiry_cron.sql, which no longer
-- matches the job's WHERE clause.
CREATE INDEX IF NOT EXISTS idx_booking_pending_hold_expiry
  ON bookings(hold_expires_at)
  WHERE status = 'PENDING_PAYMENT';

-- Verify: no unpaid booking should be left without a deadline.
--   SELECT count(*) FROM bookings
--   WHERE status = 'PENDING_PAYMENT' AND hold_expires_at IS NULL;
