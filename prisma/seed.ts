import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  const HOUR = 60 * 60 * 1000;

  const classes = await Promise.all([
    // Recurring: Yoga every Thursday, 2 time slots, monthly pricing, unlimited capacity
    prisma.classSession.create({
      data: {
        title: "Yoga for Beginners",
        description:
          "A gentle introduction to yoga poses and breathing techniques. Perfect for those new to yoga or looking to refresh their practice.",
        instructor: "Priya Sharma",
        location: "OSS Studio A",
        startsAt: new Date(now + 7 * DAY),
        duration: 60,
        capacity: null,
        spotsBooked: 3,
        pricePaise: 200000,
        active: true,
        isRecurring: true,
        recurrenceDays: [4],
        timeSlots: [
          { startTime: "07:00", endTime: "08:00" },
          { startTime: "17:00", endTime: "18:00" },
        ],
        pricingType: "PER_MONTH",
      },
    }),

    // Recurring: Pottery every Sun & Wed, 1 slot, monthly pricing
    prisma.classSession.create({
      data: {
        title: "Pottery Workshop",
        description:
          "Learn the art of hand-building pottery. Create your own ceramic pieces to take home!",
        instructor: "Rahul Verma",
        location: "OSS Craft Room",
        startsAt: new Date(now + 10 * DAY),
        duration: 120,
        capacity: 10,
        spotsBooked: 5,
        pricePaise: 350000,
        active: true,
        isRecurring: true,
        recurrenceDays: [0, 3],
        timeSlots: [{ startTime: "10:00", endTime: "12:00" }],
        pricingType: "PER_MONTH",
      },
    }),

    // One-off: Digital Art, per-session pricing
    prisma.classSession.create({
      data: {
        title: "Digital Art Fundamentals",
        description:
          "Master digital illustration using industry-standard tools. Tablets will be provided.",
        instructor: "Ananya Das",
        location: "OSS Media Lab",
        startsAt: new Date(now + 14 * DAY),
        endsAt: new Date(now + 14 * DAY + 90 * 60 * 1000),
        duration: 90,
        capacity: 12,
        spotsBooked: 8,
        pricePaise: 80000,
        active: true,
        isRecurring: false,
        pricingType: "PER_SESSION",
      },
    }),

    // One-off: Photography, per-session pricing
    prisma.classSession.create({
      data: {
        title: "Photography Basics",
        description:
          "Learn composition, lighting, and camera settings. Bring your own camera or smartphone.",
        instructor: "Vikram Singh",
        location: "OSS Studio B",
        startsAt: new Date(now + 5 * DAY),
        endsAt: new Date(now + 5 * DAY + 2 * HOUR),
        duration: 120,
        capacity: 20,
        spotsBooked: 12,
        pricePaise: 100000,
        active: true,
        isRecurring: false,
        pricingType: "PER_SESSION",
      },
    }),
  ]);

  console.log(`Created ${classes.length} class sessions`);

  const events = await Promise.all([
    prisma.event.create({
      data: {
        title: "OSS Open Mic Night",
        description:
          "An evening of music, poetry, and spoken word. Sign up to perform or just enjoy the show!",
        startsAt: new Date(now + 3 * DAY + 18 * HOUR),
        endsAt: new Date(now + 3 * DAY + 21 * HOUR),
        venue: "OSS Main Hall",
        capacity: 100,
        pricePaise: 20000,
        active: true,
      },
    }),

    // Multi-day event: Art Exhibition spanning 3 days
    prisma.event.create({
      data: {
        title: "Art Exhibition: Urban Stories",
        description:
          "A curated exhibition featuring works from emerging local artists exploring urban life. Runs over 3 days.",
        startsAt: new Date(now + 21 * DAY + 10 * HOUR),
        endsAt: new Date(now + 23 * DAY + 18 * HOUR),
        venue: "OSS Gallery",
        capacity: 150,
        pricePaise: 30000,
        active: true,
      },
    }),

    prisma.event.create({
      data: {
        title: "Startup Networking Mixer",
        description:
          "Connect with founders, investors, and tech enthusiasts. Light refreshments included.",
        startsAt: new Date(now + 12 * DAY + 17 * HOUR),
        endsAt: new Date(now + 12 * DAY + 19 * HOUR),
        venue: "OSS Coworking Space",
        capacity: 80,
        pricePaise: 50000,
        active: true,
      },
    }),

    prisma.event.create({
      data: {
        title: "Film Screening: Indie Shorts",
        description:
          "A showcase of independent short films from around the world. Q&A with filmmakers.",
        startsAt: new Date(now + 8 * DAY + 19 * HOUR),
        endsAt: new Date(now + 8 * DAY + 22 * HOUR),
        venue: "OSS Screening Room",
        capacity: 50,
        pricePaise: 25000,
        active: true,
      },
    }),
  ]);

  console.log(`Created ${events.length} events`);
  console.log("Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
