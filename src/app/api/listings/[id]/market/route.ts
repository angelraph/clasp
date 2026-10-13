import { channel3Enabled } from "@/lib/channel3";
import { handler, type RouteCtx } from "@/lib/http";
import { runMarketCheck } from "@/lib/market";
import { getListing, HttpError } from "@/lib/store";

export const maxDuration = 60;

/** Seller-triggered refresh of the market price check. */
export const POST = handler(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const { key } = (await req.json()) as { key?: string };
  const listing = await getListing(id);
  if (key !== listing.sellerKey) throw new HttpError(403, "Only the seller can refresh this");
  if (listing.status === "draft") throw new HttpError(409, "Verify the listing first");
  if (!channel3Enabled()) throw new HttpError(503, "Market checks aren't configured (CHANNEL3_API_KEY)");
  return { market: await runMarketCheck(id) };
});
