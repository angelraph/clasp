import { handler, type RouteCtx } from "@/lib/http";
import * as paypal from "@/lib/paypal";
import {
  captureForSeller,
  getDeal,
  HttpError,
  logEvent,
  requireRole,
  updateDeal,
  updateListing,
  withTransition,
} from "@/lib/store";

/**
 * Rental settle: capture exactly the policy's total from the deposit (final capture,
 * which releases the remainder), or void the hold if the return was clean.
 */
export const POST = handler(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const { key } = (await req.json()) as { key?: string };
  const { deal, listing } = await getDeal(id);
  requireRole(deal, listing, key, "seller");
  if (deal.status !== "returned" || !deal.authorizationId) throw new HttpError(409, `Deal is ${deal.status}`);
  const decision = deal.decision as { kind?: string; totalCents?: number } | null;
  if (decision?.kind !== "rental_return" || typeof decision.totalCents !== "number") {
    throw new HttpError(409, "No return inspection to settle");
  }

  const totalCents = decision.totalCents;
  const authorizationId = deal.authorizationId;
  return withTransition(deal, "returned", "settling", async () => {
    if (totalCents > 0) {
      await captureForSeller({ deal, listing, captureCents: totalCents, payoutCents: totalCents, finalCapture: true, purpose: "damages" });
    } else {
      await paypal.voidAuthorization(authorizationId, `void-${deal.id}-deposit`);
      await logEvent({ dealId: id, type: "paypal.voided", payload: { reason: "clean return: deposit released" } });
    }
    await updateDeal(id, { status: "settled" });
    // The item is back with the owner and can be rented again.
    await updateListing(listing.id, { status: "verified" });
    await logEvent({ dealId: id, type: "deal.settled", payload: { chargedCents: totalCents, releasedCents: listing.depositCents - totalCents } });
    return { status: "settled" };
  });
});
