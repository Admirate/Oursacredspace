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
-- capacity queries ignore PENDING_PAYMENT bookings older than BOOKING_HOLD_MS
-- at read time, so inventory is correct even if this job never runs. This job
-- keeps the persisted `status` column honest for admin views, dashboard stats,
-- and the duplicate/resume check, and sweeps rows that no booking request
-- happens to touch.
--
-- INVARIANT
-- Keep this window (5 minutes) in lockstep with BOOKING_HOLD_MS, and strictly
-- GREATER than the Razorpay checkout `timeout` in src/hooks/usePayment.ts
-- (currently 240s / 4 min). If checkout could outlive the hold, a payment
-- would capture against a booking whose seats were already released.

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
        AND created_at < NOW() - INTERVAL '5 minutes'
        AND deleted_at IS NULL
      RETURNING id
    )
    INSERT INTO status_history (id, booking_id, from_status, to_status, changed_by, reason, created_at)
    SELECT
      gen_random_uuid()::text,
      id,
      'PENDING_PAYMENT',
      'EXPIRED',
      'SYSTEM',
      'Auto-expired: payment not completed within 5 minutes',
      NOW()
    FROM expired;
  $$
);

-- Supports the WHERE clause above. Present already if migration-v2.sql ran.
CREATE INDEX IF NOT EXISTS idx_booking_pending_expiry
  ON bookings(created_at)
  WHERE status = 'PENDING_PAYMENT';

-- Verify: should list one active job.
-- SELECT jobname, schedule, active FROM cron.job WHERE jobname = 'expire-unpaid-bookings';
