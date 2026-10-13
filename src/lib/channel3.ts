/**
 * Channel3: live product data across retailers. Clasp uses it to give every listing a
 * market price check and to confirm the photos show what the title claims.
 */
import type { Listing } from "./db/schema";
import { priceSignal, type PriceSignal } from "./policy";
import type { Photo } from "./vision";

const BASE = "https://api.trychannel3.com/v1";

type Offer = {
  url: string;
  domain: string;
  price: { price?: number; amount?: number; currency: string };
  availability?: string;
  condition?: string | null;
};
type Product = { id: string; title: string; brands?: { name: string }[]; images?: { url: string; cleaned_url?: string | null; is_main_image?: boolean }[]; offers?: Offer[] };

export type MarketCheck = {
  query: string;
  checkedAt: string;
  matchedProduct: { id: string; title: string; image: string | null } | null;
  photoLooksLike: string | null;
  newOffers: { domain: string; cents: number; url: string }[];
  usedOffers: { domain: string; cents: number; url: string }[];
  signal: PriceSignal;
};

export function channel3Enabled() {
  return !!process.env.CHANNEL3_API_KEY;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "x-api-key": process.env.CHANNEL3_API_KEY!, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Channel3 ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

function offerCents(o: Offer): number | null {
  const v = o.price?.price ?? o.price?.amount;
  return typeof v === "number" && o.price.currency === "USD" ? Math.round(v * 100) : null;
}

export async function checkMarket(listing: Listing, publicPhoto: Photo | null): Promise<MarketCheck> {
  const fp = listing.fingerprint;
  const query = [fp?.make, fp?.model].filter(Boolean).join(" ") || listing.title;

  const [text, image] = await Promise.all([
    post<{ products: Product[] }>("/search", { query, limit: 8 }),
    publicPhoto
      ? post<{ products: Product[] }>("/image-search", { base64_image: Buffer.from(publicPhoto.data).toString("base64") }).catch(() => null)
      : Promise.resolve(null),
  ]);

  const top = text.products[0] ?? null;
  // Prices only from the closest product, so we don't mix in accessories or other models.
  const offers = (top?.offers ?? []).filter((o) => (o.availability ?? "InStock") === "InStock");
  const toRow = (o: Offer) => ({ domain: o.domain, cents: offerCents(o)!, url: o.url });
  const newOffers = offers.filter((o) => o.condition !== "used" && o.condition !== "refurbished" && offerCents(o) !== null).map(toRow);
  const usedOffers = offers.filter((o) => (o.condition === "used" || o.condition === "refurbished") && offerCents(o) !== null).map(toRow);

  const img = top?.images?.find((i) => i.is_main_image) ?? top?.images?.[0];
  return {
    query,
    checkedAt: new Date().toISOString(),
    matchedProduct: top ? { id: top.id, title: top.title, image: img?.cleaned_url ?? img?.url ?? null } : null,
    photoLooksLike: image?.products[0]?.title ?? null,
    newOffers,
    usedOffers,
    signal: priceSignal({ askingCents: listing.priceCents, newOfferCents: newOffers.map((o) => o.cents), usedOfferCents: usedOffers.map((o) => o.cents) }),
  };
}
