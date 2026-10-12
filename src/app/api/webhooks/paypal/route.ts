import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/paypal";
import { logEvent } from "@/lib/store";

type WebhookEvent = {
  id: string;
  event_type: string;
  summary?: string;
  resource?: {
    id?: string;
    status?: string;
    custom_id?: string;
    amount?: { value: string; currency_code: string };
    supplementary_data?: { related_ids?: { order_id?: string } };
  };
};

/**
 * PayPal's own confirmation of each money movement. Verified events are written to the
 * deal timeline, so both parties see PayPal's word, not just ours.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  let verified = false;
  try {
    verified = await verifyWebhookSignature(req.headers, raw);
  } catch (err) {
    console.error("Webhook verification call failed", err);
  }
  if (!verified) return new Response("Signature verification failed", { status: 400 });

  const event = JSON.parse(raw) as WebhookEvent;
  const resource = event.resource ?? {};
  const db = await getDb();

  // Our deal id travels as the purchase unit's custom_id; fall back to the order id.
  let dealId: string | null = null;
  if (resource.custom_id) {
    const [d] = await db.select({ id: schema.deals.id }).from(schema.deals).where(eq(schema.deals.id, resource.custom_id));
    dealId = d?.id ?? null;
  }
  const orderId = resource.supplementary_data?.related_ids?.order_id ?? (event.event_type.startsWith("CHECKOUT.ORDER") ? resource.id : undefined);
  if (!dealId && orderId) {
    const [d] = await db.select({ id: schema.deals.id }).from(schema.deals).where(eq(schema.deals.orderId, orderId));
    dealId = d?.id ?? null;
  }

  await logEvent({
    dealId,
    type: `webhook.${event.event_type}`,
    payload: { eventId: event.id, summary: event.summary ?? null, resourceId: resource.id ?? null, status: resource.status ?? null, amount: resource.amount ?? null },
  });
  return new Response("ok");
}
