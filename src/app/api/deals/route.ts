import { getDb, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { handler } from "@/lib/http";
import * as paypal from "@/lib/paypal";
import { feeFor, getListing, HttpError, logEvent, newId, newKey, updateDeal } from "@/lib/store";

/** Creates a deal and the PayPal order (intent AUTHORIZE) the buyer will approve. */
export const POST = handler(async (req: Request) => {
  const { listingId } = (await req.json()) as { listingId?: string };
  if (!listingId) throw new HttpError(400, "listingId is required");
  const listing = await getListing(listingId);
  if (listing.status !== "verified") throw new HttpError(409, "This item isn't available");

  // A rental holds fee + deposit in one authorization: the fee is captured at pickup,
  // damages (if any) at return, and the rest is released.
  // The buyer protection fee rides on top of the price; the seller still gets their full price.
  const feeCents = feeFor(listing.priceCents);
  const amountCents = listing.priceCents + feeCents + listing.depositCents;
  const id = newId();
  const buyerKey = newKey();
  const db = await getDb();
  await db.insert(schema.deals).values({ id, listingId, buyerKey, authorizedCents: amountCents, feeCents });

  const order = await paypal.createAuthorizeOrder({
    dealId: id,
    amountCents,
    currency: listing.currency,
    description:
      listing.mode === "sale"
        ? `${listing.title} (held until verified at handoff)`
        : `${listing.title} rental + refundable deposit`,
    payeeEmail: env.paypalSettlement() === "direct_payee" ? listing.sellerPaypalEmail : null,
  });
  await updateDeal(id, { orderId: order.id });
  await logEvent({ dealId: id, listingId, type: "paypal.order.created", payload: { orderId: order.id, status: order.status, amountCents } });
  return { dealId: id, orderId: order.id, buyerKey };
});
