# Event pair pricing — design

**Date:** 2026-07-21
**Status:** Approved, implementing

## Problem

The Paper Dates poster advertises two prices:

```
Rs.399 / per person
Rs.699 / 2 people
```

The website charges ₹798 for two seats and never shows the ₹699 offer.

Root cause: an `Event` carries a single `pricePaise`, and both the booking
function and the public page compute the total by straight multiplication.

- `netlify/functions/createBooking.ts:251` — `amountPaise = eventRecord.pricePaise * quantity`
- `src/app/(public)/events/page.tsx:553` — `totalPaise = selectedEvent.pricePaise * quantity`

The ₹699 deal exists only as free text inside the event's Description. Nothing
in the system can charge it, and the admin form has no field to express it.
This is a missing capability, not an arithmetic bug.

## Scope

Only Paper Dates changes behaviour. The mechanism is generic (two optional
columns) so no event ID is hardcoded, but every other event leaves the new
fields `NULL` and behaves exactly as it does today.

## Data model

Two nullable columns on `events`:

| Field | Column | Purpose | Paper Dates | Others |
|---|---|---|---|---|
| `pairPricePaise` | `pair_price_paise` | Total charged when exactly 2 seats are booked | `69900` | `NULL` |
| `maxSeatsPerBooking` | `max_seats_per_booking` | Per-booking seat cap | `2` | `NULL` → existing max of 10 |

Both nullable and additive, so the migration is safe against existing rows.

## Pricing rule

```ts
amountPaise = (quantity === 2 && pairPricePaise !== null)
  ? pairPricePaise
  : pricePaise * quantity;
```

Paper Dates is capped at 2 seats per booking, so quantity 3+ cannot arise for
it. The rule is written to degrade safely anyway: any event with a pair price
but no cap falls back to per-person multiplication above 2.

## Server-side enforcement

`createBooking` is a public HTTP endpoint. The seat stepper in the browser is
UX only — the function must independently reject `quantity` above the event's
cap, or a hand-crafted POST bypasses it.

Two places in `createBooking.ts` need care:

1. The `select` at line 198 must include both new fields, or they read back
   `undefined` and the pair price silently never applies.
2. The cap check belongs alongside the existing capacity check, before the
   amount is computed.

## UI

**Public event card** — show `₹399 · ₹699 for 2` instead of `₹399`, so the
offer is visible before the booking dialog opens. This is the half of the
complaint about the discount "not showing up on the website".

**Booking dialog** — when the pair price applies, replace the `2 × ₹399` line
with `2 people (group price)` and a `You save ₹99` line. The seat stepper's
`maxQty` becomes `min(cap ?? 10, availableSpots)`.

**Admin Edit Event** — two optional inputs under Price: *Price for 2 people (₹)*
and *Max seats per booking*. Blank means today's behaviour.

## Files

| File | Change |
|---|---|
| `prisma/schema.prisma` | Two fields on `Event` |
| `prisma/migrations/add_event_pair_pricing.sql` | Additive migration |
| `netlify/functions/createBooking.ts` | `select`, cap check, pricing rule |
| `netlify/functions/adminCreateEvent.ts` | Zod schema |
| `netlify/functions/adminUpdateEvent.ts` | Zod schema |
| `src/types/index.ts` | `Event` interface |
| `src/app/(public)/events/page.tsx` | Card badge, `maxQty`, total breakdown |
| `src/app/oss-ctrl-9x7k2m/events/page.tsx` | Form fields, rupee↔paise conversion |
| `unit-tests/createBooking.test.ts` | Coverage below |

`getEvents.ts` needs no change — it spreads `...e`, so new columns flow through.

## Tests

- quantity 1 → ₹399
- quantity 2 → ₹699 (not ₹798)
- quantity 3 on a capped event → rejected
- event with `NULL` pair price → unchanged multiplication at every quantity
- direct POST above the cap → rejected server-side

## Notes

- No refunds needed. The only existing Paper Dates booking is a test booking,
  confirmed by the site owner.
- Event date is 26 July 2026; this needs to ship before then.
