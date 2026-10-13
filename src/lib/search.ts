/** Finding verified, available listings: shared by the browse page and the agent (MCP) tools. */
import { and, desc, eq, ilike, lte, or, sql } from "drizzle-orm";
import type { MarketCheck } from "./channel3";
import { getDb, schema } from "./db";
import type { Listing } from "./db/schema";
import { env } from "./env";
import { feeFor } from "./store";

export type ListingSummary = {
  id: string;
  url: string;
  mode: "sale" | "rental";
  title: string;
  location: string;
  priceCents: number;
  depositCents: number;
  buyerTotalCents: number;
  sellerFirstName: string;
  verifiedAt: string | null;
  verifiedBy: string;
  conditionNotes: string[];
  marketSignal: string | null;
};

export function summarize(l: Listing): ListingSummary {
  const fp = l.fingerprint;
  const market = l.market as unknown as MarketCheck | null;
  return {
    id: l.id,
    url: `${env.appUrl()}/l/${l.id}`,
    mode: l.mode,
    title: l.title,
    location: l.location,
    priceCents: l.priceCents,
    depositCents: l.depositCents,
    buyerTotalCents: l.priceCents + feeFor(l.priceCents) + l.depositCents,
    sellerFirstName: l.sellerName.split(/\s+/)[0] ?? l.sellerName,
    verifiedAt: l.verifiedAt?.toISOString() ?? null,
    verifiedBy: fp?.identifiers.length
      ? `${fp.identifiers[0].kind} on file (checked again at handoff)`
      : fp?.distinctiveFeatures?.length
        ? `${fp.distinctiveFeatures.length} unique marks on file`
        : "possession photo",
    conditionNotes: fp?.conditionNotes ?? [],
    marketSignal: market?.signal?.message ?? null,
  };
}

export async function searchListings(input: {
  query?: string;
  location?: string;
  mode?: "sale" | "rental";
  maxPriceCents?: number;
  limit?: number;
}): Promise<ListingSummary[]> {
  const db = await getDb();
  const terms = (input.query ?? "").trim().split(/\s+/).filter((t) => t.length > 1).slice(0, 6);
  const rows = await db
    .select()
    .from(schema.listings)
    .where(
      and(
        eq(schema.listings.status, "verified"),
        ...(input.mode ? [eq(schema.listings.mode, input.mode)] : []),
        ...(input.maxPriceCents ? [lte(schema.listings.priceCents, input.maxPriceCents)] : []),
        ...(input.location ? [ilike(schema.listings.location, `%${input.location.trim()}%`)] : []),
        // Every term must appear in the title, description, or the verified make/model.
        ...terms.map((t) =>
          or(
            ilike(schema.listings.title, `%${t}%`),
            ilike(schema.listings.description, `%${t}%`),
            sql`${schema.listings.fingerprint}->>'make' ilike ${`%${t}%`}`,
            sql`${schema.listings.fingerprint}->>'model' ilike ${`%${t}%`}`,
          ),
        ),
      ),
    )
    .orderBy(desc(schema.listings.verifiedAt))
    .limit(Math.min(input.limit ?? 20, 50));
  return rows.map(summarize);
}
