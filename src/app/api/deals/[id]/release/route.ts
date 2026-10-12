import { handler, type RouteCtx } from "@/lib/http";
import {
  captureForSeller,
  ensureFreshHold,
  getDeal,
  HttpError,
  logEvent,
  requireRole,
  updateDeal,
  updateListing,
  withTransition,
} from "@/lib/store";

/** Sale: after a policy match, the buyer releases the hold and the seller is paid. */
export const POST = handler(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const { key } = (await req.json()) as { key?: string };
  const { deal: current, listing } = await getDeal(id);
  requireRole(current, listing, key, "buyer");
  if (listing.mode !== "sale" || current.status !== "held") throw new HttpError(409, `Deal is ${current.status}`);
  const decision = current.decision as { kind?: string; canRelease?: boolean } | null;
  // The model can't release money; only a passing policy decision unlocks this.
  if (decision?.kind !== "sale_handoff" || decision.canRelease !== true) {
    throw new HttpError(409, "The item hasn't passed the handoff check");
  }

  return withTransition(current, "held", "releasing", async () => {
    const deal = await ensureFreshHold(current);
    const capture = await captureForSeller({ deal, listing, captureCents: listing.priceCents + deal.feeCents, payoutCents: listing.priceCents, finalCapture: true, purpose: "sale" });
    await updateDeal(id, { status: "released" });
    await updateListing(listing.id, { status: "closed" });
    await logEvent({ dealId: id, type: "deal.released", payload: { captureId: capture.id } });
    return { status: "released", captureId: capture.id };
  });
});
