/**
 * Channel3: live product data across retailers. Clasp uses it to give every listing a
 * market price check and to confirm the photos show what the title claims.
 */
import type { Listing } from "./db/schema";
import { isSameModel, priceSignal, type PriceSignal } from "./policy";
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

async function post<T>(path: string, body: unknown, attempt = 1): Promise<T> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "x-api-key": process.env.CHANNEL3_API_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    // Retry once on rate limits and server errors; client errors won't fix themselves.
    if ((res.status === 429 || res.status >= 500) && attempt < 2) return post<T>(path, body, attempt + 1);
    if (!res.ok) throw new Error(`Channel3 ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return (await res.json()) as T;
  } catch (err) {
    // Network failures and timeouts get one more try.
    if (attempt < 2 && !(err instanceof Error && err.message.startsWith("Channel3 "))) return post<T>(path, body, attempt + 1);
    throw err;
  }
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

  // Only a product that is provably the same model may set the market price; otherwise a
  // similar-looking product (or a different model from the same brand) would mislead buyers.
  const matches = text.products.filter((p) =>
    isSameModel({ make: fp?.make ?? null, model: fp?.model ?? null, productTitle: p.title, brands: (p.brands ?? []).map((b) => b.name) }),
  );
  const top = matches[0] ?? null;
  // Prices pooled from every same-model product (each often has a single retailer), never
  // from accessories or other models. One offer per retailer URL.
  const seen = new Set<string>();
  const offers = matches
    .flatMap((p) => p.offers ?? [])
    .filter((o) => (o.availability ?? "InStock") === "InStock" && !seen.has(o.url) && (seen.add(o.url), true));
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
    signal: top
      ? priceSignal({ askingCents: listing.priceCents, offerCents: [...newOffers, ...usedOffers].map((o) => o.cents) })
      : { level: "unknown", referenceCents: null, offerCount: 0, percentOfReference: null, message: "No reliable retail match for this exact model, so no price comparison is shown." },
  };
}
