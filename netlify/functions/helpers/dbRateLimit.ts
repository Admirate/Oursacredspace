import { prisma } from "./prisma";

/**
 * SECURITY (SEC-013, SEC-014): DB-based rate limiter that works reliably
 * across all serverless container instances.
 *
 * Tries to use PostgreSQL advisory locks to serialize concurrent requests
 * per key (eliminating the count-then-insert TOCTOU race). Falls back to a
 * plain count-then-insert transaction if advisory locks aren't available
 * (e.g. Supabase uses PgBouncer in transaction mode, which doesn't support
 * advisory locks).
 */
export async function isDbRateLimited(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMs);

  try {
    const blocked = await prisma.$transaction(async (tx) => {
      // Try advisory lock; swallow errors from connection poolers that don't
      // support them (PgBouncer in transaction/statement mode).
      try {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      } catch {
        // Lock unavailable — proceed without serialization.
        // The small TOCTOU window is acceptable vs. blocking all requests.
      }

      const count = await tx.rateLimitEntry.count({
        where: { key, createdAt: { gte: windowStart } },
      });

      if (count >= maxRequests) {
        return true;
      }

      await tx.rateLimitEntry.create({ data: { key } });
      return false;
    });

    // Fire-and-forget cleanup of expired entries (outside the lock)
    prisma.rateLimitEntry
      .deleteMany({ where: { key, createdAt: { lt: windowStart } } })
      .catch(() => {});

    return blocked;
  } catch (error) {
    console.error("dbRateLimit error:", error instanceof Error ? error.message : error);
    // DB unreachable — deny by default for security-critical endpoints.
    return true;
  }
}
