import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { handler, type RouteCtx } from "@/lib/http";
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
    const auth = await paypal.authorizeOrder(orderId);
    await updateDeal(id, {
      status: "held",
      authorizationId: auth.id,
      authorizedAt: auth.create_time ? new Date(auth.create_time) : new Date(),
    });
    await logEvent({ dealId: id, type: "paypal.authorized", payload: { authorizationId: auth.id, status: auth.status, amount: auth.amount, expires: auth.expiration_time } });
    return { status: "held" };
  } catch (err) {
    await db.update(schema.listings).set({ status: "verified" }).where(eq(schema.listings.id, listing.id));
    throw err;
  }
});
