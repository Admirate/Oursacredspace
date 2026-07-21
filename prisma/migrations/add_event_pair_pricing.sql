-- Optional group pricing for events, e.g. "Rs.399/person, Rs.699/2 people".
-- Additive + idempotent so it can be run against production without a reset.
-- Both columns are nullable: existing events backfill to NULL and keep their
-- current per-person pricing and the global 10-seat cap.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS pair_price_paise integer;

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS max_seats_per_booking integer;

-- Guardrails: a group price cannot be negative, and a cap below 1 would make
-- the event unbookable.
ALTER TABLE events DROP CONSTRAINT IF EXISTS chk_event_pair_price;
ALTER TABLE events ADD CONSTRAINT chk_event_pair_price
  CHECK (pair_price_paise IS NULL OR pair_price_paise >= 0);

ALTER TABLE events DROP CONSTRAINT IF EXISTS chk_event_max_seats;
ALTER TABLE events ADD CONSTRAINT chk_event_max_seats
  CHECK (max_seats_per_booking IS NULL OR max_seats_per_booking >= 1);
