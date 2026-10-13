import { channel3Enabled, checkMarket } from "./channel3";
import { getListing, loadPhotos, logEvent, photoIds, updateListing } from "./store";

/** Runs and stores the Channel3 market check for a verified listing. No-op without a key. */
export async function runMarketCheck(listingId: string) {
  if (!channel3Enabled()) return null;
  const listing = await getListing(listingId);
  const [photoId] = await photoIds({ listingId, stage: "listing", publicOnly: true });
  const [photo] = photoId ? await loadPhotos([photoId]) : [];
  const market = await checkMarket(listing, photo ?? null);
  await updateListing(listingId, { market });
  await logEvent({ listingId, type: "listing.market_checked", payload: { level: market.signal.level, offers: market.newOffers.length + market.usedOffers.length } });
  return market;
}
