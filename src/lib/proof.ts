/**
 * Public, shareable facts about a completed deal. Deliberately excludes keys, full
 * identifiers, emails and photos of the handoff; it proves what happened, not who.
 */
import type { Deal, Listing } from "./db/schema";
import { dealEvents, getDeal, photoIds } from "./store";

export type Proof = {
  dealId: string;
  mode: "sale" | "rental";
  title: string;
  sellerFirstName: string;
  priceCents: number;
  depositCents: number;
  releasedDepositCents: number | null;
  chargedCents: number | null;
  method: "identifier" | "features" | "condition";
  matchedLabel: string;
  verifiedAt: string | null;
  heldAt: string | null;
  checkedAt: string | null;
  paidAt: string | null;
  secondsCheckToPaid: number | null;
  coverPhotoId: string | null;
};

const COMPLETE = new Set(["released", "settled"]);

export function isProofable(deal: Deal) {
  return COMPLETE.has(deal.status);
}

export async function loadProof(dealId: string): Promise<Proof | null> {
  let deal: Deal;
  let listing: Listing;
  try {
    ({ deal, listing } = await getDeal(dealId));
  } catch {
    return null;
  }
  if (!isProofable(deal)) return null;

  const events = await dealEvents(dealId);
  const at = (type: string) => events.find((e) => e.type === type)?.createdAt ?? null;
  const lastAt = (pred: (t: string) => boolean) => [...events].reverse().find((e) => pred(e.type))?.createdAt ?? null;

  const heldAt = at("paypal.authorized");
  const checkedAt =
    listing.mode === "sale" ? lastAt((t) => t === "handoff.match") : lastAt((t) => t.startsWith("rental.return_"));
  const paidAt = listing.mode === "sale" ? at("deal.released") : at("deal.settled");

  const decision = deal.decision as { method?: string; matched?: { kind: string; value: string } | null; reasons?: string[]; totalCents?: number; releasedCents?: number } | null;
  let method: Proof["method"] = "condition";
  let matchedLabel = "Condition compared with pickup photos";
  if (listing.mode === "sale") {
    if (decision?.matched) {
      method = "identifier";
      matchedLabel = `${decision.matched.kind.replace(/\d+$/, "")} ending ${decision.matched.value.slice(-4)} matched`;
    } else {
      method = "features";
      matchedLabel = "Unique marks matched";
    }
  }

  const photos = await photoIds({ listingId: listing.id, stage: "listing", publicOnly: true });
  return {
    dealId,
    mode: listing.mode,
    title: listing.title,
    sellerFirstName: listing.sellerName.split(/\s+/)[0] ?? listing.sellerName,
    priceCents: listing.priceCents,
    depositCents: listing.depositCents,
    releasedDepositCents: listing.mode === "rental" ? (decision?.releasedCents ?? null) : null,
    chargedCents: listing.mode === "rental" ? (decision?.totalCents ?? null) : null,
    method,
    matchedLabel,
    verifiedAt: listing.verifiedAt?.toISOString() ?? null,
    heldAt: heldAt?.toISOString() ?? null,
    checkedAt: checkedAt?.toISOString() ?? null,
    paidAt: paidAt?.toISOString() ?? null,
    secondsCheckToPaid: checkedAt && paidAt ? Math.max(0, Math.round((paidAt.getTime() - checkedAt.getTime()) / 1000)) : null,
    // The seller's own listing photo, which is already public on the listing page.
    coverPhotoId: photos.at(-1) ?? null,
  };
}

export function humanDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.round(m / 60);
  return `${h} hour${h === 1 ? "" : "s"}`;
}
