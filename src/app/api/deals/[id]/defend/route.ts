import { defendDeal } from "@/lib/disputes";
import { handler, type RouteCtx } from "@/lib/http";
import { getDeal, requireRole } from "@/lib/store";

export const maxDuration = 60;

/** Seller-triggered check: find disputes on this deal's payments and submit the record. */
export const POST = handler(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const { key } = (await req.json()) as { key?: string };
  const { deal, listing } = await getDeal(id);
  requireRole(deal, listing, key, "seller");
  const results = await defendDeal(id);
  return { results };
});
