/**
 * Caps on expensive actions. Each photo check is a paid AI call and each order is a
 * PayPal API call, so anonymous traffic can't run up costs or spam holds.
 */
import { sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { HttpError } from "./store";

export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

/** Atomically counts one hit in a fixed window; throws 429 once over the limit. */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const db = await getDb();
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowSeconds * 1000);
  const [row] = await db
    .insert(schema.rateLimits)
    .values({ key, windowStart: now, count: 1 })
    .onConflictDoUpdate({
      target: schema.rateLimits.key,
      set: {
        count: sql`case when ${schema.rateLimits.windowStart} < ${cutoff} then 1 else ${schema.rateLimits.count} + 1 end`,
        windowStart: sql`case when ${schema.rateLimits.windowStart} < ${cutoff} then ${now} else ${schema.rateLimits.windowStart} end`,
      },
    })
    .returning({ count: schema.rateLimits.count, windowStart: schema.rateLimits.windowStart });
  if (row.count > limit) {
    const retryIn = Math.max(1, Math.ceil((row.windowStart.getTime() + windowSeconds * 1000 - now.getTime()) / 60000));
    throw new HttpError(429, `Too many attempts. Try again in about ${retryIn} minute${retryIn === 1 ? "" : "s"}.`);
  }
}

/** Limits for one AI photo check: per caller and per listing/deal. */
export async function limitAiCall(req: Request, scope: string) {
  await rateLimit(`ai:ip:${clientIp(req)}`, 40, 3600);
  await rateLimit(`ai:${scope}`, 25, 3600);
}
