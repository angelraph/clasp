import { handler, type RouteCtx } from "@/lib/http";
import { limitAiCall } from "@/lib/ratelimit";
import { formatMoney } from "@/lib/money";
import { notifyLater } from "@/lib/notify";
import { priceRentalReturn } from "@/lib/policy";
import { getDeal, HttpError, loadPhotos, logEvent, requireRole, savePhotos, updateDeal } from "@/lib/store";
import { inspectReturn } from "@/lib/vision";

export const maxDuration = 60;

/** Rental return: the owner scans the item back in; policy prices any agreed damages. */
export const POST = handler(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const form = await req.formData();
  const { deal, listing } = await getDeal(id);
  requireRole(deal, listing, form.get("key") as string, "seller");
  if (listing.mode !== "rental" || !["active", "returned"].includes(deal.status)) {
    throw new HttpError(409, `Deal is ${deal.status}`);
  }
  const pickup = deal.pickupInspection as { photoIds: string[]; presentAtPickup: Record<string, boolean>; conditionNotes: string[] } | null;
  if (!pickup) throw new HttpError(409, "No pickup record to compare against");

  await limitAiCall(req, `deal:${id}`);
  const { ids, photos } = await savePhotos(form, { listingId: listing.id, dealId: id, stage: "return" });
  const reading = await inspectReturn({
    pickupPhotos: await loadPhotos(pickup.photoIds),
    returnPhotos: photos,
    pickupNotes: pickup.conditionNotes,
    accessoryNames: listing.accessories.map((a) => a.name),
    damageRules: listing.damageRules,
  });
  const verdict = priceRentalReturn({
    depositCents: listing.depositCents,
    accessories: listing.accessories,
    damageRules: listing.damageRules,
    presentAtPickup: pickup.presentAtPickup,
    accessoryReads: reading.accessories,
    damageReads: reading.newDamage,
  });

  const decision = {
    kind: "rental_return",
    ...verdict,
    charges: verdict.charges.map((c) => ({
      ...c,
      evidencePhotoId: c.evidencePhotoIndex === null ? null : (ids[c.evidencePhotoIndex] ?? null),
    })),
    photoIds: ids,
    at: new Date().toISOString(),
  };
  await updateDeal(id, { status: "returned", decision, returnInspection: { reading, photoIds: ids } });
  await logEvent({ dealId: id, type: `rental.return_${verdict.verdict}`, payload: { reading, verdict } });
  notifyLater("buyer", listing, deal, verdict.totalCents > 0
    ? { title: `Return checked: ${formatMoney(verdict.totalCents)} in agreed charges`, body: `${verdict.charges.map((c) => c.reason).join("; ")}. ${formatMoney(verdict.releasedCents)} of your deposit will be released. See the photos in Clasp.` }
    : { title: "Return checked: no new damage", body: `Your full ${formatMoney(listing.depositCents)} deposit for "${listing.title}" will be released.` });
  return decision;
});
