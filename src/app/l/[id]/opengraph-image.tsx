import { formatMoney } from "@/lib/money";
import { ogCard, OG_SIZE } from "@/lib/og";
import { getListing, photoIds } from "@/lib/store";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Clasp verified listing";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getListing(id).catch(() => null);
  if (!listing) {
    return ogCard({ badge: "Clasp", title: "Pay strangers like you trust them", line: "Money moves only when the thing does.", footer: "PayPal holds it. AI checks it.", photoId: null });
  }
  const photos = await photoIds({ listingId: id, stage: "listing", publicOnly: true });
  const verified = listing.status !== "draft";
  return ogCard({
    badge: verified ? "Verified in the seller's hands" : "Clasp listing",
    title: listing.title,
    line:
      listing.mode === "sale"
        ? `${formatMoney(listing.priceCents)} · PayPal holds your money until you check the item`
        : `${formatMoney(listing.priceCents)} rental · deposit ${formatMoney(listing.depositCents)}, back when the item is`,
    footer: "Pay with Clasp: money moves only when the thing does",
    photoId: photos.at(-1) ?? null,
  });
}
