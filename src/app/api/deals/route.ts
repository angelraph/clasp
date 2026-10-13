import { startDeal } from "@/lib/deals";
import { handler } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { HttpError } from "@/lib/store";

/** Creates a deal and the PayPal order (intent AUTHORIZE) the buyer will approve. */
export const POST = handler(async (req: Request) => {
  const { listingId } = (await req.json()) as { listingId?: string };
  if (!listingId) throw new HttpError(400, "listingId is required");
  await rateLimit(`deals:ip:${clientIp(req)}`, 30, 3600);
  const { dealId, orderId, buyerKey } = await startDeal(listingId);
  return { dealId, orderId, buyerKey };
});
