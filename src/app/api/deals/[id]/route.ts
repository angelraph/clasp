import { handler, type RouteCtx } from "@/lib/http";
import { holdClock } from "@/lib/policy";
import { dealEvents, getDeal, photoIds, roleFor } from "@/lib/store";

/** Live state of a deal for both parties' screens. */
export const GET = handler(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const key = new URL(req.url).searchParams.get("k");
  const { deal, listing } = await getDeal(id);
  const [events, handoff, pickup, ret] = await Promise.all([
    dealEvents(id),
    photoIds({ listingId: listing.id, dealId: id, stage: "handoff" }),
    photoIds({ listingId: listing.id, dealId: id, stage: "pickup" }),
    photoIds({ listingId: listing.id, dealId: id, stage: "return" }),
  ]);
  return {
    role: roleFor(deal, listing, key),
    listing: {
      id: listing.id,
      mode: listing.mode,
      title: listing.title,
      sellerName: listing.sellerName,
      priceCents: listing.priceCents,
      depositCents: listing.depositCents,
      currency: listing.currency,
      hasAntiTheftLock: listing.fingerprint?.hasAntiTheftLock ?? false,
      distinctiveFeatures: listing.fingerprint?.distinctiveFeatures ?? [],
      identifierKinds: [...new Set(listing.fingerprint?.identifiers.map((i) => i.kind) ?? [])],
      accessories: listing.accessories,
    },
    deal: {
      id: deal.id,
      status: deal.status,
      authorizedCents: deal.authorizedCents,
      capturedCents: deal.capturedCents,
      authorizedAt: deal.authorizedAt,
      decision: deal.decision,
      pickupInspection: deal.pickupInspection,
      clock: deal.authorizedAt ? holdClock(deal.authorizedAt) : null,
    },
    photos: { handoff, pickup, return: ret },
    events: events.map((e) => ({ type: e.type, at: e.createdAt, payload: e.payload })),
  };
});
