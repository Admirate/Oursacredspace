# Our Sacred Space

A booking and event management system for Our Sacred Space - a cultural and community centre in Secunderabad.

## Features

- 📚 **Classes** - Browse and book classes
- 🎫 **Events** - Get event passes with QR codes
- 🏠 **Space Booking** - Request space rentals
- 👩‍💼 **Admin Dashboard** - Manage everything

## Tech Stack

- Next.js 14 + TypeScript
- Tailwind CSS + shadcn/ui
- Supabase (PostgreSQL)
- Netlify Functions
- Razorpay Payments

## Getting Started

### Prerequisites

- Node.js 18+
- Supabase account
- Netlify account

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Set up database
npx prisma generate
npx prisma db push

# Run development server
npx netlify dev
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your values. See the example file for all required variables.

## Deployment

1. Connect repo to Netlify
2. Set environment variables in Netlify dashboard
3. Deploy

## License

Private - Our Sacred Space
