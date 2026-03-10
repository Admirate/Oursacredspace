-- ============================================
-- OSS BOOKING SYSTEM — DATABASE MIGRATION V2
-- ============================================
-- Run this SQL in Supabase SQL Editor AFTER running prisma db push.
-- This migration is SAFE — it preserves all existing data.
--
-- Changes:
--   Phase 1: CHECK constraints, booking integrity trigger, partial indexes
--   Phase 2: timestamp → timestamptz, payment_expires_at column
--   Phase 3: Admin token hashing, audit log immutability
--   Phase 4: Inventory ledger view
--   Phase 5: Booking expiration (updated_at trigger, partial index, pg_cron)
-- ============================================

-- ============ PHASE 1A: CHECK CONSTRAINTS ============

ALTER TABLE bookings
  ADD CONSTRAINT chk_booking_amount CHECK (amount_paise >= 0);

ALTER TABLE payments
  ADD CONSTRAINT chk_payment_amount CHECK (amount_paise >= 0);

ALTER TABLE payments
  ADD CONSTRAINT chk_refund_amount CHECK (refund_amount_paise IS NULL OR refund_amount_paise >= 0);

ALTER TABLE class_sessions
  ADD CONSTRAINT chk_class_price CHECK (price_paise >= 0);

ALTER TABLE class_sessions
  ADD CONSTRAINT chk_capacity CHECK (capacity IS NULL OR spots_booked <= capacity);

ALTER TABLE class_sessions
  ADD CONSTRAINT chk_spots_booked_nonneg CHECK (spots_booked >= 0);

ALTER TABLE events
  ADD CONSTRAINT chk_event_price CHECK (price_paise >= 0);


-- ============ PHASE 1B: BOOKING INTEGRITY TRIGGER ============
-- Ensures exactly one of class_session_id, event_id, space_request_id is set
-- on non-deleted bookings. Uses a trigger (not CHECK) so soft-deleted records
-- with NULL FKs (from onDelete cascade) don't violate the rule.

CREATE OR REPLACE FUNCTION check_booking_fk_integrity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NULL THEN
    IF (
      (NEW.class_session_id IS NOT NULL)::int +
      (NEW.event_id IS NOT NULL)::int +
      (NEW.space_request_id IS NOT NULL)::int
    ) != 1 THEN
      RAISE EXCEPTION 'Exactly one of class_session_id, event_id, space_request_id must be set for non-deleted bookings';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_booking_fk_integrity ON bookings;
CREATE TRIGGER trg_booking_fk_integrity
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION check_booking_fk_integrity();


-- ============ PHASE 1D: PARTIAL INDEXES ============
-- Partial indexes on FK columns — only index non-null values for efficiency.

CREATE INDEX IF NOT EXISTS idx_booking_event_id
  ON bookings(event_id) WHERE event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_booking_class_session_id
  ON bookings(class_session_id) WHERE class_session_id IS NOT NULL;


-- ============ PHASE 2A: TIMESTAMP → TIMESTAMPTZ ============
-- Safe in-place conversion. Existing values are reinterpreted as UTC.

-- bookings
ALTER TABLE bookings ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE bookings ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE bookings ALTER COLUMN deleted_at TYPE timestamptz USING deleted_at AT TIME ZONE 'UTC';
ALTER TABLE bookings ALTER COLUMN cancelled_at TYPE timestamptz USING cancelled_at AT TIME ZONE 'UTC';

-- payments
ALTER TABLE payments ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE payments ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE payments ALTER COLUMN refunded_at TYPE timestamptz USING refunded_at AT TIME ZONE 'UTC';

-- class_sessions
ALTER TABLE class_sessions ALTER COLUMN starts_at TYPE timestamptz USING starts_at AT TIME ZONE 'UTC';
ALTER TABLE class_sessions ALTER COLUMN ends_at TYPE timestamptz USING ends_at AT TIME ZONE 'UTC';
ALTER TABLE class_sessions ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE class_sessions ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE class_sessions ALTER COLUMN deleted_at TYPE timestamptz USING deleted_at AT TIME ZONE 'UTC';

-- events
ALTER TABLE events ALTER COLUMN starts_at TYPE timestamptz USING starts_at AT TIME ZONE 'UTC';
ALTER TABLE events ALTER COLUMN ends_at TYPE timestamptz USING ends_at AT TIME ZONE 'UTC';
ALTER TABLE events ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE events ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE events ALTER COLUMN deleted_at TYPE timestamptz USING deleted_at AT TIME ZONE 'UTC';

-- event_passes
ALTER TABLE event_passes ALTER COLUMN check_in_time TYPE timestamptz USING check_in_time AT TIME ZONE 'UTC';
ALTER TABLE event_passes ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE event_passes ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- space_requests
ALTER TABLE space_requests ALTER COLUMN scheduled_slot TYPE timestamptz USING scheduled_slot AT TIME ZONE 'UTC';
ALTER TABLE space_requests ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE space_requests ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';
ALTER TABLE space_requests ALTER COLUMN deleted_at TYPE timestamptz USING deleted_at AT TIME ZONE 'UTC';

-- notification_logs
ALTER TABLE notification_logs ALTER COLUMN sent_at TYPE timestamptz USING sent_at AT TIME ZONE 'UTC';
ALTER TABLE notification_logs ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
ALTER TABLE notification_logs ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- status_history
ALTER TABLE status_history ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- admin_sessions
ALTER TABLE admin_sessions ALTER COLUMN expires_at TYPE timestamptz USING expires_at AT TIME ZONE 'UTC';
ALTER TABLE admin_sessions ALTER COLUMN last_activity_at TYPE timestamptz USING last_activity_at AT TIME ZONE 'UTC';
ALTER TABLE admin_sessions ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';


-- ============ PHASE 2B: PAYMENT EXPIRES AT ============

ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_expires_at timestamptz;

-- Backfill existing records: 15 minute expiry window
UPDATE payments
  SET payment_expires_at = created_at + INTERVAL '15 minutes'
  WHERE payment_expires_at IS NULL;


-- ============ PHASE 3A: ADMIN TOKEN HASHING ============
-- Step 1: Add hashed_token column
-- Step 2: Backfill from existing raw tokens
-- Step 3: After code deployment, drop the old token column via a separate migration

ALTER TABLE admin_sessions ADD COLUMN IF NOT EXISTS hashed_token TEXT;

-- Backfill: hash existing raw tokens with SHA-256
UPDATE admin_sessions
  SET hashed_token = encode(sha256(token::bytea), 'hex')
  WHERE hashed_token IS NULL AND token IS NOT NULL;

-- Create unique index on hashed_token (needed for lookups)
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_sessions_hashed_token
  ON admin_sessions(hashed_token) WHERE hashed_token IS NOT NULL;


-- ============ PHASE 3B: AUDIT LOG IMMUTABILITY ============
-- status_history is append-only. Prevent modifications via trigger.

CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'status_history is append-only: UPDATE and DELETE are not allowed';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_status_history_immutable ON status_history;
CREATE TRIGGER trg_status_history_immutable
  BEFORE UPDATE OR DELETE ON status_history
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();


-- ============ PHASE 4: INVENTORY LEDGER VIEW ============
-- Derive availability from confirmed bookings instead of a mutable counter.

CREATE OR REPLACE VIEW class_availability AS
SELECT
  cs.id,
  cs.title,
  cs.capacity,
  COUNT(b.id) FILTER (
    WHERE b.status IN ('CONFIRMED', 'PENDING_PAYMENT')
    AND b.deleted_at IS NULL
  ) AS booked_count,
  CASE
    WHEN cs.capacity IS NULL THEN NULL
    ELSE GREATEST(
      0,
      cs.capacity - COUNT(b.id) FILTER (
        WHERE b.status IN ('CONFIRMED', 'PENDING_PAYMENT')
        AND b.deleted_at IS NULL
      )
    )
  END AS available_spots
FROM class_sessions cs
LEFT JOIN bookings b ON b.class_session_id = cs.id
GROUP BY cs.id, cs.title, cs.capacity;

CREATE OR REPLACE VIEW event_availability AS
SELECT
  e.id,
  e.title,
  e.capacity,
  COUNT(b.id) FILTER (
    WHERE b.status IN ('CONFIRMED', 'PENDING_PAYMENT')
    AND b.deleted_at IS NULL
  ) AS booked_count,
  CASE
    WHEN e.capacity IS NULL THEN NULL
    ELSE GREATEST(
      0,
      e.capacity - COUNT(b.id) FILTER (
        WHERE b.status IN ('CONFIRMED', 'PENDING_PAYMENT')
        AND b.deleted_at IS NULL
      )
    )
  END AS available_spots
FROM events e
LEFT JOIN bookings b ON b.event_id = e.id
GROUP BY e.id, e.title, e.capacity;


-- ============ PHASE 5A: UPDATED_AT TRIGGER ============
-- Ensures updated_at is set correctly even for direct SQL (pg_cron, admin scripts).

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON bookings;
CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_class_sessions_updated_at ON class_sessions;
CREATE TRIGGER trg_class_sessions_updated_at
  BEFORE UPDATE ON class_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_event_passes_updated_at ON event_passes;
CREATE TRIGGER trg_event_passes_updated_at
  BEFORE UPDATE ON event_passes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_space_requests_updated_at ON space_requests;
CREATE TRIGGER trg_space_requests_updated_at
  BEFORE UPDATE ON space_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_notification_logs_updated_at ON notification_logs;
CREATE TRIGGER trg_notification_logs_updated_at
  BEFORE UPDATE ON notification_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============ PHASE 5B: BOOKING EXPIRATION INDEX ============
-- Partial index: only indexes PENDING_PAYMENT bookings for fast cleanup queries.

CREATE INDEX IF NOT EXISTS idx_booking_pending_expiry
  ON bookings(created_at)
  WHERE status = 'PENDING_PAYMENT';


-- ============ PHASE 5C: PG_CRON BOOKING EXPIRATION ============
-- Uncomment and run this separately if pg_cron extension is enabled in Supabase.
-- Expires unpaid bookings older than 15 minutes, every 5 minutes.
--
-- SELECT cron.schedule(
--   'expire-unpaid-bookings',
--   '*/5 * * * *',
--   $$
--     UPDATE bookings
--     SET status = 'EXPIRED'
--     WHERE status = 'PENDING_PAYMENT'
--     AND created_at < NOW() - INTERVAL '15 minutes';
--
--     INSERT INTO status_history (id, booking_id, from_status, to_status, changed_by, reason, created_at)
--     SELECT
--       gen_random_uuid()::text,
--       b.id,
--       'PENDING_PAYMENT',
--       'EXPIRED',
--       'SYSTEM',
--       'Auto-expired: payment not completed within 15 minutes',
--       NOW()
--     FROM bookings b
--     WHERE b.status = 'EXPIRED'
--     AND b.updated_at >= NOW() - INTERVAL '6 minutes';
--   $$
-- );


-- ============ VERIFICATION ============

DO $$
DECLARE
  constraint_count INT;
  trigger_count INT;
  view_count INT;
  index_count INT;
BEGIN
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.table_constraints
  WHERE constraint_type = 'CHECK'
  AND table_schema = 'public'
  AND constraint_name LIKE 'chk_%';

  SELECT COUNT(*) INTO trigger_count
  FROM information_schema.triggers
  WHERE trigger_schema = 'public'
  AND trigger_name LIKE 'trg_%';

  SELECT COUNT(*) INTO view_count
  FROM information_schema.views
  WHERE table_schema = 'public'
  AND table_name IN ('class_availability', 'event_availability');

  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
  AND indexname IN ('idx_booking_event_id', 'idx_booking_class_session_id', 'idx_booking_pending_expiry', 'idx_admin_sessions_hashed_token');

  RAISE NOTICE '=== Migration V2 Verification ===';
  RAISE NOTICE 'CHECK constraints: % (expected 7)', constraint_count;
  RAISE NOTICE 'Triggers: % (expected 10)', trigger_count;
  RAISE NOTICE 'Views: % (expected 2)', view_count;
  RAISE NOTICE 'New indexes: % (expected 4)', index_count;
END $$;
