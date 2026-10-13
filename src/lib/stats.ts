/** Real activity counts for the home page. Only what the event log actually records. */
import { count, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "./db";

export type Stats = { verifiedListings: number; protectedDeals: number; wrongItemsStopped: number; heldCents: number };

export async function loadStats(): Promise<Stats> {
  const db = await getDb();
  const [verified] = await db
    .select({ n: count() })
    .from(schema.listings)
    .where(inArray(schema.listings.status, ["verified", "reserved", "closed"]));
  const [deals] = await db
    .select({ n: count(), cents: sql<number>`coalesce(sum(${schema.deals.authorizedCents}), 0)` })
    .from(schema.deals)
    .where(sql`${schema.deals.authorizedAt} is not null`);
  const [stopped] = await db.select({ n: count() }).from(schema.events).where(eq(schema.events.type, "handoff.mismatch"));
  return {
    verifiedListings: Number(verified?.n ?? 0),
    protectedDeals: Number(deals?.n ?? 0),
    wrongItemsStopped: Number(stopped?.n ?? 0),
    heldCents: Number(deals?.cents ?? 0),
  };
}
