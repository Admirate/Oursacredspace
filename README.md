# OSS Booking System

A production-grade booking + payments + WhatsApp QR pass delivery system for OSS Space.

## Features

- **Class Bookings**: Book classes with instant payment confirmation
- **Event Passes**: Purchase event passes with QR code delivery via WhatsApp
- **Space Booking**: Request space bookings with admin approval workflow
- **Admin Dashboard**: Manage bookings, classes, events, and space requests
- **Payment Integration**: Razorpay (UPI, Cards, Wallets)
- **WhatsApp Notifications**: Instant confirmations and QR passes

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Netlify Functions (Serverless)
- **Database**: Supabase (PostgreSQL)
- **ORM**: Prisma
- **Payments**: Razorpay
- **Notifications**: WhatsApp Cloud API
- **Storage**: Supabase Storage (for QR codes)

## Getting Started

### Prerequisites

- Node.js 18+
- npm or pnpm
- Supabase account
- Razorpay account
- Meta Business account (for WhatsApp API)
- Netlify account

### Installation

1. **Clone and install dependencies**:
   ```bash
   cd OSS
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env.local
   ```
   Fill in all the required values (see Environment Variables section below).

3. **Set up the database**:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run locally**:
   ```bash
   npm run dev
   ```

   Or with Netlify CLI (for serverless functions):
   ```bash
   npx netlify dev
   ```

## Environment Variables

### Frontend (Public)
| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay publishable key |
| `NEXT_PUBLIC_APP_URL` | Your app URL |

### Database
| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Supabase PostgreSQL connection string (with pgbouncer) |
| `DIRECT_URL` | Direct PostgreSQL connection (for migrations) |

### Supabase
| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `SUPABASE_STORAGE_BUCKET` | Storage bucket name (default: "passes") |

### Razorpay
| Variable | Description |
|----------|-------------|
| `RAZORPAY_KEY_ID` | Razorpay key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay secret key |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature secret |

### WhatsApp Cloud API
| Variable | Description |
|----------|-------------|
| `WHATSAPP_TOKEN` | WhatsApp API access token |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp business phone number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | WhatsApp business account ID |

### Admin
| Variable | Description |
|----------|-------------|
| `ADMIN_ALLOWED_EMAILS` | Comma-separated list of admin emails |
| `ADMIN_SESSION_SECRET` | Session encryption secret |

## Project Structure

```
OSS/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (public)/          # Public pages
│   │   │   ├── classes/       # Class listing & booking
│   │   │   ├── events/        # Event listing & passes
│   │   │   ├── book-space/    # Space request form
│   │   │   ├── success/       # Payment success page
│   │   │   └── verify/        # Pass verification
│   │   └── admin/             # Admin dashboard
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── booking/           # Booking components
│   │   ├── admin/             # Admin components
│   │   └── shared/            # Shared components
│   ├── lib/                   # Utilities
│   ├── hooks/                 # React hooks
│   └── types/                 # TypeScript types
├── netlify/
│   └── functions/             # Serverless functions
├── prisma/
│   └── schema.prisma          # Database schema
└── public/                    # Static assets
```

## Supabase Setup

### 1. Create Project
- Go to [Supabase](https://supabase.com) and create a new project
- Note your project URL and service role key

### 2. Database Setup
```bash
# Generate Prisma client
npx prisma generate

# Push schema to Supabase
npx prisma db push
```

### 3. Storage Bucket
1. Go to Supabase Dashboard > Storage
2. Create a new bucket named `passes`
3. Set the bucket to **public** for the `event-passes/` folder
4. Add RLS policy for public read access

## Razorpay Setup

### 1. Get API Keys
- Log in to [Razorpay Dashboard](https://dashboard.razorpay.com)
- Go to Settings > API Keys
- Generate keys for test/live mode

### 2. Configure Webhook
- Go to Settings > Webhooks
- Add webhook URL: `https://your-site.netlify.app/.netlify/functions/razorpayWebhook`
- Select events: `payment.captured`, `payment.failed`
- Copy the webhook secret

## WhatsApp Setup

### 1. Meta Business Setup
- Go to [Meta Business Suite](https://business.facebook.com)
- Set up WhatsApp Business API
- Create a WhatsApp App

### 2. Message Templates
Create these templates in Meta Business Manager:

**booking_event_confirmed**
```
Hello {{1}}! 🎉

Your pass for {{2}} has been confirmed!

📅 Date: {{3}}
📍 Venue: {{4}}
🎫 Pass ID: {{5}}

Your QR code is attached. Show it at the venue for check-in.

See you there!
- OSS Space
```

**booking_class_confirmed**
```
Hello {{1}}! ✨

Your booking for {{2}} is confirmed!

📅 Date: {{3}}
⏰ Time: {{4}}
📍 Location: OSS Space

Booking ID: {{5}}

Looking forward to seeing you!
- OSS Space
```

**space_call_confirmed**
```
Hello {{1}}! 📞

Your consultation call for space booking has been scheduled.

📅 Date: {{2}}
⏰ Time: {{3}}

We'll call you at your registered number to discuss your requirements.

Questions? Reply to this message.
- OSS Space
```

## Deployment

### Netlify Deployment

1. **Connect Repository**:
   - Log in to Netlify
   - Connect your GitHub repository

2. **Configure Build**:
   - Build command: `npm run build`
   - Publish directory: `.next`

3. **Set Environment Variables**:
   - Add all variables from `.env.example`

4. **Deploy**:
   - Push to main branch to trigger deployment

### Post-Deployment

1. Update `NEXT_PUBLIC_APP_URL` and `APP_BASE_URL` with your Netlify URL
2. Update Razorpay webhook URL
3. Test the complete flow

## API Endpoints

### Public
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/createBooking` | POST | Create a new booking |
| `/api/createRazorpayOrder` | POST | Create Razorpay order |
| `/api/getBooking` | GET | Get booking details |
| `/api/getClasses` | GET | List active classes |
| `/api/getEvents` | GET | List active events |
| `/api/verifyPass` | GET | Verify event pass |

### Admin
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/adminAuth` | POST | Admin login |
| `/api/adminListBookings` | GET | List all bookings |
| `/api/adminUpdateSpaceRequest` | POST | Update space request |
| `/api/adminCheckinPass` | POST | Check in event pass |

### Webhook
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/razorpayWebhook` | POST | Razorpay webhook receiver |

## Security Considerations

- ✅ Environment variables never exposed to frontend
- ✅ Razorpay webhook signature verification
- ✅ Admin routes protected with session auth
- ✅ Idempotent webhook processing
- ✅ Input validation with Zod
- ✅ SQL injection prevention via Prisma

## License

Private - OSS Space

## Support

For issues or questions, contact: hello@ossspace.com
