import { handler, type RouteCtx } from "@/lib/http";
import * as paypal from "@/lib/paypal";
import { getDeal, HttpError, logEvent, roleFor, updateDeal, updateListing, withTransition } from "@/lib/store";

/** Voids the hold before anything was captured. Either party can walk away. */
export const POST = handler(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const { key, reason } = (await req.json()) as { key?: string; reason?: string };
  const { deal, listing } = await getDeal(id);
  const role = roleFor(deal, listing, key);
  if (!role) throw new HttpError(403, "Not a party to this deal");
  if (deal.status !== "held" || !deal.authorizationId) throw new HttpError(409, "Only an untouched hold can be cancelled");

  const authorizationId = deal.authorizationId;
  return withTransition(deal, "held", "voiding", async () => {
    await paypal.voidAuthorization(authorizationId, `void-${deal.id}`);
    await updateDeal(id, { status: "voided" });
    await updateListing(listing.id, { status: "verified" });
    await logEvent({ dealId: id, type: "paypal.voided", payload: { by: role, reason: reason ?? null } });
    return { status: "voided" };
  });
});
