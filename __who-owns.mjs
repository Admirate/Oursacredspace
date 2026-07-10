import fs from "fs";
import Razorpay from "razorpay";
import { PrismaClient } from "@prisma/client";

const env = Object.fromEntries(
  fs.readFileSync(".env", "utf8").split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
const prisma = new PrismaClient();
const local = new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });

console.log("local .env key:", env.RAZORPAY_KEY_ID.slice(0, 12) + "…\n");

// The Rs450 booking from the screenshot.
const bookings = await prisma.booking.findMany({
  where: { amountPaise: 45000 },
  select: {
    id: true, status: true, createdAt: true,
    payments: { select: { razorpayOrderId: true, status: true, createdAt: true }, orderBy: { createdAt: "asc" } },
  },
  orderBy: { createdAt: "desc" },
  take: 2,
});

for (const b of bookings) {
  const age = ((Date.now() - b.createdAt.getTime()) / 60000).toFixed(0);
  console.log(`booking ${b.id} status=${b.status} age=${age}min payments=${b.payments.length}`);
  for (const p of b.payments) {
    process.stdout.write(`   ${p.razorpayOrderId} dbStatus=${p.status} -> `);
    try {
      const o = await local.orders.fetch(p.razorpayOrderId);
      console.log(`OWNED by local key (status=${o.status}, amount=${o.amount})`);
    } catch (e) {
      const d = e.error?.description ?? e.message;
      console.log(`NOT fetchable with local key: ${String(d).slice(0, 50)}`);
    }
  }
}
await prisma.$disconnect();
