-- ============================================
-- OSS BOOKING SYSTEM — ROW LEVEL SECURITY
-- ============================================
-- Run this SQL in your Supabase SQL Editor after running prisma db push.
--
-- Architecture:
--   - Netlify Functions connect via the service_role key (bypasses RLS)
--   - RLS protects against direct DB access from Supabase client SDKs
--   - The anon role gets read-only access to public data
--   - The authenticated role is not used (auth is handled by Netlify Functions)
--   - The service_role bypasses RLS entirely (used by Netlify Functions)
--
-- IMPORTANT: Run prisma db push BEFORE this script so all tables exist.
-- ============================================

-- ============ ENABLE RLS ON ALL TABLES ============

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (prevents accidental bypass)
ALTER TABLE bookings FORCE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;
ALTER TABLE class_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;
ALTER TABLE event_passes FORCE ROW LEVEL SECURITY;
ALTER TABLE space_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE notification_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE status_history FORCE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions FORCE ROW LEVEL SECURITY;

-- ============ DROP EXISTING POLICIES (idempotent) ============

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename IN (
            'bookings', 'payments', 'class_sessions', 'events',
            'event_passes', 'space_requests', 'notification_logs',
            'status_history', 'admin_sessions'
          )
    )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    END LOOP;
END $$;

-- ============ BOOKINGS ============
-- No public access. All operations go through Netlify Functions (service_role).

CREATE POLICY "bookings_deny_anon_select"
    ON bookings FOR SELECT
    TO anon
    USING (false);

CREATE POLICY "bookings_deny_anon_insert"
    ON bookings FOR INSERT
    TO anon
    WITH CHECK (false);

CREATE POLICY "bookings_deny_anon_update"
    ON bookings FOR UPDATE
    TO anon
    USING (false)
    WITH CHECK (false);

CREATE POLICY "bookings_deny_anon_delete"
    ON bookings FOR DELETE
    TO anon
    USING (false);

-- ============ PAYMENTS ============
-- Strictly private. Only service_role can access.

CREATE POLICY "payments_deny_anon_select"
    ON payments FOR SELECT
    TO anon
    USING (false);

CREATE POLICY "payments_deny_anon_insert"
    ON payments FOR INSERT
    TO anon
    WITH CHECK (false);

CREATE POLICY "payments_deny_anon_update"
    ON payments FOR UPDATE
    TO anon
    USING (false)
    WITH CHECK (false);

CREATE POLICY "payments_deny_anon_delete"
    ON payments FOR DELETE
    TO anon
    USING (false);

-- ============ CLASS SESSIONS ============
-- Public can read active, non-deleted classes. Only service_role can write.

CREATE POLICY "class_sessions_anon_select_active"
    ON class_sessions FOR SELECT
    TO anon
    USING (active = true AND deleted_at IS NULL);

CREATE POLICY "class_sessions_deny_anon_insert"
    ON class_sessions FOR INSERT
    TO anon
    WITH CHECK (false);

CREATE POLICY "class_sessions_deny_anon_update"
    ON class_sessions FOR UPDATE
    TO anon
    USING (false)
    WITH CHECK (false);

CREATE POLICY "class_sessions_deny_anon_delete"
    ON class_sessions FOR DELETE
    TO anon
    USING (false);

-- ============ EVENTS ============
-- Public can read active, non-deleted events. Only service_role can write.

CREATE POLICY "events_anon_select_active"
    ON events FOR SELECT
    TO anon
    USING (active = true AND deleted_at IS NULL);

CREATE POLICY "events_deny_anon_insert"
    ON events FOR INSERT
    TO anon
    WITH CHECK (false);

CREATE POLICY "events_deny_anon_update"
    ON events FOR UPDATE
    TO anon
    USING (false)
    WITH CHECK (false);

CREATE POLICY "events_deny_anon_delete"
    ON events FOR DELETE
    TO anon
    USING (false);

-- ============ EVENT PASSES ============
-- No public access. Verified through Netlify Functions.

CREATE POLICY "event_passes_deny_anon_select"
    ON event_passes FOR SELECT
    TO anon
    USING (false);

CREATE POLICY "event_passes_deny_anon_insert"
    ON event_passes FOR INSERT
    TO anon
    WITH CHECK (false);

CREATE POLICY "event_passes_deny_anon_update"
    ON event_passes FOR UPDATE
    TO anon
    USING (false)
    WITH CHECK (false);

CREATE POLICY "event_passes_deny_anon_delete"
    ON event_passes FOR DELETE
    TO anon
    USING (false);

-- ============ SPACE REQUESTS ============
-- No public access.

CREATE POLICY "space_requests_deny_anon_select"
    ON space_requests FOR SELECT
    TO anon
    USING (false);

CREATE POLICY "space_requests_deny_anon_insert"
    ON space_requests FOR INSERT
    TO anon
    WITH CHECK (false);

CREATE POLICY "space_requests_deny_anon_update"
    ON space_requests FOR UPDATE
    TO anon
    USING (false)
    WITH CHECK (false);

CREATE POLICY "space_requests_deny_anon_delete"
    ON space_requests FOR DELETE
    TO anon
    USING (false);

-- ============ NOTIFICATION LOGS ============
-- No public access.

CREATE POLICY "notification_logs_deny_anon_select"
    ON notification_logs FOR SELECT
    TO anon
    USING (false);

CREATE POLICY "notification_logs_deny_anon_insert"
    ON notification_logs FOR INSERT
    TO anon
    WITH CHECK (false);

CREATE POLICY "notification_logs_deny_anon_update"
    ON notification_logs FOR UPDATE
    TO anon
    USING (false)
    WITH CHECK (false);

CREATE POLICY "notification_logs_deny_anon_delete"
    ON notification_logs FOR DELETE
    TO anon
    USING (false);

-- ============ STATUS HISTORY ============
-- No public access. Audit-only table.

CREATE POLICY "status_history_deny_anon_select"
    ON status_history FOR SELECT
    TO anon
    USING (false);

CREATE POLICY "status_history_deny_anon_insert"
    ON status_history FOR INSERT
    TO anon
    WITH CHECK (false);

CREATE POLICY "status_history_deny_anon_update"
    ON status_history FOR UPDATE
    TO anon
    USING (false)
    WITH CHECK (false);

CREATE POLICY "status_history_deny_anon_delete"
    ON status_history FOR DELETE
    TO anon
    USING (false);

-- ============ ADMIN SESSIONS ============
-- Absolutely no public access. Most sensitive table.

CREATE POLICY "admin_sessions_deny_anon_select"
    ON admin_sessions FOR SELECT
    TO anon
    USING (false);

CREATE POLICY "admin_sessions_deny_anon_insert"
    ON admin_sessions FOR INSERT
    TO anon
    WITH CHECK (false);

CREATE POLICY "admin_sessions_deny_anon_update"
    ON admin_sessions FOR UPDATE
    TO anon
    USING (false)
    WITH CHECK (false);

CREATE POLICY "admin_sessions_deny_anon_delete"
    ON admin_sessions FOR DELETE
    TO anon
    USING (false);

-- ============ VERIFICATION ============

DO $$
DECLARE
    tbl TEXT;
    rls_enabled BOOLEAN;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY[
        'bookings', 'payments', 'class_sessions', 'events',
        'event_passes', 'space_requests', 'notification_logs',
        'status_history', 'admin_sessions'
    ])
    LOOP
        SELECT relrowsecurity INTO rls_enabled
        FROM pg_class
        WHERE relname = tbl AND relnamespace = 'public'::regnamespace;

        IF NOT rls_enabled THEN
            RAISE WARNING 'RLS is NOT enabled on table: %', tbl;
        ELSE
            RAISE NOTICE 'RLS verified on table: %', tbl;
        END IF;
    END LOOP;
END $$;
