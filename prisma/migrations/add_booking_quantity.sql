-- Multi-seat booking: number of seats/passes reserved per booking.
-- Additive + idempotent so it can be run against production without a reset.
-- Existing rows backfill to 1 seat via the column default.

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

-- Guardrail: a booking must reserve at least one seat.
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS chk_booking_quantity;
ALTER TABLE bookings ADD CONSTRAINT chk_booking_quantity CHECK (quantity >= 1);
