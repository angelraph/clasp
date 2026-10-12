import { handler, type RouteCtx } from "@/lib/http";
import { verifyListing } from "@/lib/policy";
import { getListing, HttpError, logEvent, savePhotos, updateListing } from "@/lib/store";
import { inspectListing } from "@/lib/vision";

export const maxDuration = 60;

export const POST = handler(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const listing = await getListing(id);
  const form = await req.formData();
  if (form.get("key") !== listing.sellerKey) throw new HttpError(403, "Only the seller can verify this listing");
  if (listing.status !== "draft") throw new HttpError(409, "This listing is already verified");

  const { photos } = await savePhotos(form, { listingId: id, stage: "listing" });
  const reading = await inspectListing(photos, listing.title);
  const verdict = verifyListing({
    mode: listing.mode,
    expectedCode: listing.possessionCode,
    codeSeen: reading.itemVisibleWithCode ? reading.codeSeen : null,
    codeConfidence: reading.codeConfidence,
    identifierReads: reading.identifiers,
    featureReads: reading.distinctiveFeatures,
  });

  await logEvent({ listingId: id, type: "listing.inspected", payload: { reading, verdict } });
  await updateListing(id, {
    verification: { reading, verdict },
    ...(verdict.verified
      ? {
          status: "verified",
          verifiedAt: new Date(),
          fingerprint: {
            category: reading.category,
            make: reading.make,
            model: reading.model,
            identifiers: verdict.identifiers,
            distinctiveFeatures: verdict.distinctiveFeatures,
            hasAntiTheftLock: reading.hasAntiTheftLock,
            batteryHealthPercent: reading.batteryHealthPercent,
            conditionNotes: reading.conditionNotes,
            readAt: new Date().toISOString(),
          },
        }
      : {}),
  });
  return { verdict, reading };
});
