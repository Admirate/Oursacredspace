/**
 * Deletes BOOKINGS and their payment/audit/notification rows.
 *
 *   node scripts/purge-bookings.mjs                 # dry run — prints what it WOULD delete
 *   node scripts/purge-bookings.mjs --yes           # delete bookings only
 *
 * Content (classes, events, space requests) is NEVER touched unless you ask for
 * it explicitly. These are opt-in because they are things an admin authored by
 * hand, not transactional records, and a hard DELETE of them is unrecoverable
 * without a database restore:
 *
 *   --classes          also delete class_sessions
 *   --events           also delete events
 *   --space-requests   also delete space_requests
 *
 * Before deleting anything it writes a JSON snapshot of every affected row to
 * ./backups/, so a mistake is recoverable without a Supabase restore.
 *
 * This is a HARD delete, not the soft delete (`deletedAt`) the admin dashboard
 * performs. It does not refund anything at Razorpay — orders and captured
 * payments continue to exist there.
 *
 * NOTE: connects via DIRECT_DATABASE_URL (port 5432). The pooled runtime URL
 * runs PgBouncer in transaction mode and cannot hold the ALTER TABLE below
 * inside a transaction.
 */
import fs from "fs";
import path from "path";
import readline from "readline";
import { PrismaClient } from "@prisma/client";

const args = new Set(process.argv.slice(2));
const APPLY = args.has("--yes");
const PURGE_CLASSES = args.has("--classes");
const PURGE_EVENTS = args.has("--events");
const PURGE_SPACE_REQUESTS = args.has("--space-requests");

// --- load DIRECT_DATABASE_URL from .env -------------------------------------
const envPath = path.join(process.cwd(), ".env");
if (!fs.existsSync(envPath)) {
  console.error("No .env found. Run this from the project root.");
  process.exit(1);
}
const env = Object.fromEntries(
  fs.readFileSync(envPath, "utf8").split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()])
);
const url = env.DIRECT_DATABASE_URL || env.DATABASE_URL;
if (!url) {
  console.error("DIRECT_DATABASE_URL (or DATABASE_URL) is not set in .env");
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });

// Show which database is about to be hit. This project shares one Supabase
// instance between local dev and production, so "it's only my dev DB" is a
// dangerous assumption.
const host = (() => {
  try { return new URL(url).host; } catch { return "unknown"; }
})();

const summarise = async () => ({
  statusHistory: await prisma.statusHistory.count(),
  payments: await prisma.payment.count(),
  notificationLogs: await prisma.notificationLog.count(),
  bookings: await prisma.booking.count(),
  ...(PURGE_CLASSES ? { classSessions: await prisma.classSession.count() } : {}),
  ...(PURGE_EVENTS ? { events: await prisma.event.count() } : {}),
  ...(PURGE_SPACE_REQUESTS ? { spaceRequests: await prisma.spaceRequest.count() } : {}),
});

const confirmed = await prisma.booking.count({ where: { status: "CONFIRMED" } });
const paid = await prisma.payment.count({ where: { status: "PAID" } });
const before = await summarise();

console.log(`\ndatabase host: ${host}`);
console.log("\nrows that will be DELETED:");
for (const [table, n] of Object.entries(before)) console.log(`  ${table.padEnd(18)} ${n}`);

const kept = [
  !PURGE_CLASSES && `class_sessions (${await prisma.classSession.count()})`,
  !PURGE_EVENTS && `events (${await prisma.event.count()})`,
  !PURGE_SPACE_REQUESTS && `space_requests (${await prisma.spaceRequest.count()})`,
].filter(Boolean);
if (kept.length) console.log(`\nKEPT: ${kept.join(", ")}`);

console.log(`\n  ${confirmed} CONFIRMED bookings and ${paid} PAID payments are among these.`);
console.log("  Nothing is refunded at Razorpay.");

if (!APPLY) {
  console.log("\nDRY RUN — nothing deleted. Re-run with --yes to apply.\n");
  await prisma.$disconnect();
  process.exit(0);
}

// --- snapshot ---------------------------------------------------------------
// Written BEFORE the delete, so an over-broad purge can be undone by re-inserting
// from JSON instead of restoring the whole database.
const backupDir = path.join(process.cwd(), "backups");
fs.mkdirSync(backupDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupFile = path.join(backupDir, `purge-${stamp}.json`);

const snapshot = {
  takenAt: new Date().toISOString(),
  host,
  flags: { PURGE_CLASSES, PURGE_EVENTS, PURGE_SPACE_REQUESTS },
  statusHistory: await prisma.statusHistory.findMany(),
  payments: await prisma.payment.findMany(),
  notificationLogs: await prisma.notificationLog.findMany(),
  bookings: await prisma.booking.findMany(),
  // Always snapshot content, even when not purging it — it costs nothing and
  // is exactly what you wish you had after a mistake.
  classSessions: await prisma.classSession.findMany(),
  events: await prisma.event.findMany(),
  spaceRequests: await prisma.spaceRequest.findMany(),
};
fs.writeFileSync(backupFile, JSON.stringify(snapshot, null, 2));
console.log(`\nsnapshot written: ${path.relative(process.cwd(), backupFile)}`);

// Typed confirmation: --yes alone is too easy to leave in a shell history.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const answer = await new Promise((r) =>
  rl.question(`\nType the database host (${host}) to confirm: `, r)
);
rl.close();
if (answer.trim() !== host) {
  console.error("Confirmation did not match. Aborted. Nothing was deleted.");
  await prisma.$disconnect();
  process.exit(1);
}

// --- purge ------------------------------------------------------------------
// Order is forced by the schema:
//   * status_history / payments cascade from bookings, but we delete them
//     explicitly so the counts are visible and the trigger issue is obvious.
//   * notification_logs.booking_id is SetNull, so they'd survive as orphans.
//   * bookings hold Restrict FKs to class_sessions / events / space_requests,
//     so bookings MUST go before any of those.
try {
  const deleted = await prisma.$transaction(async (tx) => {
    // status_history is append-only, enforced by trg_status_history_immutable.
    // A DELETE (including the cascade from bookings) raises an exception and
    // aborts the transaction. Disable it for the length of this transaction;
    // it is restored below, and rolled back with us if anything throws.
    await tx.$executeRawUnsafe(
      `ALTER TABLE status_history DISABLE TRIGGER trg_status_history_immutable`
    );

    const out = {};
    out.statusHistory = (await tx.statusHistory.deleteMany({})).count;
    out.payments = (await tx.payment.deleteMany({})).count;
    out.notificationLogs = (await tx.notificationLog.deleteMany({})).count;
    out.bookings = (await tx.booking.deleteMany({})).count;
    if (PURGE_CLASSES) out.classSessions = (await tx.classSession.deleteMany({})).count;
    if (PURGE_EVENTS) out.events = (await tx.event.deleteMany({})).count;
    if (PURGE_SPACE_REQUESTS) out.spaceRequests = (await tx.spaceRequest.deleteMany({})).count;

    await tx.$executeRawUnsafe(
      `ALTER TABLE status_history ENABLE TRIGGER trg_status_history_immutable`
    );
    return out;
  }, {
    // Prisma's interactive transactions default to a 5s timeout. Several
    // statements against a remote Supabase instance exceed that easily, and
    // the whole purge rolls back on the round trips rather than on any error.
    timeout: 120_000,
    maxWait: 15_000,
  });

  console.log("\ndeleted:");
  for (const [table, n] of Object.entries(deleted)) console.log(`  ${table.padEnd(18)} ${n}`);

  // Verify the audit trigger really came back — leaving it disabled would
  // silently remove the append-only guarantee on the audit log.
  const [{ tgenabled }] = await prisma.$queryRawUnsafe(
    `SELECT tgenabled FROM pg_trigger
     WHERE tgrelid = 'status_history'::regclass AND tgname = 'trg_status_history_immutable'`
  );
  console.log(`\naudit trigger restored: ${tgenabled === "O" ? "yes" : `NO (tgenabled=${tgenabled}) — FIX THIS`}`);
  console.log("remaining rows:", await summarise());
  console.log(`\nsnapshot kept at ${path.relative(process.cwd(), backupFile)}\n`);
} catch (err) {
  console.error("\nPurge failed, transaction rolled back. Nothing was deleted.");
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
