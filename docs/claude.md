# OSS Booking System — Complete Codebase Reference

> **Our Sacred Space** — Booking and event management platform for a cultural and community centre in Secunderabad.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Directory Structure](#3-directory-structure)
4. [Configuration Files](#4-configuration-files)
5. [Database Schema (Prisma)](#5-database-schema-prisma)
6. [Netlify Functions (Backend)](#6-netlify-functions-backend)
7. [Helper Modules](#7-helper-modules)
8. [Frontend Architecture](#8-frontend-architecture)
9. [Routing](#9-routing)
10. [Components](#10-components)
11. [Hooks](#11-hooks)
12. [Lib / Utilities](#12-lib--utilities)
13. [TypeScript Types](#13-typescript-types)
14. [Styling & Theming](#14-styling--theming)
15. [Assets & Media](#15-assets--media)
16. [Authentication & Authorization](#16-authentication--authorization)
17. [Security Model](#17-security-model)
18. [Payment Flow (Razorpay)](#18-payment-flow-razorpay)
19. [User Flows](#19-user-flows)
20. [Environment Variables](#20-environment-variables)
21. [NPM Scripts](#21-npm-scripts)
22. [Deployment (Netlify)](#22-deployment-netlify)
23. [Known Gaps](#23-known-gaps)
24. [Change Log](#24-change-log)

---

## 1. Project Overview

**Name:** `oss-booking-system`
**Version:** 1.0.0
**Purpose:** Full-stack booking platform where users can:

- Browse and book **classes** (yoga, meditation, etc.)
- Purchase **event passes** with QR codes for check-in
- Submit **space rental requests** for the venue
- Admins manage all of the above via a dashboard

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript (strict mode) |
| UI Library | React 18 |
| Styling | Tailwind CSS 3.4 + shadcn/ui (Radix UI) |
| State Management | TanStack React Query v5 |
| Forms | React Hook Form + Zod validation |
| Backend | Netlify Functions (serverless, esbuild-bundled) |
| Database | PostgreSQL via Supabase |
| ORM | Prisma 5.9 |
| Payments | Razorpay |
| File Storage | Supabase Storage |
| QR Codes | `qrcode` library |
| Smooth Scroll | Lenis |
| Fonts | Plus Jakarta Sans, Geist |
| Notifications | WhatsApp Business API (scaffolded, not active) |
| Deployment | Netlify (with `@netlify/plugin-nextjs`) |

---

## 3. Directory Structure

```
OSS/
├── prisma/
│   ├── schema.prisma          # Database schema (9 models, 8 enums)
│   ├── seed.ts                # Database seeding script
│   ├── migration-v2.sql       # V2 migration: constraints, triggers, views, indexes
│   └── rls-policies.sql       # Row Level Security policies
├── public/
│   └── placeholder.svg        # Placeholder image
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── layout.tsx         # Root layout (providers, fonts, metadata)
│   │   ├── globals.css        # Global styles + CSS animations
│   │   ├── sitemap.ts         # Dynamic sitemap generator
│   │   ├── robots.ts          # Robots.txt config
│   │   ├── (public)/          # Public route group
│   │   │   ├── layout.tsx     # Header + Footer wrapper
│   │   │   ├── page.tsx       # Home page
│   │   │   ├── events/page.tsx
│   │   │   ├── classes/page.tsx
│   │   │   ├── workshops/page.tsx
│   │   │   ├── book-space/page.tsx
│   │   │   ├── co-working-space/page.tsx
│   │   │   ├── space-enquiry/page.tsx
│   │   │   ├── community/page.tsx
│   │   │   ├── initiatives/page.tsx
│   │   │   ├── visit/page.tsx
│   │   │   ├── contact/page.tsx
│   │   │   ├── success/page.tsx       # Post-booking confirmation
│   │   │   └── verify/page.tsx        # QR pass verification
│   │   └── oss-ctrl-9x7k2m/   # Admin dashboard (obfuscated route)
│   │       ├── layout.tsx     # Admin layout (sidebar, auth guard)
│   │       ├── page.tsx       # Dashboard home
│   │       ├── login/page.tsx
│   │       ├── bookings/page.tsx
│   │       ├── classes/page.tsx
│   │       ├── events/page.tsx
│   │       └── space/page.tsx
│   ├── components/
│   │   ├── shared/            # Header, Footer, OptimizedImage, OptimizedVideo, LoadingSpinner
│   │   ├── providers/         # QueryProvider (React Query), LenisProvider (smooth scroll)
│   │   └── ui/                # ~21 shadcn/ui primitives (button, card, dialog, form, table, etc.)
│   ├── hooks/                 # useBooking, usePayment, use-toast, useLenis
│   ├── lib/                   # api.ts, constants.ts, assets.ts, utils.ts, supabase.ts, validators.ts
│   └── types/                 # TypeScript type definitions (index.ts)
├── netlify/
│   └── functions/             # 21 serverless functions
│       ├── helpers/           # 7 shared helper modules
│       │   ├── prisma.ts
│       │   ├── security.ts
│       │   ├── verifyAdmin.ts
│       │   ├── generateQR.ts
│       │   ├── uploadQrToSupabase.ts
│       │   ├── sendWhatsApp.ts
│       │   └── types.ts
│       ├── getEvents.ts
│       ├── getClasses.ts
│       ├── getBooking.ts
│       ├── createBooking.ts
│       ├── createRazorpayOrder.ts
│       ├── razorpayWebhook.ts
│       ├── verifyPass.ts
│       ├── devConfirmPayment.ts
│       ├── adminAuth.ts
│       ├── adminListBookings.ts
│       ├── adminListClasses.ts
│       ├── adminListEvents.ts
│       ├── adminListPasses.ts
│       ├── adminListSpaceRequests.ts
│       ├── adminCreateClass.ts
│       ├── adminCreateEvent.ts
│       ├── adminUpdateClass.ts
│       ├── adminUpdateEvent.ts
│       ├── adminUpdateSpaceRequest.ts
│       ├── adminCheckinPass.ts
│       └── adminUploadImage.ts
├── unit-tests/                # Jest unit tests
│   ├── __mocks__/
│   │   └── prisma.ts          # Mocked Prisma client
│   ├── security.test.ts       # Security helpers tests
│   ├── validators.test.ts     # Zod schema tests
│   ├── verifyAdmin.test.ts    # Admin session verification tests
│   ├── adminAuth.test.ts      # Admin auth handler tests
│   └── adminUpdateSpaceRequest.test.ts
├── docs/
│   └── claude.md              # Full codebase reference
├── jest.config.ts             # Jest config (ts-jest, roots: unit-tests/)
├── package.json
├── netlify.toml               # Build, redirects, security headers
├── next.config.mjs            # Next.js config (standalone output, Supabase images)
├── tailwind.config.ts         # Brand colors, custom animations
├── tsconfig.json              # Path alias @/* → ./src/*
├── postcss.config.js
├── components.json            # shadcn/ui config
└── README.md
```

---

## 4. Configuration Files

### `package.json`

- **Name:** `oss-booking-system`, v1.0.0, private
- **Key deps:** next@^16.1.4, react@^18.2.0, @prisma/client@^5.9.1, @supabase/supabase-js@^2.39.6, razorpay@^2.9.2, @tanstack/react-query@^5.18.1, zod@^3.22.4, react-hook-form@^7.50.1
- **Dev deps:** prisma@^5.9.1, typescript@^5.3.3, tailwindcss@^3.4.1, @netlify/plugin-nextjs@^5.0.0, netlify-cli (added for local dev)

### `netlify.toml`

- Build command: `npm run build` (runs `prisma generate && next build`)
- Publish: `.next`
- Node 20
- Functions directory: `netlify/functions` (esbuild bundler)
- Redirect: `/api/*` → `/.netlify/functions/:splat` (status 200)
- Security headers: X-Frame-Options DENY, CSP, HSTS, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy
- CSP allows: Razorpay, Supabase, Google Fonts, OpenStreetMap

### `next.config.mjs`

- Output: `standalone` (for Netlify)
- Remote image patterns: `*.supabase.co/storage/v1/object/public/**`
- React strict mode: enabled

### `tsconfig.json`

- Target: ES2017, Module: ESNext, bundler resolution
- Path alias: `@/*` → `./src/*`
- Strict: true

### `components.json`

- shadcn/ui config: RSC enabled, Tailwind, neutral base color, `src/lib/utils` for cn(), `@/components/ui` aliases

---

## 5. Database Schema (Prisma)

**File:** `prisma/schema.prisma`
**Provider:** PostgreSQL via `DATABASE_URL`

### Enums

| Enum | Values |
|------|--------|
| `BookingType` | CLASS, EVENT, SPACE |
| `BookingStatus` | PENDING_PAYMENT, CONFIRMED, PAYMENT_FAILED, CANCELLED, EXPIRED |
| `PaymentStatus` | CREATED, PAID, FAILED, REFUNDED |
| `SpaceRequestStatus` | REQUESTED, APPROVED_CALL_SCHEDULED, RESCHEDULE_REQUESTED, DECLINED, CONFIRMED, NOT_PROCEEDING, FOLLOW_UP_REQUIRED |
| `CheckInStatus` | NOT_CHECKED_IN, CHECKED_IN |
| `NotificationChannel` | WHATSAPP, EMAIL |
| `NotificationStatus` | SENT, FAILED, PENDING |

### Models

#### `Booking` — Central booking entity
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| type | BookingType | CLASS / EVENT / SPACE |
| status | BookingStatus | Default: PENDING_PAYMENT |
| name | String | Customer name (denormalized) |
| phone | String | E.164 format (+91...) |
| email | String | Customer email |
| amountPaise | Int | Amount in paise (INR smallest unit) |
| currency | String | Default: "INR" |
| classSessionId | String? | FK → ClassSession (for CLASS bookings) |
| eventId | String? | FK → Event (for EVENT bookings) |
| spaceRequestId | String? | FK → SpaceRequest (unique, for SPACE bookings) |
| payments | Payment[] | Related payments |
| eventPass | EventPass? | Related event pass (1:1) |
| notifications | NotificationLog[] | Related notifications |
| statusHistory | StatusHistory[] | Audit trail |
| Indexes | type, status, createdAt, email |

#### `Payment` — Razorpay payment records
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| bookingId | String | FK → Booking |
| provider | String | Default: "RAZORPAY" |
| razorpayOrderId | String | Unique |
| razorpayPaymentId | String? | Unique, set after payment |
| status | PaymentStatus | Default: CREATED |
| amountPaise | Int | Amount in paise |
| webhookEventId | String? | Unique, idempotency key |
| rawPayload | Json? | Raw webhook data |
| paymentExpiresAt | DateTime? | Payment expiry (default: created_at + 15min) |

#### `ClassSession` — Class sessions
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| title | String | Class name |
| description | String? | |
| imageUrl | String? | Supabase Storage URL |
| startsAt | DateTime | Session start time |
| duration | Int | Default: 60 (minutes) |
| capacity | Int | Max participants |
| spotsBooked | Int | Default: 0, incremented on confirmation |
| pricePaise | Int | Price in paise |
| active | Boolean | Default: true |

#### `Event` — Events
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| title | String | Event name |
| description | String? | |
| imageUrl | String? | Supabase Storage URL |
| startsAt | DateTime | Event start time |
| venue | String | Event location |
| pricePaise | Int | Ticket price in paise |
| capacity | Int? | Optional max capacity |
| active | Boolean | Default: true |

#### `EventPass` — QR event passes
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| bookingId | String | FK → Booking (unique, 1:1) |
| eventId | String | FK → Event |
| passId | String | Unique, format: `OSS-EV-XXXXXXXX` (8 alphanumeric chars) |
| qrImageUrl | String | Supabase Storage URL for QR image |
| checkInStatus | CheckInStatus | Default: NOT_CHECKED_IN |
| checkInTime | DateTime? | When checked in |
| checkedInBy | String? | Admin email who performed check-in |

#### `SpaceRequest` — Space rental requests
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| name, phone, email | String | Customer info |
| preferredSlots | Json | Array of preferred datetime slots |
| scheduledSlot | DateTime? | Admin-assigned slot |
| notes | String? | Customer notes |
| purpose | String? | Purpose of rental |
| status | SpaceRequestStatus | Default: REQUESTED |
| adminNotes | String? | Admin notes |

#### `NotificationLog` — Notification tracking
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| bookingId | String? | FK → Booking |
| channel | NotificationChannel | WHATSAPP or EMAIL |
| templateName | String | Template identifier |
| to | String | Phone or email |
| status | NotificationStatus | SENT / FAILED / PENDING |
| providerMessageId | String? | External message ID |
| error | String? | Error message if failed |
| retryCount | Int | Default: 0 |

#### `StatusHistory` — Booking audit trail
| Field | Type | Notes |
|-------|------|-------|
| id | String (UUID) | Primary key |
| bookingId | String | FK → Booking |
| fromStatus | String | Previous status |
| toStatus | String | New status |
| changedBy | String | "SYSTEM" or admin email |
| reason | String? | Reason for change |

#### `AdminSession` — Admin authentication sessions
| Field | Type | Notes |
|-------|------|-------|
| id | String (CUID) | Primary key |
| email | String | Unique |
| token | String | Unique, 64-char hex (raw, backward compat) |
| hashedToken | String? | Unique, SHA-256 hash of token (used for lookups) |
| ipAddress | String? | Client IP at login |
| userAgent | String? | Browser user agent at login |
| expiresAt | DateTime | Session expiry (timestamptz) |
| lastActivityAt | DateTime | Last activity timestamp |

---

## 6. Netlify Functions (Backend)

All functions are at `netlify/functions/`. They're exposed under `/.netlify/functions/*` (and also `/api/*` via redirect).

### Public Functions (no authentication required)

| Function | Method | Rate Limit | Purpose |
|----------|--------|------------|---------|
| `getEvents` | GET | 100/min | List active future events |
| `getClasses` | GET | 100/min | List active future class sessions |
| `createBooking` | POST | 10/min | Create CLASS/EVENT/SPACE booking |
| `createRazorpayOrder` | POST | 5/min | Create Razorpay payment order for a booking |
| `getBooking` | GET | 60/min | Fetch a single booking by ID (with relations) |
| `verifyPass` | GET | 30/min | Validate an event pass by passId |

### Webhook

| Function | Method | Auth | Purpose |
|----------|--------|------|---------|
| `razorpayWebhook` | POST | HMAC-SHA256 signature (`x-razorpay-signature`) | Handle `payment.captured` and `payment.failed` from Razorpay |

On `payment.captured`:
- Updates Payment → PAID
- Updates Booking → CONFIRMED
- Creates StatusHistory
- For CLASS: increments `spotsBooked` on ClassSession
- For EVENT: creates EventPass + generates QR → uploads to Supabase Storage
- Creates NotificationLog

### Dev-Only

| Function | Method | Guard | Purpose |
|----------|--------|-------|---------|
| `devConfirmPayment` | POST | `ALLOW_DEV_ENDPOINTS=true` + `x-dev-secret` header | Simulate payment confirmation without Razorpay |

### Admin Functions (all require `admin_token` cookie via `verifyAdminSession`)

| Function | Method | Purpose |
|----------|--------|---------|
| `adminAuth` | POST | Login (email + password → creates session + sets cookie) |
| `adminAuth` | GET | Check session validity |
| `adminAuth` | DELETE | Logout (clears cookie + deletes session) |
| `adminListBookings` | GET | Paginated bookings with filters (type, status, date range, search) |
| `adminListClasses` | GET | List classes with booking counts |
| `adminListEvents` | GET | List events with pass/check-in counts |
| `adminCreateClass` | POST | Create class session |
| `adminUpdateClass` | PUT | Update class session |
| `adminCreateEvent` | POST | Create event |
| `adminUpdateEvent` | PUT | Update event |
| `adminListPasses` | GET | List event passes (optionally by eventId) |
| `adminCheckinPass` | POST | Check in an attendee by passId |
| `adminListSpaceRequests` | GET | List space requests (optionally by status) |
| `adminUpdateSpaceRequest` | POST | Update space request status + admin notes |
| `adminUploadImage` | POST | Upload base64 image to Supabase Storage |

---

## 7. Helper Modules

Located at `netlify/functions/helpers/`:

### `prisma.ts`
Singleton Prisma client. Loads `.env` file for Netlify Functions environment.

### `security.ts`
Core security utilities:
- `timingSafeCompare(a, b)` — Constant-time string comparison using `crypto.timingSafeEqual`
- `hashToken(token)` — SHA-256 hash for session token storage (raw token in cookie, hash in DB)
- `generateSecureId(length, charset)` — Crypto-random ID generation (default: 8 chars, no ambiguous chars like 0/O/1/I)
- `sanitizeTemplateParam(value, maxLength)` — Sanitize notification template params
- `validateImageMagicBytes(buffer)` — Validate image file magic bytes (JPEG/PNG/GIF/WebP)
- `getClientIP(event)` — Extract client IP from headers
- `isRateLimited(identifier, maxRequests, windowMs)` — In-memory rate limiter with auto-cleanup
- `sanitizeString(input)` — XSS prevention (HTML entity encoding)
- `validateEnvVars(required)` — Check required environment variables
- `getSecureHeaders(origin?)` — Security response headers
- `isAllowedOrigin(event)` — CORS origin validation against allowlist
- `getValidatedOrigin(event)` — Safe origin for CORS header
- `getSecureAdminHeaders(event)` — Admin CORS headers with credentials
- `getPublicHeaders(event, methods)` — Public CORS headers
- `rateLimitResponse()` — 429 Too Many Requests response
- `logSecurityEvent(type, details)` — Security event logging (console.warn, ready for external service)

**Rate limit presets (`RATE_LIMITS`):**
| Key | Limit |
|-----|-------|
| LOGIN | 5/min |
| PAYMENT | 5/min |
| BOOKING_CREATE | 10/min |
| BOOKING_READ | 60/min |
| PUBLIC_READ | 100/min |
| PASS_VERIFY | 30/min |
| ADMIN_READ | 200/min |
| ADMIN_WRITE | 50/min |

### `verifyAdmin.ts`
- `parseAdminToken(cookie)` — Extracts and validates `admin_token` from cookie (must be 64 hex chars)
- `verifyAdminSession(event)` — Checks token against `AdminSession` in DB, validates expiry
- `getAdminHeaders(event)` — Delegates to `getSecureAdminHeaders`
- `unauthorizedResponse(event, error)` — 401 response helper

### `generateQR.ts`
- `generateQRBuffer(data)` — Returns QR code as PNG Buffer
- `generateQRDataURL(data)` — Returns QR code as data URL string

### `uploadQrToSupabase.ts`
- Uploads QR PNG buffer to Supabase Storage bucket
- Returns public URL for the uploaded image

### `sendWhatsApp.ts`
- WhatsApp Business API integration (templates for event/class/space confirmations)
- Uses `sanitizeTemplateParam` for input safety
- **Currently not called** in production flows

### `types.ts`
- `CreateBookingInput` — Server-side booking input type
- `ApiResponse<T>` — Standard API response wrapper
- `RazorpayOrderResponse` — Order creation response
- `RazorpayWebhookPayload` — Webhook event payload structure

---

## 8. Frontend Architecture

### Root Layout (`src/app/layout.tsx`)
- Wraps app in `QueryProvider` (React Query) → `LenisProvider` (smooth scroll) → `Toaster`
- Font: Plus Jakarta Sans (variable `--font-jakarta`)
- Metadata: Title template `%s | OSS Space`, Open Graph, Twitter Card, SEO keywords
- Disables Netlify RUM to prevent ad-blocker console errors

### Public Layout (`src/app/(public)/layout.tsx`)
- Wraps public pages with `Header` + `Footer`

### Admin Layout (`src/app/oss-ctrl-9x7k2m/layout.tsx`)
- Auth guard: calls `adminApi.listBookings({ limit: 1 })` on mount; redirects to `ADMIN_ROUTE_PREFIX/login` on failure
- Sidebar with `ADMIN_NAV_ITEMS`
- `ADMIN_ROUTE_PREFIX/login` bypasses this layout
- All route references use `ADMIN_ROUTE_PREFIX` constant from `src/lib/constants.ts`

---

## 9. Routing

### Public Routes

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Home | Landing page with hero, sections |
| `/events` | Events | Browse and book event passes (fetches from API) |
| `/classes` | Classes | Browse and book classes (fetches from API) |
| `/workshops` | Workshops | Static workshops info |
| `/book-space` | Book Space | Space rental information |
| `/co-working-space` | Co-Working | Co-working space information |
| `/space-enquiry` | Space Enquiry | Space rental request form → `createBooking(type: SPACE)` |
| `/community` | Community | Community section |
| `/initiatives` | Initiatives | Initiatives section |
| `/visit` | Visit | Location & visit info |
| `/contact` | Contact | Contact form |
| `/success?bookingId=...` | Success | Post-booking/payment confirmation page |
| `/verify?passId=...` | Verify | Public QR pass verification |

### Admin Routes

> **Note:** The admin route is intentionally obfuscated. The actual path is defined by `ADMIN_ROUTE_PREFIX` in `src/lib/constants.ts` (currently `/oss-ctrl-9x7k2m`). All admin pages reference this constant — to rotate the path, rename the directory and update the single constant.

| Route | Page | Purpose |
|-------|------|---------|
| `{ADMIN_ROUTE_PREFIX}/login` | Login | Email + password login form |
| `{ADMIN_ROUTE_PREFIX}` | Dashboard | Admin home |
| `{ADMIN_ROUTE_PREFIX}/bookings` | Bookings | List/filter/search bookings |
| `{ADMIN_ROUTE_PREFIX}/classes` | Classes | Create/edit/list classes |
| `{ADMIN_ROUTE_PREFIX}/events` | Events | Create/edit/list events |
| `{ADMIN_ROUTE_PREFIX}/space` | Space | Manage space requests |

---

## 10. Components

### Shared (`src/components/shared/`)

| Component | Purpose |
|-----------|---------|
| `Header.tsx` | Fixed navigation bar, green accent bar, logo from Supabase, desktop + mobile (Sheet) nav, uses `PUBLIC_NAV_ITEMS` |
| `Footer.tsx` | Brand info, navigation links, contact info, social links (Instagram, Facebook, YouTube) |
| `OptimizedImage.tsx` | Next.js Image wrapper with optimizations |
| `OptimizedVideo.tsx` | Video element wrapper |
| `LoadingSpinner.tsx` | Spinner UI |
| `index.ts` | Barrel exports |

### UI (`src/components/ui/`)

21 shadcn/ui (Radix-based) components:

`alert-dialog`, `avatar`, `badge`, `button`, `calendar`, `card`, `dialog`, `dropdown-menu`, `form`, `input`, `label`, `popover`, `select`, `separator`, `sheet`, `skeleton`, `table`, `tabs`, `textarea`, `toast`, `toaster`

### Providers (`src/components/providers/`)

| Provider | Purpose |
|----------|---------|
| `QueryProvider.tsx` | TanStack React Query `QueryClientProvider` |
| `LenisProvider.tsx` | Lenis smooth scroll context |

---

## 11. Hooks

Located at `src/hooks/`:

### `useBooking.ts`
| Hook | Purpose |
|------|---------|
| `useCreateBooking(options)` | Mutation to create a booking via `api.createBooking()`. Returns `createBooking`, `createBookingAsync`, `isLoading`, `error`, `reset` |
| `useBooking(bookingId, options)` | Query to fetch a single booking |
| `usePollBookingStatus(bookingId, options)` | Polls booking status every 2s (max 15 attempts / 30s). Calls `onConfirmed`, `onFailed`, or `onTimeout` callbacks |
| `useClasses()` | Query to fetch all classes |
| `useEvents()` | Query to fetch all events |
| `useVerifyPass(passId)` | Query to verify an event pass |

### `usePayment.ts`
| Hook | Purpose |
|------|---------|
| `usePayment(options)` | Full Razorpay checkout flow: loads script → creates order → opens modal → redirects on success. Returns `isLoading`, `isCreatingOrder`, `error`, `initiatePayment(bookingId)`, `resetError` |

### `use-toast.ts`
Toast notification hook (shadcn/ui pattern).

### `useLenis.ts`
Access Lenis smooth scroll instance.

---

## 12. Lib / Utilities

Located at `src/lib/`:

### `api.ts`
- `apiFetch<T>(endpoint, options)` — Base fetch helper with JSON, query params, error handling
- `api` object — Public API methods: `createBooking`, `createRazorpayOrder`, `getBooking`, `getClasses`, `getEvents`, `verifyPass`
- `adminApi` object — Admin API methods: `login`, `logout`, `listBookings`, `listClasses`, `createClass`, `updateClass`, `listEvents`, `createEvent`, `updateEvent`, `listPasses`, `checkinPass`, `listSpaceRequests`, `updateSpaceRequest`, `uploadImage`
- Admin calls use `credentials: "include"` for cookie auth

### `constants.ts`
- `API_ENDPOINTS` — All 15 function endpoint paths
- `RAZORPAY_CONFIG` — Payment gateway display config
- `BOOKING_STATUS_LABELS` / `BOOKING_STATUS_COLORS` — UI label/color maps
- `SPACE_STATUS_LABELS` / `SPACE_STATUS_COLORS` — Space request status UI maps
- `CHECKIN_STATUS_LABELS`, `BOOKING_TYPE_LABELS`
- `PUBLIC_NAV_ITEMS` (10 items), `ADMIN_NAV_ITEMS` (5 items)
- `POLLING_INTERVAL` (2s), `POLLING_MAX_ATTEMPTS` (15), `POLLING_TIMEOUT` (30s)
- `WHATSAPP_TEMPLATES` — Template name references

### `assets.ts`
- `getAssetUrl(path)` — Builds full Supabase Storage URL
- `assets` object — Organized asset paths (brand, hero, classes, events, space, about, icons, backgrounds)
- `videos` object — Video asset paths
- `blurPlaceholder` — Base64 blur data URL for image placeholders
- `imageSizes` — Standard dimensions (hero 1920x800, card 400x300, etc.)

### `utils.ts`
- `cn(...inputs)` — Tailwind class merging via `clsx` + `tailwind-merge`

### `supabase.ts`
- Client-side Supabase client initialization using `NEXT_PUBLIC_SUPABASE_URL` and anon key

### `validators.ts`
- Zod validation schemas (booking forms, etc.)

---

## 13. TypeScript Types

Located at `src/types/index.ts`:

### Core Types
- `Booking` — id, type, status, customerName/Phone/Email, amountPaise, relations to ClassSession/Event/SpaceRequest/EventPass/Payment
- `Payment` — id, bookingId, razorpayOrderId/PaymentId, status, amountPaise, webhookEventId
- `ClassSession` — id, title, description, imageUrl, startsAt, duration, capacity, spotsBooked, pricePaise, active
- `Event` — id, title, description, imageUrl, startsAt, venue, pricePaise, capacity, passesIssued, active
- `EventPass` — id, bookingId, eventId, passId, qrImageUrl, checkInStatus, checkInTime, checkedInBy
- `SpaceRequest` — id, bookingId, preferredDate, duration, purpose, attendees, specialRequirements, status, adminNotes
- `NotificationLog` — id, bookingId, channel, templateName, to, status, error, retryCount
- `StatusHistory` — id, bookingId, fromStatus, toStatus, changedBy, reason

### API Types
- `CreateBookingRequest` — type, name, phone, email, classSessionId?, eventId?, preferredSlots?, purpose?, notes?
- `CreateBookingResponse` — success, data: { bookingId, type, amount, requiresPayment }
- `CreateRazorpayOrderRequest` — bookingId
- `CreateRazorpayOrderResponse` — success, data: { orderId, keyId, amount, currency, bookingId, customer info }
- `GetBookingResponse` — success, data: Booking
- `AdminListBookingsRequest` — type?, status?, page?, limit?, startDate?, endDate?
- `AdminListBookingsResponse` — success, data: Booking[], pagination
- `AdminUpdateSpaceRequestRequest` — requestId, status, adminNotes?
- `AdminCheckinPassRequest` — passId, adminEmail
- `AdminCheckinPassResponse` — success, data: { passId, attendeeName, eventTitle, checkInTime, alreadyCheckedIn }

### Razorpay Types
- `RazorpayOptions` — Checkout modal configuration
- `RazorpaySuccessResponse` — razorpay_payment_id, razorpay_order_id, razorpay_signature
- Global `Window.Razorpay` declaration

---

## 14. Styling & Theming

### Tailwind Config (`tailwind.config.ts`)

**Brand Colors:**
| Name | Hex | Usage |
|------|-----|-------|
| `sacred-green` | #5a7a3d | Accent bar, active states |
| `sacred-burgundy` | #8b2942 | Text, links |
| `sacred-pink` | #e8a0b0 | Lotus accents, hero backgrounds |
| `sacred-cream` | #faf8f5 | Background accents |
| `oss-500` | #ee751c | Primary brand orange |

**Breakpoints:** xs (480px), sm (640px), md (768px), lg (1024px), xl (1280px), 2xl (1536px)

**Custom Animations:** fade-in, slide-in, spin-slow, accordion-down/up

**Font:** Plus Jakarta Sans via `--font-jakarta` CSS variable

### Global CSS (`src/app/globals.css`)

**CSS Utilities:** `gradient-text`, `glass`, `animated-gradient`, `card-hover`, `focus-ring`

**CSS Animations:** shimmer, spin-slow, float, ripple, bounce-slow, heartbeat, border-glow, slide-in-left/right/up/down

**Other:** Custom scrollbar, Lenis styles, light/dark theme CSS variables

---

## 15. Assets & Media

All stored in **Supabase Storage** under the `Assets` bucket.

**Asset structure:**
```
Assets/
├── brand/          # logo.png, logo-white.png, favicon.ico
├── hero/           # main.webp, background.webp
├── classes/        # placeholder.webp, yoga.webp, meditation.webp, fitness.webp
├── events/         # placeholder.webp, workshop.webp, seminar.webp
├── space/          # main.webp, gallery-1/2/3.webp
├── about/          # team.webp, story.webp
├── icons/          # calendar.svg, location.svg, clock.svg
├── backgrounds/    # pattern.svg, gradient.webp
├── videos/         # hero-background.mp4, classes-promo.mp4, space-tour.mp4, events-highlight.mp4
└── passes/         # QR code images (auto-generated)
```

Access via `getAssetUrl('path/to/file')` → `{SUPABASE_URL}/storage/v1/object/public/Assets/path/to/file`

---

## 16. Authentication & Authorization

### Admin Auth Flow

1. Admin goes to `{ADMIN_ROUTE_PREFIX}/login`
2. Submits email + password
3. `adminAuth` function validates:
   - Email against `ADMIN_ALLOWED_EMAILS` (comma-separated)
   - Password against `ADMIN_PASSWORD` using `timingSafeCompare`
4. On success: generates 64-char hex token → hashes with SHA-256 → stores hash in `AdminSession` → sets raw token as `admin_token` cookie:
   - `HttpOnly` — not accessible via JavaScript
   - `Secure` — HTTPS only (in production)
   - `SameSite=Strict` — CSRF protection
   - Expires: 24 hours
5. All admin endpoints call `verifyAdminSession(event)`:
   - Parses cookie → validates token format (64 hex chars) → hashes token → looks up `hashedToken` in DB → checks expiry
6. Logout: `DELETE /api/adminAuth` → clears cookie + deletes session from DB

### Admin Auth Guard (Frontend)
- `AdminLayout` calls `adminApi.listBookings({ limit: 1 })` on mount
- On failure → redirects to `{ADMIN_ROUTE_PREFIX}/login`
- `{ADMIN_ROUTE_PREFIX}/login` page uses a separate layout (skips the auth guard)

### Public Endpoints
No authentication required. Protected only by rate limiting and CORS.

---

## 17. Security Model

| Layer | Implementation |
|-------|----------------|
| **Rate Limiting** | In-memory per-container (see RATE_LIMITS table above) |
| **CORS** | Origin validation against allowlist (`localhost:3000`, `localhost:8888`, `APP_BASE_URL`) |
| **Admin Auth** | HttpOnly + Secure + SameSite=Strict cookies, 64-char hex tokens, SHA-256 hashed in DB |
| **Password Check** | Timing-safe comparison to prevent timing attacks |
| **Webhook Auth** | HMAC-SHA256 signature verification for Razorpay |
| **Input Sanitization** | XSS prevention via `sanitizeString()`, template param sanitization |
| **Image Upload** | Magic byte validation (JPEG/PNG/GIF/WebP only) |
| **ID Generation** | `crypto.randomBytes()` — no `Math.random()` for security-sensitive values |
| **Response Headers** | X-Frame-Options DENY, X-Content-Type-Options nosniff, HSTS, CSP |
| **Security Logging** | `logSecurityEvent()` for AUTH_FAILURE, RATE_LIMIT, INVALID_SIGNATURE events |
| **Pass ID Format** | `OSS-EV-XXXXXXXX` with regex validation `/^OSS-EV-[A-Z0-9]{8}$/` |
| **Route Obfuscation** | Admin panel at randomized path (`ADMIN_ROUTE_PREFIX`) instead of `/admin` — reduces automated scanner noise |

---

## 18. Payment Flow (Razorpay)

```
Frontend                          Backend                           Razorpay
───────                          ───────                           ────────
1. User clicks "Pay"
   │
   ├─→ usePayment.initiatePayment(bookingId)
   │    ├── Load Razorpay script (checkout.js)
   │    ├── POST /api/createRazorpayOrder { bookingId }
   │    │                                 │
   │    │                    ┌─────────────┘
   │    │                    ├── Find booking in DB
   │    │                    ├── Create Payment record (status: CREATED)
   │    │                    ├── Create Razorpay order ──────────→ Razorpay API
   │    │                    │                         ←────────── orderId
   │    │                    └── Return { orderId, keyId, amount, ... }
   │    │
   │    ├── Open Razorpay checkout modal
   │    │         │
   │    │         └── User pays ──────────────────────→ Razorpay processes
   │    │                                              │
   │    │                                              ├── POST /api/razorpayWebhook
   │    │                                              │   (payment.captured)
   │    │                                              │         │
   │    │                                              │    ┌────┘
   │    │                                              │    ├── Verify HMAC-SHA256 signature
   │    │                                              │    ├── Update Payment → PAID
   │    │                                              │    ├── Update Booking → CONFIRMED
   │    │                                              │    ├── CLASS: increment spotsBooked
   │    │                                              │    ├── EVENT: create EventPass + QR
   │    │                                              │    └── Log notification
   │    │
   │    └── handler callback fires
   │         └── router.push('/success?bookingId=...')
   │
2. /success page polls getBooking until CONFIRMED
   └── Shows booking details, event pass QR, etc.
```

**Note:** `createRazorpayOrder` currently uses a mock order ID — the real Razorpay API call is commented out.

---

## 19. User Flows

### Class Booking
1. `/classes` → `useClasses()` fetches from `getClasses`
2. User selects class → booking dialog opens
3. Fills name, phone, email → `createBooking(type: CLASS, classSessionId)`
4. Redirected to payment → Razorpay checkout
5. On success → `/success?bookingId=...` polls until CONFIRMED

### Event Booking
1. `/events` → `useEvents()` fetches from `getEvents`
2. User selects event → booking dialog opens
3. Fills name, phone, email → `createBooking(type: EVENT, eventId)`
4. Redirected to payment → Razorpay checkout
5. On success → `/success?bookingId=...` shows event pass with QR code

### Space Request
1. `/space-enquiry` → user fills form
2. `createBooking(type: SPACE, preferredSlots, purpose, notes)`
3. SpaceRequest created in DB (status: REQUESTED, no payment)
4. Admin reviews at `{ADMIN_ROUTE_PREFIX}/space` → updates status via `adminUpdateSpaceRequest`
5. Status workflow: REQUESTED → APPROVED_CALL_SCHEDULED → CONFIRMED / DECLINED / etc.

### Pass Verification
1. Attendee shows QR code → scanned → opens `/verify?passId=OSS-EV-XXXXXXXX`
2. `verifyPass` checks pass in DB → shows validity + attendee info
3. Admin uses `{ADMIN_ROUTE_PREFIX}` dashboard → `adminCheckinPass` → marks CHECKED_IN with timestamp

---

## 20. Environment Variables

| Variable | Required | Used By | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | Yes | Prisma | PostgreSQL connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Frontend + assets | Supabase project URL |
| `SUPABASE_URL` | Yes | Functions | Supabase URL (server-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Functions | Supabase service role for Storage uploads |
| `SUPABASE_STORAGE_BUCKET` | No | uploadQrToSupabase | Storage bucket name (default: `passes`) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Yes | Frontend | Razorpay public key for checkout |
| `RAZORPAY_KEY_ID` | Yes | createRazorpayOrder | Razorpay server key |
| `RAZORPAY_KEY_SECRET` | Yes | createRazorpayOrder | Razorpay server secret |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | razorpayWebhook | Webhook HMAC verification |
| `ADMIN_ALLOWED_EMAILS` | Yes | adminAuth | Comma-separated admin emails |
| `ADMIN_PASSWORD` | Yes | adminAuth | Admin login password |
| `APP_BASE_URL` | Yes | CORS, webhooks | Production app URL |
| `NEXT_PUBLIC_APP_URL` | No | Frontend | App URL for client-side use |
| `WHATSAPP_PHONE_NUMBER_ID` | No | sendWhatsApp | WhatsApp Business phone number ID |
| `WHATSAPP_TOKEN` | No | sendWhatsApp | WhatsApp API token |
| `ALLOW_DEV_ENDPOINTS` | No | devConfirmPayment | Set to `true` to enable dev endpoints |
| `DEV_SECRET` | No | devConfirmPayment | Secret for dev endpoint auth |
| `NODE_ENV` | Auto | Various | `development` / `production` |

---

## 21. NPM Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `next dev` | Start Next.js dev server (use `npx netlify dev` for full stack) |
| `build` | `prisma generate && next build` | Generate Prisma client + build Next.js |
| `start` | `next start` | Run production build |
| `lint` | `next lint` | ESLint |
| `db:push` | `prisma db push` | Push schema to DB (no migrations) |
| `db:migrate` | `prisma migrate dev` | Run Prisma migrations |
| `db:studio` | `prisma studio` | Open Prisma Studio GUI |
| `db:seed` | `npx tsx prisma/seed.ts` | Seed database |

**Important:** For local development with Netlify Functions, run `npx netlify dev` instead of `npm run dev`. The Netlify CLI wraps Next.js and also serves the serverless functions.

---

## 22. Deployment (Netlify)

1. Connect repository to Netlify
2. Set all environment variables in Netlify dashboard
3. Build runs automatically:
   - `npm run build` → `prisma generate && next build`
   - Publish directory: `.next`
   - Functions bundled from `netlify/functions/` with esbuild
4. Plugin: `@netlify/plugin-nextjs` handles SSR/ISR
5. Redirects: `/api/*` → `/.netlify/functions/:splat`
6. Security headers applied globally via `netlify.toml`

---

## 23. Known Gaps

| Issue | Details |
|-------|---------|
| No tests | No test files exist (no `*.test.*`, `*.spec.*`, `__tests__/`) |
| No CI/CD | No GitHub Actions or pipeline config |
| No `.env.example` | Referenced in README but file doesn't exist |
| Razorpay partially mocked | `createRazorpayOrder` uses mock order IDs; real API call is commented out |
| WhatsApp not active | `sendWhatsApp.ts` is scaffolded but never called in flows |
| Rate limiting is per-container | In-memory store; not shared across serverless instances |
| README says Next.js 14 | Project actually uses Next.js 16 |

---

## 24. Change Log

All changes made by Claude are documented here.

### 2026-03-08

#### Fix: Netlify Functions returning 404 in local development

**Problem:** Running `npm run dev` (which executes `next dev`) only starts the Next.js server. Netlify Functions at `netlify/functions/` are not served by Next.js, so all requests to `/.netlify/functions/*` returned 404.

**Root Cause:** The project uses Netlify Functions as its backend, but the dev script only launched Next.js. The Netlify CLI (`netlify dev`) is required to serve both Next.js and Netlify Functions together locally.

**Fix:** Installed `netlify-cli` as a dev dependency and switched to using `npx netlify dev` for local development.

```
npm install -D netlify-cli && npx netlify dev
```

**Files affected:** `package.json` (new dev dependency: `netlify-cli`)

---

#### Fix: Double scrollbar on page load (content scrollbar appearing alongside page scrollbar)

**Problem:** On the home page and most other public pages, an extra scrollbar appeared on initial load that scrolled the content area independently of the page. This second scrollbar disappeared after scrolling to the bottom.

**Root Cause:** The CSS specification states that when `overflow-x` is set to `hidden`, the browser automatically computes `overflow-y` as `auto` (instead of `visible`). This turns the element into a scroll container in the Y direction.

The `overflow-x-hidden` class was applied at three nested levels:
1. Public layout wrapper: `<div className="flex min-h-screen flex-col overflow-x-hidden">`
2. Main element: `<main className="flex-1 overflow-x-hidden pt-[88px]">`
3. Every individual page wrapper: `<div className="overflow-x-hidden">`

Each of these became an independent scroll container, causing the double scrollbar. The `html { overflow-x: hidden }` rule in `globals.css` already handles horizontal overflow at the document level, making all of these redundant.

**Fix:** Removed all `overflow-x-hidden` classes from layout and page wrappers. Horizontal overflow is already clipped by the `html` element rule in `globals.css`.

**Files affected (11 files):**
- `src/app/(public)/layout.tsx` — removed from wrapper div and main
- `src/app/(public)/page.tsx` — removed from page wrapper
- `src/app/(public)/events/page.tsx` — removed from page wrapper
- `src/app/(public)/classes/page.tsx` — removed from page wrapper
- `src/app/(public)/workshops/page.tsx` — removed from page wrapper
- `src/app/(public)/book-space/page.tsx` — removed from page wrapper
- `src/app/(public)/co-working-space/page.tsx` — removed from page wrapper
- `src/app/(public)/community/page.tsx` — removed from page wrapper
- `src/app/(public)/initiatives/page.tsx` — removed from page wrapper
- `src/app/(public)/visit/page.tsx` — removed from page wrapper

---

### Enhancement: Admin Login & Dashboard Brand Redesign

**Problem:** The admin login page used a generic lock icon with default shadcn/ui styling (orange button, plain gray background). The dashboard sidebar used a placeholder "O" square instead of the actual OSS logo. None of the admin UI used the brand color palette.

**Changes:**

#### Admin Login Page (`src/app/oss-ctrl-9x7k2m/login/page.tsx`)
- Replaced the lock icon with the actual OSS logo (`brand/logo.png` from Supabase Storage)
- Background changed to `sacred-cream` (#faf8f5) with a subtle radial gradient using brand green/pink
- Added a gradient accent bar at the top of the card (sacred-green → sacred-burgundy → sacred-green)
- Title changed to "Admin Portal" in sacred-burgundy color
- Sign-in button uses `sacred-green` with hover state using `sacred-green-dark`
- Input field icons use sacred-green tinting
- Error banner uses explicit red styling instead of shadcn destructive
- Removed `CardHeader`/`CardTitle`/`CardDescription` in favor of a cleaner custom header with logo

#### Admin Layout Sidebar (`src/app/oss-ctrl-9x7k2m/layout.tsx`)
- Replaced the "O" placeholder square with the actual OSS logo image
- Logo area now shows "OSS Admin" in sacred-burgundy with "Management Portal" subtitle
- Active nav items use `sacred-green` background with white text + subtle green shadow
- Inactive nav items hover to `sacred-cream` background with sacred-green text
- Sidebar border uses `sacred-cream-dark`
- Added "Menu" section label above nav items
- Logout button hovers to sacred-burgundy color with sacred-pink background
- Mobile header updated with matching brand logo and colors
- Auth loading screen uses sacred-cream background with sacred-green spinner
- Extracted `SidebarContent` component to avoid code duplication between desktop and mobile

#### Admin Dashboard Page (`src/app/oss-ctrl-9x7k2m/page.tsx`)
- Dashboard heading uses sacred-burgundy color
- Stats card icons/backgrounds updated to brand palette:
  - Bookings: sacred-green
  - Classes: sacred-burgundy
  - Events: sacred-pink-dark
  - Space Requests: sacred-green-dark on sacred-cream
- Revenue card uses a sacred-green gradient background with green-tinted border
- Pending space request badge uses sacred-burgundy instead of orange

**Brand colors used (from `tailwind.config.ts`):**
- `sacred-green` (#5a7a3d) — primary action color, nav active states
- `sacred-burgundy` (#8b2942) — headings, secondary accents
- `sacred-pink` (#e8a0b0) — subtle backgrounds, highlights
- `sacred-cream` (#faf8f5) — page backgrounds, hover states

---

### Enhancement: Industry-Level Database Schema + RLS

**Problem:** The database schema had several issues:
1. **Field name mismatch**: Prisma used `name`/`phone`/`email` on Booking, but the frontend expected `customerName`/`customerPhone`/`customerEmail` — causing `undefined` values in the UI
2. **Missing timestamps**: `NotificationLog` lacked `updatedAt`; no `sentAt` tracking
3. **No soft deletes**: Records were permanently deleted with no recovery option
4. **No optimistic locking**: Concurrent updates could overwrite each other
5. **UUID IDs**: Non-sortable, longer format than necessary
6. **Missing indexes**: No composite indexes for common query patterns
7. **No cascading rules**: Relations used default cascade behavior
8. **Missing audit fields**: Admin sessions didn't track IP or user agent
9. **No RLS**: Database had no Row Level Security policies

**Schema Changes (`prisma/schema.prisma`):**

1. **IDs**: Switched from `@default(uuid())` to `@default(cuid())` — CUIDs are sortable, collision-resistant, and URL-friendly
2. **Table names**: Added `@@map("snake_case")` to all 9 models for PostgreSQL naming convention
3. **Column names**: Added `@map("snake_case")` to all camelCase fields for proper DB column naming
4. **Booking model**:
   - Renamed `name` → `customerName`, `phone` → `customerPhone`, `email` → `customerEmail`
   - Added `cancelledAt`, `cancelReason` for cancellation tracking
   - Added `version` for optimistic concurrency control
   - Added `metadata Json?` for flexible extensions
   - Added `deletedAt` for soft deletes
   - Added composite indexes: `(type, status)`, `(customerEmail, type)`, `(type, createdAt)`, `(deletedAt)`
   - Added `onDelete: SetNull` on relations
5. **Payment model**:
   - Added `refundedAt`, `refundAmountPaise` for refund tracking
   - Added `bookingId` index
   - Added `onDelete: Cascade` from Booking
6. **ClassSession model**:
   - Added `instructor` and `location` fields
   - Added `endsAt` for explicit end times
   - Added `deletedAt` for soft deletes
   - Added composite index `(active, startsAt)`
7. **Event model**:
   - Added `endsAt` for explicit end times
   - Added `deletedAt` for soft deletes
   - Added composite index `(active, startsAt)`
8. **EventPass model**:
   - Added composite index `(eventId, checkInStatus)`
   - Added `onDelete: Cascade` on both relations
9. **SpaceRequest model**:
   - Renamed `name` → `customerName`, `phone` → `customerPhone`, `email` → `customerEmail`
   - Added `deletedAt` for soft deletes
   - Added composite index `(status, createdAt)`
10. **NotificationLog model**:
    - Added `updatedAt` timestamp
    - Added `sentAt` for delivery tracking
    - Added composite index `(channel, status)`
    - Added `onDelete: SetNull` from Booking
11. **StatusHistory model**:
    - Added composite index `(bookingId, createdAt)`
    - Added `onDelete: Cascade` from Booking
12. **AdminSession model**:
    - Added `ipAddress` and `userAgent` for security auditing
    - Added `lastActivityAt` for session monitoring
    - Added `expiresAt` index

**Function Updates (14 files):**
- `createBooking.ts` — `name`→`customerName`, `phone`→`customerPhone`, `email`→`customerEmail` in Prisma create calls; relaxed `.uuid()` to `.string().min(1).max(30)` for CUID support
- `createRazorpayOrder.ts` — `booking.name`→`booking.customerName`, etc.; updated ID validation
- `razorpayWebhook.ts` — `booking.phone`→`booking.customerPhone` in notification logs
- `devConfirmPayment.ts` — same field renames + ID validation update
- `getBooking.ts` — replaced `UUID_REGEX` with `ID_REGEX` that accepts both CUID and UUID formats
- `adminListBookings.ts` — `name`→`customerName`, `email`→`customerEmail` in search filter
- `adminListPasses.ts` — `booking.name`→`booking.customerName`, etc. in select + response mapping; updated ID validation
- `verifyPass.ts` — `booking.name`→`booking.customerName` in select + response
- `adminCheckinPass.ts` — `booking.name`→`booking.customerName` in select + response
- `adminUpdateSpaceRequest.ts` — `spaceRequest.phone`→`spaceRequest.customerPhone`; updated ID validation
- `adminUpdateEvent.ts` — updated ID validation from `.uuid()` to `.min(1).max(30)`
- `adminUpdateClass.ts` — updated ID validation from `.uuid()` to `.min(1).max(30)`
- `adminAuth.ts` — now saves `ipAddress` and `userAgent` on session creation
- `prisma/seed.ts` — added `instructor`, `location`, `endsAt` to seed data

**Frontend Updates:**
- `src/types/index.ts` — added new fields: `cancelledAt`, `cancelReason`, `version`, `metadata`, `deletedAt` on Booking; `instructor`, `location`, `endsAt`, `deletedAt` on ClassSession; `endsAt`, `deletedAt` on Event; renamed SpaceRequest fields to `customerName`/`customerPhone`/`customerEmail`; added `sentAt`, `updatedAt` to NotificationLog; added `refundedAt`, `refundAmountPaise` to Payment
- `src/app/(public)/success/page.tsx` — fixed bug referencing non-existent `spaceRequest.preferredDate` and `spaceRequest.duration`; now shows `purpose` and `status` instead

**RLS Policies (`prisma/rls-policies.sql`):**

Created comprehensive Row Level Security for all 9 tables:
- **Default deny**: All tables deny `anon` role for SELECT, INSERT, UPDATE, DELETE
- **Public read exceptions**: `class_sessions` and `events` allow `anon` SELECT for active, non-deleted records only
- **service_role bypass**: Netlify Functions connect via `service_role` key which bypasses RLS
- **Forced RLS**: All tables use `FORCE ROW LEVEL SECURITY` to prevent accidental bypass by table owners
- **Idempotent**: Script drops existing policies before creating new ones
- **Verification**: Includes a check block that warns if RLS is not enabled on any table

**How to apply changes:**
```bash
# Reset the database and apply new schema
npx prisma db push --force-reset

# Re-seed with updated data
npx prisma db seed

# Apply RLS policies in Supabase SQL Editor
# Copy and paste prisma/rls-policies.sql
```

---

### Feature: Auto-Deactivate Expired Classes & Events

**Problem:** Classes and events that had already passed their scheduled time still showed as "Active" in the admin dashboard. Admins had to manually deactivate each one.

**Solution:**

#### Backend Auto-Deactivation
- `adminListClasses.ts` — on every list request, auto-deactivates classes that ended more than 24 hours ago (`startsAt + 24h < now`). Also computes `isExpired` flag by checking if `startsAt + duration` is in the past.
- `adminListEvents.ts` — same logic for events. Uses `endsAt` if available, otherwise falls back to `startsAt`.

#### Frontend Visual Distinction
- `src/app/oss-ctrl-9x7k2m/classes/page.tsx` — shows amber "Expired" badge instead of gray "Inactive" when a class was auto-deactivated due to time passing
- `src/app/oss-ctrl-9x7k2m/events/page.tsx` — same amber "Expired" badge for past events

**Badge states:**
- **Active** (green) — upcoming, bookable
- **Expired** (amber) — time has passed, auto-deactivated
- **Inactive** (gray) — manually deactivated by admin

---

### Feature: Class & Event Enhancements (Duration, Recurring, Pricing, Time Slots)

Six interconnected features were added to classes and events.

#### 1. Schema Changes (`prisma/schema.prisma`)
- New enum `PricingType` (`PER_SESSION`, `PER_MONTH`)
- `ClassSession.capacity` changed from `Int` to `Int?` (nullable = unlimited)
- New fields on `ClassSession`:
  - `isRecurring Boolean @default(false)` — marks a class as recurring
  - `recurrenceDays Int[] @default([])` — days of week (0=Sun..6=Sat)
  - `timeSlots Json?` — array of `{ startTime: "HH:MM", endTime: "HH:MM" }`
  - `pricingType PricingType @default(PER_SESSION)` — controls price label

#### 2. Backend Function Updates
- `adminCreateClass.ts` & `adminUpdateClass.ts` — Zod schemas accept `isRecurring`, `recurrenceDays`, `timeSlots`, `pricingType`, `instructor`, `location`, `endsAt`. Capacity is `.min(0).optional().nullable()`.
- `adminCreateEvent.ts` & `adminUpdateEvent.ts` — Accept `endsAt` date string for multi-day events.
- `createBooking.ts` — Capacity null-check: skip overbooking validation when capacity is null.
- `razorpayWebhook.ts` — Same null-capacity guard on the overbooking check.

#### 3. Frontend Types (`src/types/index.ts`)
- New `TimeSlot` interface and `PricingType` type alias.
- `ClassSession.capacity` changed to `number | null`.
- Added `isRecurring`, `recurrenceDays`, `timeSlots`, `pricingType` optional fields.

#### 4. Admin Classes Page (`src/app/oss-ctrl-9x7k2m/classes/page.tsx`)
Complete form redesign:
- **Pricing toggle**: Radio-style buttons for "Per Session" / "Per Month". Label changes accordingly.
- **Recurring toggle**: Custom switch in a bordered section. When ON, shows:
  - Day picker: 7 circular buttons (Sun-Sat) for `recurrenceDays`.
  - Time slots: Dynamic list of start/end time inputs with Add/Remove.
- **Capacity**: "Unlimited" toggle — when enabled, capacity is null. Otherwise a numeric input (min 0).
- **Table columns updated**: "Date & Time" → "Schedule" (shows "Every Thu" for recurring), new "Time" column (shows time slot range), "Price" appends "/mo" or "/session", "Capacity" shows "Unlimited" when null.

#### 5. Admin Events Page (`src/app/oss-ctrl-9x7k2m/events/page.tsx`)
- Added "End Date" date picker + "End Time" input to the form.
- Table "Date & Time" column uses range format:
  - Same day: "Mar 8, 2026 · 5:00 PM - 8:00 PM"
  - Multi-day same month: "Mar 3 - 5, 2026"
  - Multi-month: "Mar 28 - Apr 2, 2026"

#### 6. Public Classes Page (`src/app/(public)/classes/page.tsx`)
- `formatClassSchedule()` — new helper that produces:
  - One-off: "Monday · 5:00 PM - 6:00 PM"
  - Recurring: "Every Thursday · 4:00 PM - 5:00 PM"
  - Recurring multi-day: "Every Sun & Wed · 10:00 AM - 12:00 PM"
- Hover card: price shows "/mo" or "/session" suffix, capacity shows "Unlimited" when null, multiple time slots listed with numbering.
- isPast logic skipped for recurring classes.

#### 7. Public Events Page (`src/app/(public)/events/page.tsx`)
- `formatEventSchedule()` — new helper for date ranges:
  - Same day: "Saturday · 5:00 PM - 8:00 PM"
  - Multi-day: "March 3 - 5, 2026"
- isPast logic uses `endsAt` when available.

#### 8. Seed Data (`prisma/seed.ts`)
Updated to demonstrate all feature combinations:
- Yoga: recurring Thu, 2 time slots, monthly pricing (₹2000/mo), unlimited capacity
- Pottery: recurring Sun & Wed, 1 slot, monthly pricing (₹3500/mo), 10 capacity
- Digital Art: one-off, per-session ₹800, 12 capacity
- Photography: one-off, per-session ₹1000, 20 capacity
- Art Exhibition: multi-day event (3 days)
- Other events: same-day with start/end times

#### Migration Steps
```bash
# Push schema changes
npx prisma db push --force-reset

# Re-seed with updated data
npx prisma db seed
```

---

### 2026-03-10

#### Database Hardening: Constraints, Inventory Ledger, Token Hashing, Timestamptz

A comprehensive database hardening upgrade across 6 phases. All changes preserve existing data — no destructive migrations.

**New file:** `prisma/migration-v2.sql` — Single SQL migration script to run in Supabase SQL Editor after `prisma db push`. Contains all database-level changes (constraints, triggers, views, indexes).

---

##### Phase 1: Schema Safety

**1A. CHECK Constraints (7 constraints added)**

Defensive guardrails to prevent invalid data at the database level:

| Table | Constraint | Rule |
|-------|-----------|------|
| `bookings` | `chk_booking_amount` | `amount_paise >= 0` |
| `payments` | `chk_payment_amount` | `amount_paise >= 0` |
| `payments` | `chk_refund_amount` | `refund_amount_paise IS NULL OR >= 0` |
| `class_sessions` | `chk_class_price` | `price_paise >= 0` |
| `class_sessions` | `chk_capacity` | `capacity IS NULL OR spots_booked <= capacity` |
| `class_sessions` | `chk_spots_booked_nonneg` | `spots_booked >= 0` |
| `events` | `chk_event_price` | `price_paise >= 0` |

**1B. Booking Integrity Trigger**

Ensures exactly one of `class_session_id`, `event_id`, or `space_request_id` is set on each non-deleted booking. Uses a trigger (not CHECK) so soft-deleted records with NULL FKs don't violate the constraint.

```sql
CREATE TRIGGER trg_booking_fk_integrity
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION check_booking_fk_integrity();
```

**1C. onDelete: SetNull → Restrict**

Changed `Booking.classSession`, `Booking.event`, and `Booking.spaceRequest` foreign key cascade behavior from `SetNull` to `Restrict`. Prevents hard-deleting referenced entities that have bookings — use soft delete instead.

**Files changed:** `prisma/schema.prisma`

**1D. Partial Indexes**

Added two partial FK indexes on bookings for JOIN performance:

```sql
CREATE INDEX idx_booking_event_id ON bookings(event_id) WHERE event_id IS NOT NULL;
CREATE INDEX idx_booking_class_session_id ON bookings(class_session_id) WHERE class_session_id IS NOT NULL;
```

Also added corresponding `@@index` entries in Prisma schema for `eventId` and `classSessionId`.

---

##### Phase 2: Timestamp Safety

**2A. timestamp → timestamptz**

Converted all `DateTime` columns across all 9 tables from `timestamp(3)` to `timestamptz(3)` (timezone-aware). Added `@db.Timestamptz(3)` to every `DateTime` field in `prisma/schema.prisma`.

Migration is in-place: `ALTER TABLE ... ALTER COLUMN ... TYPE timestamptz USING ... AT TIME ZONE 'UTC'`. Existing values are reinterpreted as UTC (which they already are since Prisma stores UTC).

**2B. payment_expires_at column**

Added `paymentExpiresAt DateTime? @map("payment_expires_at") @db.Timestamptz(3)` to the `Payment` model. Existing records are backfilled with `created_at + 15 minutes`. This explicit expiry is cleaner than deriving it from booking timestamps.

**Files changed:** `prisma/schema.prisma`, `src/types/index.ts` (added `paymentExpiresAt` to `Payment` interface)

---

##### Phase 3: Security Hardening

**3A. Hashed Admin Tokens**

**Problem:** Admin session tokens were stored as raw hex strings in the `admin_sessions` table. If the database is compromised, all active admin sessions could be hijacked.

**Solution:** Hash tokens with SHA-256 before storing in the database. The raw token is sent to the client in cookies; only the hash lives in the DB.

**Schema change:** Added `hashedToken String? @unique @map("hashed_token")` to `AdminSession` model. The old `token` column is kept temporarily for backward compatibility (removed in a future migration after all sessions rotate).

**New helper:** `hashToken(token: string): string` in `netlify/functions/helpers/security.ts` — creates SHA-256 hex digest.

**Code changes:**
- `adminAuth.ts` — On login: stores both raw `token` and `hashedToken`. On logout/session check: looks up by `hashedToken`.
- `verifyAdmin.ts` — `verifyAdminSession()` now hashes the cookie token before DB lookup. Deletes expired sessions by `id` instead of `token`.

**Effect on existing sessions:** Existing sessions with only a raw token will be invalidated. Admins must log in again after deployment — this is expected for a security upgrade.

**3B. Audit Log Immutability**

`status_history` is now append-only via a database trigger:

```sql
CREATE TRIGGER trg_status_history_immutable
  BEFORE UPDATE OR DELETE ON status_history
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
```

Uses a trigger (not PostgreSQL RULE) as recommended by modern Postgres best practices.

---

##### Phase 4: Inventory Ledger

**Problem:** The mutable `spots_booked` counter on `ClassSession` had a TOCTOU race condition. Two concurrent requests could both read the same counter value, both pass the capacity check, and both create bookings — resulting in overbooking.

**Solution:** Inventory Ledger pattern — derive availability from the count of confirmed/pending bookings instead of maintaining a mutable counter.

**Database views:**
```sql
CREATE VIEW class_availability AS
  SELECT cs.id, cs.capacity, COUNT(bookings) AS booked_count,
         capacity - booked_count AS available_spots ...

CREATE VIEW event_availability AS
  SELECT e.id, e.capacity, COUNT(bookings) AS booked_count,
         capacity - booked_count AS available_spots ...
```

**Code changes:**

| File | Change |
|------|--------|
| `createBooking.ts` | Replaced `spotsBooked` check with `prisma.booking.count()` query inside a `$transaction` for atomic capacity verification. Both pre-check (outside transaction, fast fail) and re-check (inside transaction, race-safe) are performed. |
| `razorpayWebhook.ts` | Removed `spotsBooked` increment from payment confirmation transaction — the CONFIRMED booking itself is the inventory record. |
| `devConfirmPayment.ts` | Same removal of `spotsBooked` increment. |
| `getClasses.ts` | Now includes `_count.bookings` and returns `bookedCount` and `availableSpots` in the API response. |
| `getEvents.ts` | Same derived availability in API response. |
| `src/types/index.ts` | Added `bookedCount?: number` and `availableSpots?: number | null` to `ClassSession` and `Event` interfaces. |

**Note:** The `spotsBooked` column is kept in the schema for backward compatibility. It is no longer incremented by any code path. It can be removed in a future migration once the admin dashboard and any direct SQL queries are verified to use derived counts.

---

##### Phase 5: Booking Expiration

**5A. updated_at Database Trigger**

Ensures `updated_at` is set correctly even for direct SQL operations (pg_cron, admin scripts). Applied to all 7 tables that have `updated_at`:

```sql
CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
-- ... repeated for payments, class_sessions, events, event_passes, space_requests, notification_logs
```

**5B. Expiration Partial Index**

```sql
CREATE INDEX idx_booking_pending_expiry ON bookings(created_at) WHERE status = 'PENDING_PAYMENT';
```

Only indexes pending bookings — stays tiny and makes expiration queries instant.

**5C. pg_cron Job (commented out)**

The migration file includes a commented-out `cron.schedule()` call that expires unpaid bookings older than 15 minutes, running every 5 minutes. Uncomment and run in Supabase SQL Editor once pg_cron is enabled:

```sql
SELECT cron.schedule('expire-unpaid-bookings', '*/5 * * * *', $$
  UPDATE bookings SET status = 'EXPIRED'
  WHERE status = 'PENDING_PAYMENT' AND created_at < NOW() - INTERVAL '15 minutes';
$$);
```

---

##### Phase 6: Frontend Type Updates

**`src/types/index.ts`:**
- `Payment` — added `paymentExpiresAt?: string | null`
- `ClassSession` — added `bookedCount?: number`, `availableSpots?: number | null`
- `Event` — added `bookedCount?: number`, `availableSpots?: number | null`

---

##### How to Apply

```bash
# 1. Push Prisma schema changes (preserves existing data)
npx prisma db push

# 2. Run the migration SQL in Supabase SQL Editor
# Copy and paste prisma/migration-v2.sql

# 3. Regenerate Prisma client
npx prisma generate

# 4. Admins will need to log in again (tokens are now hashed)
```

**Files changed (13 files):**
- `prisma/schema.prisma` — timestamptz, onDelete Restrict, hashedToken, paymentExpiresAt, new indexes
- `prisma/migration-v2.sql` — NEW: complete SQL migration (constraints, triggers, views, indexes, pg_cron)
- `netlify/functions/helpers/security.ts` — added `hashToken()` function
- `netlify/functions/helpers/verifyAdmin.ts` — uses hashed token lookup
- `netlify/functions/adminAuth.ts` — stores hashed tokens, looks up by hash
- `netlify/functions/createBooking.ts` — inventory ledger with transactional capacity check
- `netlify/functions/razorpayWebhook.ts` — removed spotsBooked increment
- `netlify/functions/devConfirmPayment.ts` — removed spotsBooked increment
- `netlify/functions/getClasses.ts` — returns derived bookedCount and availableSpots
- `netlify/functions/getEvents.ts` — returns derived bookedCount and availableSpots
- `src/types/index.ts` — added paymentExpiresAt, bookedCount, availableSpots

---

#### Security: Obfuscated Admin Route

**Problem:** The admin panel lived at `/admin` — one of the most commonly guessed paths by bots and automated scanners. Even though login is required, exposing the login page reveals that an admin panel exists and invites brute-force attempts.

**Solution:** Renamed the admin route to a random, non-guessable path (`/oss-ctrl-9x7k2m`). This is security through obscurity as an **additional layer** on top of existing protections (rate limiting, hashed tokens, timing-safe password comparison).

**Changes:**

1. **Renamed directory** `src/app/admin/` → `src/app/oss-ctrl-9x7k2m/` — all subpages moved automatically
2. **Added `ADMIN_ROUTE_PREFIX` constant** in `src/lib/constants.ts` — single source of truth for the obfuscated path. To rotate the route, rename the directory and update this one constant.
3. **Updated all hardcoded `/admin` references** to use the constant:
   - `src/app/oss-ctrl-9x7k2m/layout.tsx` — nav items, auth redirects, logo links, active state checks
   - `src/app/oss-ctrl-9x7k2m/page.tsx` — stats card links, "View All" links
   - `src/app/oss-ctrl-9x7k2m/login/page.tsx` — post-login redirect
   - `src/lib/constants.ts` — `ADMIN_NAV_ITEMS` hrefs
4. **Updated `robots.ts`** — disallow rule now uses `ADMIN_ROUTE_PREFIX`
5. **Updated `docs/claude.md`** — all documentation references updated

**What did NOT change:**
- Netlify Function paths (`/.netlify/functions/adminAuth` etc.) — API endpoints stay the same
- Cookie names, token handling, session logic — all untouched
- Public site — no public pages referenced `/admin`

**Files changed (5 files):**
- `src/app/oss-ctrl-9x7k2m/layout.tsx` — all `/admin` refs → `ADMIN_ROUTE_PREFIX`
- `src/app/oss-ctrl-9x7k2m/page.tsx` — all `/admin/*` hrefs → `ADMIN_ROUTE_PREFIX/*`
- `src/app/oss-ctrl-9x7k2m/login/page.tsx` — post-login redirect → `ADMIN_ROUTE_PREFIX`
- `src/lib/constants.ts` — added `ADMIN_ROUTE_PREFIX`, updated `ADMIN_NAV_ITEMS`
- `src/app/robots.ts` — disallow rule uses `ADMIN_ROUTE_PREFIX`
