import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { handler, type RouteCtx } from "@/lib/http";
import { formatMoney } from "@/lib/money";
import { notifyLater } from "@/lib/notify";
import * as paypal from "@/lib/paypal";
import { getDeal, HttpError, logEvent, requireRole, updateDeal } from "@/lib/store";

/** Called after the buyer approves in PayPal: turns the approval into a hold. */
export const POST = handler(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const { key, orderId } = (await req.json()) as { key?: string; orderId?: string };
  const { deal, listing } = await getDeal(id);
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
    await updateDeal(id, { status: "held", authorizationId: auth.id, authorizedAt, buyerEmail: payerEmail });
    await logEvent({ dealId: id, type: "paypal.authorized", payload: { authorizationId: auth.id, status: auth.status, amount: auth.amount, expires: auth.expiration_time } });
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
});
