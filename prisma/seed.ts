import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Create sample class sessions
  const classes = await Promise.all([
    prisma.classSession.create({
      data: {
        title: "Yoga for Beginners",
        description: "A gentle introduction to yoga poses and breathing techniques. Perfect for those new to yoga or looking to refresh their practice. Instructor: Priya Sharma",
        startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
        duration: 60,
        capacity: 15,
        spotsBooked: 3,
        pricePaise: 50000, // ₹500
        active: true,
      },
    }),
    prisma.classSession.create({
      data: {
        title: "Pottery Workshop",
        description: "Learn the art of hand-building pottery. Create your own ceramic pieces to take home! Instructor: Rahul Verma",
        startsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        duration: 120,
        capacity: 10,
        spotsBooked: 5,
        pricePaise: 150000, // ₹1500
        active: true,
      },
    }),
    prisma.classSession.create({
      data: {
        title: "Digital Art Fundamentals",
        description: "Master digital illustration using industry-standard tools. Tablets will be provided. Instructor: Ananya Das",
        startsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks from now
        duration: 90,
        capacity: 12,
        spotsBooked: 8,
        pricePaise: 80000, // ₹800
        active: true,
      },
    }),
    prisma.classSession.create({
      data: {
        title: "Photography Basics",
        description: "Learn composition, lighting, and camera settings. Bring your own camera or smartphone. Instructor: Vikram Singh",
        startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
        duration: 120,
        capacity: 20,
        spotsBooked: 12,
        pricePaise: 100000, // ₹1000
        active: true,
      },
    }),
  ]);

  console.log(`✅ Created ${classes.length} class sessions`);

  // Create sample events
  const events = await Promise.all([
    prisma.event.create({
      data: {
        title: "OSS Open Mic Night",
        description: "An evening of music, poetry, and spoken word. Sign up to perform or just enjoy the show!",
        startsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
        venue: "OSS Main Hall",
        capacity: 100,
        pricePaise: 20000, // ₹200
        active: true,
      },
    }),
    prisma.event.create({
      data: {
        title: "Art Exhibition: Urban Stories",
        description: "A curated exhibition featuring works from emerging local artists exploring urban life.",
        startsAt: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 3 weeks from now
        venue: "OSS Gallery",
        capacity: 150,
        pricePaise: 30000, // ₹300
        active: true,
      },
    }),
    prisma.event.create({
      data: {
        title: "Startup Networking Mixer",
        description: "Connect with founders, investors, and tech enthusiasts. Light refreshments included.",
        startsAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000), // 12 days from now
        venue: "OSS Coworking Space",
        capacity: 80,
        pricePaise: 50000, // ₹500
        active: true,
      },
    }),
    prisma.event.create({
      data: {
        title: "Film Screening: Indie Shorts",
        description: "A showcase of independent short films from around the world. Q&A with filmmakers.",
        startsAt: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000), // 8 days from now
        venue: "OSS Screening Room",
        capacity: 50,
        pricePaise: 25000, // ₹250
        active: true,
      },
    }),
  ]);

  console.log(`✅ Created ${events.length} events`);

  console.log("🎉 Database seeded successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
