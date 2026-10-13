/**
 * Starting and authorizing deals. Shared by the PayPal button, PayPal's redirect back
 * (used for agent-started purchases) and the MCP tools, so every path runs the same
 * money logic.
 */
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "./db";
import type { Listing } from "./db/schema";
import { env } from "./env";
import { formatMoney } from "./money";
import { notifyLater } from "./notify";
import * as paypal from "./paypal";
import { feeFor, getDeal, getListing, HttpError, logEvent, newId, newKey, requireRole, updateDeal } from "./store";

export type StartedDeal = {
  dealId: string;
  orderId: string;
  buyerKey: string;
  amountCents: number;
  /** PayPal page where the human approves; only for redirect-based starts. */
  approveUrl: string | null;
  dealUrl: string;
};

export async function startDeal(listingId: string, opts: { redirect?: boolean; startedBy?: string } = {}): Promise<StartedDeal> {
  const listing: Listing = await getListing(listingId);
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

  const base = env.appUrl();
  const order = await paypal.createAuthorizeOrder({
    dealId: id,
    amountCents,
    currency: listing.currency,
    description: listing.mode === "sale" ? `${listing.title} (held until verified at handoff)` : `${listing.title} rental + refundable deposit`,
    payeeEmail: env.paypalSettlement() === "direct_payee" ? listing.sellerPaypalEmail : null,
    ...(opts.redirect
      ? {
          returnUrl: `${base}/api/deals/${id}/approved?k=${buyerKey}`,
          cancelUrl: `${base}/l/${listing.id}?cancelled=1`,
        }
      : {}),
  });
  await updateDeal(id, { orderId: order.id });
  await logEvent({
    dealId: id,
    listingId,
    type: "paypal.order.created",
    payload: { orderId: order.id, status: order.status, amountCents, startedBy: opts.startedBy ?? "buyer" },
  });
  const approveUrl = order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href ?? null;
  return { dealId: id, orderId: order.id, buyerKey, amountCents, approveUrl, dealUrl: `${base}/d/${id}?k=${buyerKey}` };
}

/** Turns the buyer's PayPal approval into a hold and reserves the item. Idempotent. */
export async function authorizeDeal(dealId: string, key: string | null | undefined, orderId: string | null | undefined) {
  const { deal, listing } = await getDeal(dealId);
  requireRole(deal, listing, key, "buyer");
  if (!orderId || orderId !== deal.orderId) throw new HttpError(400, "Order doesn't belong to this deal");
  if (deal.status !== "awaiting_payment") return { status: deal.status };

  // Reserve the listing atomically so two buyers can't both hold it.
  const db = await getDb();
  const reserved = await db
    .update(schema.listings)
    .set({ status: "reserved" })
    .where(and(eq(schema.listings.id, listing.id), eq(schema.listings.status, "verified")))
    .returning({ id: schema.listings.id });
  if (reserved.length === 0) throw new HttpError(409, "Someone else is already holding this item");

  try {
    const { auth, payerEmail } = await paypal.authorizeOrder(orderId);
    const authorizedAt = auth.create_time ? new Date(auth.create_time) : new Date();
    await updateDeal(dealId, { status: "held", authorizationId: auth.id, authorizedAt, buyerEmail: payerEmail });
    await logEvent({ dealId, type: "paypal.authorized", payload: { authorizationId: auth.id, status: auth.status, amount: auth.amount, expires: auth.expiration_time } });
    notifyLater("seller", listing, { ...deal, status: "held" }, {
      title: listing.mode === "sale" ? `Buyer paid into a hold: ${formatMoney(listing.priceCents)}` : "Your rental is booked",
      body:
        listing.mode === "sale"
          ? `PayPal is holding the money for "${listing.title}". Meet up; you're paid the moment the buyer scans it and it matches.`
          : `Fee and deposit for "${listing.title}" are held by PayPal. The fee is paid to you at pickup.`,
    });
    return { status: "held" };
  } catch (err) {
    await db.update(schema.listings).set({ status: "verified" }).where(eq(schema.listings.id, listing.id));
    throw err;
  }
}
