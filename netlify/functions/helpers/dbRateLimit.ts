import { prisma } from "./prisma";
import { isRateLimited } from "./security";

/**
 * DB-based rate limiter — works across all serverless container instances.
 * Uses a sliding window: counts requests with key in the last windowMs milliseconds.
 * Returns true if the request should be blocked.
 * Falls back to in-memory rate limiting if the DB table is unavailable.
 */
export async function isDbRateLimited(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<boolean> {
  try {
    const windowStart = new Date(Date.now() - windowMs);

    const count = await prisma.rateLimitEntry.count({
      where: {
        key,
        createdAt: { gte: windowStart },
      },
    });

    if (count >= maxRequests) {
      return true;
    }

    await prisma.rateLimitEntry.create({ data: { key } });

    // Fire-and-forget cleanup of expired entries for this key
    prisma.rateLimitEntry
      .deleteMany({ where: { key, createdAt: { lt: windowStart } } })
      .catch(() => {});

    return false;
  } catch {
    // Table not yet created or Prisma client stale — fall back to in-memory rate limiting
    return isRateLimited(key, maxRequests, windowMs);
  }
}
