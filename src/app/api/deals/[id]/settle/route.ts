import { handler, type RouteCtx } from "@/lib/http";
import { formatMoney } from "@/lib/money";
import { notifyLater } from "@/lib/notify";
import {
  captureForSeller,
  getDeal,
  HttpError,
  logEvent,
  releaseHold,
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
  return withTransition(deal, "returned", "settling", async () => {
    let releaseNote = "PayPal released the rest of the hold";
    if (totalCents > 0) {
      // A final capture closes the authorization, so PayPal releases the remainder itself.
      await captureForSeller({ deal, listing, captureCents: totalCents, payoutCents: totalCents, finalCapture: true, purpose: "damages" });
    } else {
      releaseNote = (await releaseHold(deal, `void-${deal.id}-deposit`)).note;
    }
    await updateDeal(id, { status: "settled" });
    notifyLater("buyer", listing, deal, { title: `Deposit released: ${formatMoney(listing.depositCents - totalCents)} back`, body: totalCents > 0 ? `${formatMoney(totalCents)} was charged from the price list you agreed to. The rest of your hold on "${listing.title}" is released.` : `Nothing was charged on "${listing.title}". ${releaseNote}.` });
    // The item is back with the owner and can be rented again.
    await updateListing(listing.id, { status: "verified" });
    await logEvent({ dealId: id, type: "deal.settled", payload: { chargedCents: totalCents, releasedCents: listing.depositCents - totalCents, releaseNote } });
    return { status: "settled" };
  });
});
