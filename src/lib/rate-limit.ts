import { prisma } from "@/lib/prisma";

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

/**
 * Fixed-window rate limiter backed by Postgres. Each window is its own row
 * (`key:windowStart`), so increments are race-safe upserts and old rows can be
 * pruned. Fails open on a datastore error.
 */
export async function rateLimit(input: {
  key: string;
  limit: number;
  windowMs: number;
}): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = Math.floor(now / input.windowMs) * input.windowMs;
  const bucketKey = `${input.key}:${windowStart}`;

  let count: number;
  try {
    const record = await prisma.rateLimit.upsert({
      where: { key: bucketKey },
      create: { key: bucketKey, count: 1, windowStart: new Date(windowStart) },
      update: { count: { increment: 1 } },
      select: { count: true },
    });
    count = record.count;
  } catch {
    return { ok: true, remaining: input.limit, retryAfterSeconds: 0 };
  }

  const resetAt = windowStart + input.windowMs;
  return {
    ok: count <= input.limit,
    remaining: Math.max(input.limit - count, 0),
    retryAfterSeconds: Math.max(Math.ceil((resetAt - now) / 1000), 1),
  };
}

/** A 429 Response when the limit is exceeded, otherwise null. */
export function rateLimitResponse(result: RateLimitResult): Response | null {
  if (result.ok) return null;
  return Response.json(
    { error: "Too many requests." },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    },
  );
}

/** Best-effort cleanup of buckets older than a day. */
export async function pruneRateLimits(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.rateLimit
    .deleteMany({ where: { windowStart: { lt: cutoff } } })
    .catch(() => {});
}
