import type { Identifier } from "@/lib/db/schema";
import { handler, type RouteCtx } from "@/lib/http";
import { notifyLater } from "@/lib/notify";
import { decideSaleHandoff, type FeatureCheck, type LockStatus } from "@/lib/policy";
import { getDeal, HttpError, logEvent, requireRole, savePhotos, updateDeal } from "@/lib/store";
import { readHandoff } from "@/lib/vision";

export const maxDuration = 60;

/** Evidence from earlier scans in the same handoff stays valid for this long. */
const CARRY_MS = 60 * 60 * 1000;

type PriorScan = {
  kind?: string;
  matched?: Identifier | null;
  lockStatus?: LockStatus;
  featureChecks?: FeatureCheck[];
  photoIds?: string[];
  at?: string;
};

/**
 * Sale: the buyer scans the item in hand. Policy compares it to the listing.
 * A handoff can take several photos at different moments (IMEI now, lock screen next),
 * so a confirmed identity and a shown lock state carry over between scans of this deal.
 * A fresh identifier read always replaces the old one, so a later mismatch still blocks.
 */
export const POST = handler(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const form = await req.formData();
  const { deal, listing } = await getDeal(id);
  requireRole(deal, listing, form.get("key") as string, "buyer");
  if (listing.mode !== "sale") throw new HttpError(400, "Rentals use pickup and return scans");
  if (deal.status !== "held") throw new HttpError(409, `Deal is ${deal.status}`);
  const fingerprint = listing.fingerprint;
  if (!fingerprint) throw new HttpError(409, "Listing has no verified fingerprint");

  const { ids, photos } = await savePhotos(form, { listingId: listing.id, dealId: id, stage: "handoff" });
  const features = fingerprint.distinctiveFeatures ?? [];
  const reading = await readHandoff(photos, {
    kinds: [...new Set(fingerprint.identifiers.map((i) => i.kind))],
    features,
  });

  const prior = deal.decision as PriorScan | null;
  const priorValid =
    prior?.kind === "sale_handoff" && !!prior.at && Date.now() - new Date(prior.at).getTime() < CARRY_MS;

  const readsIdentity = reading.identifiers.some((r) => r.confidence > 0);
  const carryIdentity = priorValid && !readsIdentity && !!prior.matched;
  const reads = carryIdentity ? [{ ...prior.matched!, confidence: 1 }] : reading.identifiers;

  const checkedMarks = reading.featureChecks.some((c) => c.status !== "not_in_view");
  const featureChecks = priorValid && !checkedMarks && prior.featureChecks ? prior.featureChecks : reading.featureChecks;

  const lockStatus: LockStatus =
    reading.lockStatus !== "not_shown" ? reading.lockStatus : priorValid && prior.lockStatus ? prior.lockStatus : "not_shown";

  const verdict = decideSaleHandoff({
    listed: fingerprint.identifiers,
    features,
    hasAntiTheftLock: fingerprint.hasAntiTheftLock ?? false,
    reads,
    featureChecks,
    lockStatus,
  });

  const decision = {
    kind: "sale_handoff",
    ...verdict,
    lockStatus,
    featureChecks,
    photoIds: carryIdentity || lockStatus !== reading.lockStatus ? [...(prior?.photoIds ?? []), ...ids].slice(-6) : ids,
    notes: reading.notes,
    at: new Date().toISOString(),
  };
  await updateDeal(id, { decision });
  await logEvent({ dealId: id, type: `handoff.${verdict.verdict}`, payload: { reading, verdict, carriedIdentity: carryIdentity, lockStatus } });
  if (verdict.verdict === "mismatch") {
    notifyLater("seller", listing, deal, { title: "Handoff check failed", body: `The buyer scanned an item that isn't the one you verified for "${listing.title}". No money moved; the hold is still in place.` });
  } else if (verdict.verdict === "match") {
    notifyLater("seller", listing, deal, { title: "Item matched at the handoff", body: `"${listing.title}" checked out. You'll be paid as soon as the buyer taps Release.` });
  }
  return decision;
});
