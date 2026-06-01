-- ============================================================================
-- SEC-003 remediation: Drop plaintext session token column
-- ============================================================================
-- Removes the `token` column from admin_sessions. Only the SHA-256 hash
-- (`hashed_token`) is persisted. The raw token continues to live solely
-- in the client's HttpOnly cookie, so a database breach can no longer
-- expose usable admin session tokens.
--
-- Run AFTER deploying the application code that no longer writes to
-- `admin_sessions.token`. All existing sessions are invalidated as part
-- of the migration -- admins will need to log in again.
-- ============================================================================

BEGIN;

-- Backfill any rows that were created before hashed_token was populated.
-- (Safe no-op if every row already has hashed_token set.)
UPDATE admin_sessions
SET hashed_token = encode(digest(token, 'sha256'), 'hex')
WHERE hashed_token IS NULL
  AND token IS NOT NULL;

-- Force every active admin to re-login. This guarantees no row is left
-- with a NULL hashed_token before we mark the column NOT NULL.
DELETE FROM admin_sessions
WHERE hashed_token IS NULL;

-- Drop the unique index on the plaintext token, then the column itself.
ALTER TABLE admin_sessions
  DROP CONSTRAINT IF EXISTS "admin_sessions_token_key";

DROP INDEX IF EXISTS "admin_sessions_token_key";

ALTER TABLE admin_sessions
  DROP COLUMN IF EXISTS token;

-- Tighten hashed_token: required + unique (Prisma model now reflects this).
ALTER TABLE admin_sessions
  ALTER COLUMN hashed_token SET NOT NULL;

-- Idempotent unique index on hashed_token (Prisma creates this name).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'admin_sessions_hashed_token_key'
  ) THEN
    CREATE UNIQUE INDEX "admin_sessions_hashed_token_key"
      ON admin_sessions (hashed_token);
  END IF;
END $$;

COMMIT;
