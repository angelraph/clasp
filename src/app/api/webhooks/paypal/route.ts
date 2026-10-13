import { eq } from "drizzle-orm";
import { after } from "next/server";
import { getDb, schema } from "@/lib/db";
import { defendDispute, findDealIdByCaptureId } from "@/lib/disputes";
import { formatMoney } from "@/lib/money";
import { notify } from "@/lib/notify";
import { verifyWebhookSignature } from "@/lib/paypal";
import { getDeal, logEvent } from "@/lib/store";

export const maxDuration = 60;

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
    // Payouts
    batch_header?: { sender_batch_header?: { sender_batch_id?: string }; batch_status?: string };
    payout_item?: { sender_item_id?: string; amount?: { value: string; currency: string } };
    transaction_status?: string;
    // Disputes
    dispute_id?: string;
    reason?: string;
    disputed_transactions?: { seller_transaction_id?: string }[];
  };
};

async function dealExists(id: string | undefined): Promise<string | null> {
  if (!id) return null;
  const db = await getDb();
  const [d] = await db.select({ id: schema.deals.id }).from(schema.deals).where(eq(schema.deals.id, id));
  return d?.id ?? null;
}

/** Our payout batch ids are `payout-<dealId>-<purpose>`. */
function dealIdFromPayoutId(senderId: string | undefined): string | undefined {
  return senderId?.match(/^payout-([a-z0-9]+)-/)?.[1];
}

async function resolveDealId(event: WebhookEvent): Promise<string | null> {
  const r = event.resource ?? {};
  const fromCustom = await dealExists(r.custom_id);
  if (fromCustom) return fromCustom;

  const fromPayout = await dealExists(
    dealIdFromPayoutId(r.batch_header?.sender_batch_header?.sender_batch_id ?? r.payout_item?.sender_item_id),
  );
  if (fromPayout) return fromPayout;

  for (const t of r.disputed_transactions ?? []) {
    if (t.seller_transaction_id) {
      const id = await findDealIdByCaptureId(t.seller_transaction_id);
      if (id) return id;
    }
  }

  const orderId = r.supplementary_data?.related_ids?.order_id ?? (event.event_type.startsWith("CHECKOUT.ORDER") ? r.id : undefined);
  if (orderId) {
    const db = await getDb();
    const [d] = await db.select({ id: schema.deals.id }).from(schema.deals).where(eq(schema.deals.orderId, orderId));
    return d?.id ?? null;
  }
  return null;
}

/**
 * PayPal's own confirmation of each money movement. Verified events are written to the
 * deal timeline so both parties see PayPal's word, not just ours. Disputes trigger an
 * automatic evidence submission after the response is sent.
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
  const r = event.resource ?? {};
  const dealId = await resolveDealId(event);
  const amount = r.amount ?? (r.payout_item?.amount ? { value: r.payout_item.amount.value, currency_code: r.payout_item.amount.currency } : null);

  await logEvent({
    dealId,
    type: `webhook.${event.event_type}`,
    payload: {
      eventId: event.id,
      summary: event.summary ?? null,
      resourceId: r.id ?? r.dispute_id ?? null,
      status: r.status ?? r.transaction_status ?? r.batch_header?.batch_status ?? null,
      amount,
    },
  });

  if (event.event_type === "PAYMENT.PAYOUTS-ITEM.SUCCEEDED" && dealId) {
    after(async () => {
      const { deal, listing } = await getDeal(dealId);
      const cents = Math.round(Number(amount?.value ?? 0) * 100);
      await notify("seller", listing, deal, { title: `PayPal confirmed your payout${cents ? ` of ${formatMoney(cents)}` : ""}`, body: `The money for "${listing.title}" has landed in your PayPal account.` });
    });
  }

  if (event.event_type.startsWith("CUSTOMER.DISPUTE.") && r.dispute_id && event.event_type !== "CUSTOMER.DISPUTE.RESOLVED") {
    const disputeId = r.dispute_id;
    after(async () => {
      try {
        await defendDispute(disputeId);
      } catch (err) {
        console.error("Dispute defense failed", disputeId, err);
        if (dealId) await logEvent({ dealId, type: "dispute.defense_failed", payload: { disputeId, error: err instanceof Error ? err.message : String(err) } });
      }
    });
  }
  return new Response("ok");
}
