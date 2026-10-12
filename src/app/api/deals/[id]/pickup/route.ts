import { handler, type RouteCtx } from "@/lib/http";
import { MIN_READ_CONFIDENCE } from "@/lib/policy";
import {
  captureForSeller,
  ensureFreshHold,
  getDeal,
  HttpError,
  logEvent,
  requireRole,
  savePhotos,
  updateDeal,
  withTransition,
} from "@/lib/store";
import { inspectPickup } from "@/lib/vision";

export const maxDuration = 60;

/**
 * Rental pickup: the renter records the condition they received, then the rental fee
 * is captured and the deposit stays held (final_capture=false).
 */
export const POST = handler(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const form = await req.formData();
  const { deal: current, listing } = await getDeal(id);
  requireRole(current, listing, form.get("key") as string, "buyer");
  if (listing.mode !== "rental" || current.status !== "held") throw new HttpError(409, `Deal is ${current.status}`);

  return withTransition(current, "held", "picking_up", async () => {
    const { ids, photos } = await savePhotos(form, { listingId: listing.id, dealId: id, stage: "pickup" });
    const reading = await inspectPickup(photos, listing.accessories.map((a) => a.name));
    // Only accessories clearly seen at pickup can be charged for later.
    const presentAtPickup = Object.fromEntries(
      listing.accessories.map((a) => {
        const r = reading.accessories.find((x) => x.name === a.name);
        return [a.name, !!r && r.present && r.confidence >= MIN_READ_CONFIDENCE];
      }),
    );
    const pickupInspection = { photoIds: ids, presentAtPickup, conditionNotes: reading.conditionNotes, at: new Date().toISOString() };
    await updateDeal(id, { pickupInspection });
    await logEvent({ dealId: id, type: "rental.pickup_recorded", payload: { reading, presentAtPickup } });

    const deal = await ensureFreshHold({ ...current, pickupInspection });
    await captureForSeller({ deal, listing, amountCents: listing.priceCents, finalCapture: false, purpose: "rental_fee" });
    await updateDeal(id, { status: "active" });
    return { status: "active", pickupInspection };
  });
});
