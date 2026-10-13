/**
 * Dispute defense: when a buyer disputes a Clasp payment, the handoff record already
 * exists, so Clasp submits it as evidence the moment PayPal asks the seller to respond.
 */
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "./db";
import { buildEvidencePdf } from "./evidence";
import * as paypal from "./paypal";
import { getDeal, logEvent } from "./store";

export async function findDealIdByCaptureId(captureId: string): Promise<string | null> {
  const db = await getDb();
  const [row] = await db
    .select({ dealId: schema.events.dealId })
    .from(schema.events)
    .where(and(eq(schema.events.type, "paypal.capture"), sql`${schema.events.payload}->>'captureId' = ${captureId}`))
    .limit(1);
  return row?.dealId ?? null;
}

async function alreadySubmitted(dealId: string, disputeId: string): Promise<boolean> {
  const db = await getDb();
  const [row] = await db
    .select({ id: schema.events.id })
    .from(schema.events)
    .where(
      and(
        eq(schema.events.dealId, dealId),
        eq(schema.events.type, "dispute.evidence_submitted"),
        sql`${schema.events.payload}->>'disputeId' = ${disputeId}`,
      ),
    )
    .limit(1);
  return !!row;
}

/** Evidence type PayPal asked the seller for, if any; otherwise OTHER. */
function requestedEvidenceType(dispute: paypal.Dispute): string {
  const requested = dispute.evidences?.find((e) => e.source === "REQUESTED_FROM_SELLER" && e.evidence_type);
  return requested?.evidence_type ?? "OTHER";
}

export type DefenseResult = { disputeId: string; dealId: string | null; outcome: "submitted" | "recorded" | "already_submitted" | "not_clasp" };

export async function defendDispute(disputeId: string): Promise<DefenseResult> {
  const dispute = await paypal.getDispute(disputeId);
  const captureIds = (dispute.disputed_transactions ?? []).map((t) => t.seller_transaction_id).filter((x): x is string => !!x);
  let dealId: string | null = null;
  for (const id of captureIds) {
    dealId = await findDealIdByCaptureId(id);
    if (dealId) break;
  }
  if (!dealId) return { disputeId, dealId: null, outcome: "not_clasp" };

  await logEvent({
    dealId,
    type: "dispute.seen",
    payload: { disputeId, status: dispute.status, reason: dispute.reason ?? null, stage: dispute.dispute_life_cycle_stage ?? null, dueDate: dispute.seller_response_due_date ?? null },
  });

  const canProvide = dispute.links?.some((l) => l.rel === "provide_evidence") || dispute.status === "WAITING_FOR_SELLER_RESPONSE";
  if (!canProvide) return { disputeId, dealId, outcome: "recorded" };
  if (await alreadySubmitted(dealId, disputeId)) return { disputeId, dealId, outcome: "already_submitted" };

  const { deal, listing } = await getDeal(dealId);
  const pdf = await buildEvidencePdf(deal, listing);
  const evidenceType = requestedEvidenceType(dispute);
  const notes =
    listing.mode === "sale"
      ? `In-person handoff verified by Clasp. The seller proved possession with a one-time code before payment. At the meetup the buyer photographed the item; its identifier matched the listing, and the buyer pressed Release before any funds were captured. Full record with photos and PayPal timeline attached (deal ${deal.id}).`
      : `Rental verified by Clasp. Condition and accessories were recorded by the renter at pickup and compared at return. Only charges from a price table the renter saw before paying were captured. Full record with photos and PayPal timeline attached (deal ${deal.id}).`;

  await paypal.provideDisputeEvidence({
    disputeId,
    evidenceType,
    notes,
    file: { name: `clasp-handoff-record-${deal.id}.pdf`, mime: "application/pdf", data: pdf },
  });
  await logEvent({ dealId, type: "dispute.evidence_submitted", payload: { disputeId, evidenceType, bytes: pdf.byteLength } });
  return { disputeId, dealId, outcome: "submitted" };
}

/** Looks up any disputes on a deal's captures and defends each one. */
export async function defendDeal(dealId: string): Promise<DefenseResult[]> {
  const db = await getDb();
  const captures = await db
    .select({ payload: schema.events.payload })
    .from(schema.events)
    .where(and(eq(schema.events.dealId, dealId), eq(schema.events.type, "paypal.capture")));
  const results: DefenseResult[] = [];
  for (const c of captures) {
    const captureId = (c.payload as { captureId?: string }).captureId;
    if (!captureId) continue;
    for (const d of await paypal.listDisputesForTransaction(captureId)) results.push(await defendDispute(d.dispute_id));
  }
  return results;
}
