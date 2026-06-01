-- ============================================================================
-- SEC-004 / SEC-005 / SEC-006 remediation:
-- Per-booking access token (SHA-256 hash) for IDOR / PII protection
-- ============================================================================
-- Adds a nullable `access_token_hash` column to `bookings`.
--
-- Behaviour after this migration + the corresponding code change:
--   * New bookings always get a high-entropy access token. The raw token is
--     returned to the client once and is required on getBooking and
--     createRazorpayOrder. Only the SHA-256 hash is persisted.
--   * Legacy rows (created before this column existed) have
--     access_token_hash IS NULL. getBooking / createRazorpayOrder will return
--     404 for those bookings if accessed via the new endpoints. Those bookings
--     are already past their payment step in production, so the only effect
--     is that the self-service /success page cannot fetch them. Confirmation
--     emails sent at the time of booking remain the source of truth for
--     legacy customers.
-- ============================================================================

BEGIN;

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS access_token_hash TEXT;

-- Unique index (matches Prisma's @unique). Postgres allows multiple NULLs
-- under a UNIQUE constraint, so legacy rows do not conflict.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'bookings_access_token_hash_key'
  ) THEN
    CREATE UNIQUE INDEX "bookings_access_token_hash_key"
      ON bookings (access_token_hash);
  END IF;
END $$;

COMMIT;
