import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { handler } from "@/lib/http";
import { getDeal, getListing, HttpError, roleFor } from "@/lib/store";

const body = z.object({
  key: z.string().min(10),
  listingId: z.string().optional(),
  dealId: z.string().optional(),
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({ p256dh: z.string().min(10), auth: z.string().min(4) }),
  }),
});

export const GET = handler(async () => ({ publicKey: process.env.VAPID_PUBLIC_KEY ?? null }));

/**
 * Subscribes this browser to updates. The key proves the role: a seller key follows
 * every deal on the listing, a buyer key follows only their deal.
 */
export const POST = handler(async (req: Request) => {
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, "Invalid subscription");
  const { key, listingId, dealId, subscription } = parsed.data;

  let role: "seller" | "buyer";
  let resolvedListingId: string;
  let resolvedDealId: string | null = null;
  if (dealId) {
    const { deal, listing } = await getDeal(dealId);
    const r = roleFor(deal, listing, key);
    if (!r) throw new HttpError(403, "Not a party to this deal");
    role = r;
    resolvedListingId = listing.id;
    resolvedDealId = r === "buyer" ? deal.id : null;
  } else if (listingId) {
    const listing = await getListing(listingId);
    if (key !== listing.sellerKey) throw new HttpError(403, "Only the seller can follow this listing");
    role = "seller";
    resolvedListingId = listing.id;
  } else {
    throw new HttpError(400, "listingId or dealId is required");
  }

  const db = await getDb();
  await db
    .insert(schema.pushSubscriptions)
    .values({ endpoint: subscription.endpoint, keys: subscription.keys, role, listingId: resolvedListingId, dealId: resolvedDealId })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.endpoint,
      set: { keys: subscription.keys, role, listingId: resolvedListingId, dealId: resolvedDealId },
    });
  return { subscribed: true, role };
});
