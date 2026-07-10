-- ============================================
-- ENABLE AUTO-EXPIRY OF UNPAID BOOKINGS
-- ============================================
-- Run this in the Supabase SQL Editor. Requires the pg_cron extension
-- (Supabase → Database → Extensions → enable "pg_cron").
--
-- WHY
-- A PENDING_PAYMENT booking reserves seats. Without this job, an abandoned
-- checkout holds its seats indefinitely, and an unauthenticated caller can
-- exhaust a class or event's capacity for free by creating bookings and never
-- paying.
--
-- DEFENCE IN DEPTH
-- The authoritative fix lives in netlify/functions/helpers/bookingHold.ts:
-- capacity queries ignore PENDING_PAYMENT bookings whose hold_expires_at has
-- passed, so inventory is correct even if this job never runs. This job keeps
-- the persisted `status` column honest for admin views, dashboard stats, and
-- the duplicate/resume check, and sweeps rows that no booking request happens
-- to touch.
--
-- IMPORTANT
-- Expire on `hold_expires_at`, never on `created_at + 5 minutes`. The hold is
-- an extendable deadline: a resume-payment link grants RESUME_HOLD_MS, and
-- opening checkout tops the hold up so it outlasts the Razorpay checkout
-- `timeout`. A created_at-based sweep would expire those bookings out from
-- under an open checkout modal — capturing a payment against seats it had just
-- released, which is exactly the bug this column was added to fix.
--
-- Requires prisma/migrations/add_booking_hold_expires_at.sql to have been run.

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Idempotent: drop any previous schedule before re-creating it.
SELECT cron.unschedule('expire-unpaid-bookings')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-unpaid-bookings');

-- The single-statement CTE flips PENDING_PAYMENT -> EXPIRED and writes ONE
-- status_history row per booking in the same transaction, using
-- UPDATE ... RETURNING so only rows expired in THIS run get an audit entry
-- (no duplicate history rows across overlapping runs).
SELECT cron.schedule(
  'expire-unpaid-bookings',
  '* * * * *',
  $$
    WITH expired AS (
      UPDATE bookings
      SET status = 'EXPIRED',
          cancelled_at = NOW(),
          cancel_reason = 'Auto-expired: payment not completed within the hold window'
      WHERE status = 'PENDING_PAYMENT'
        AND deleted_at IS NULL
        AND (
          hold_expires_at <= NOW()
          -- Legacy rows written before hold_expires_at existed.
          OR (hold_expires_at IS NULL AND created_at < NOW() - INTERVAL '5 minutes')
        )
      RETURNING id
    )
    INSERT INTO status_history (id, booking_id, from_status, to_status, changed_by, reason, created_at)
    SELECT
      gen_random_uuid()::text,
      id,
      'PENDING_PAYMENT',
      'EXPIRED',
      'SYSTEM',
      'Auto-expired: payment not completed within the hold window',
      NOW()
    FROM expired;
  $$
);

-- Supports the WHERE clause above.
CREATE INDEX IF NOT EXISTS idx_booking_pending_hold_expiry
  ON bookings(hold_expires_at)
  WHERE status = 'PENDING_PAYMENT';

-- Verify: should list one active job.
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'expire-unpaid-bookings';
