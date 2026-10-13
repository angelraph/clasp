import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { MarketCard } from "@/components/MarketCard";
import { NotifyButton } from "@/components/NotifyButton";
import { PayButton } from "@/components/PayButton";
import type { MarketCheck } from "@/lib/channel3";
import { getDb, schema } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { feeFor, getListing, HttpError, photoIds } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id).catch(() => null);
  if (!listing) return { title: "Clasp" };
  const title = `${listing.title} · ${formatMoney(listing.priceCents)}${listing.mode === "rental" ? " rental" : ""}`;
  const description =
    listing.mode === "sale"
      ? "Verified in the seller's hands. Pay into a PayPal hold; the seller is paid only when you check the item at the handoff."
      : "Verified by photo. Fee and deposit held by PayPal; the deposit comes back when the item does.";
  return { title, description, openGraph: { title, description, type: "website" } };
}

function mask(value: string) {
  return value.length <= 4 ? value : `•••• ${value.slice(-4)}`;
}

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ k?: string }>;
}) {
  const { id } = await params;
  const { k } = await searchParams;
  const listing = await getListing(id).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  const isSeller = k === listing.sellerKey;
  // Buyers see only photos judged free of identifiers; the seller sees everything they uploaded.
  const photos = await photoIds({ listingId: id, stage: "listing", publicOnly: !isSeller });
  const fp = listing.fingerprint;
  const fee = feeFor(listing.priceCents);

  const db = await getDb();
  const deals = isSeller
    ? await db.select().from(schema.deals).where(eq(schema.deals.listingId, id)).orderBy(desc(schema.deals.createdAt))
    : [];
  const liveDeals = deals.filter((d) => d.status !== "awaiting_payment");

  return (
    <div className="space-y-4 pt-2">
      {photos.length > 0 && (
        <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4">
          {photos.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p} src={`/api/photos/${p}${isSeller ? `?k=${encodeURIComponent(k ?? "")}` : ""}`} alt="" className="h-64 w-auto snap-start rounded-2xl object-cover" />
          ))}
        </div>
      )}

      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-ink-500">{listing.mode === "sale" ? "For sale" : "For rent"} · {listing.sellerName}</p>
            <h1 className="mt-0.5 text-2xl font-semibold">{listing.title}</h1>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold">{formatMoney(listing.priceCents)}</p>
            {listing.mode === "rental" && <p className="text-sm text-ink-500">+ {formatMoney(listing.depositCents)} deposit</p>}
          </div>
        </div>
        {listing.description && <p className="mt-3 text-ink-700">{listing.description}</p>}
      </div>

      {listing.verifiedAt && fp ? (
        <div className="card border-ok-600/30 bg-ok-50">
          <p className="font-medium text-ok-600">✓ In the seller&apos;s hands, verified by photo</p>
          <p className="mt-1 text-sm text-ink-700">
            Photographed with a one-time code on {listing.verifiedAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}.
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {fp.make && (<><dt className="text-ink-500">Make / model</dt><dd>{[fp.make, fp.model].filter(Boolean).join(" ")}</dd></>)}
            {fp.identifiers.map((i) => (
              <div key={i.kind + i.value} className="contents">
                <dt className="text-ink-500">{i.kind}</dt>
                <dd className="font-mono">{mask(i.value)}</dd>
              </div>
            ))}
            {fp.batteryHealthPercent !== null && (<><dt className="text-ink-500">Battery health</dt><dd>{fp.batteryHealthPercent}%</dd></>)}
          </dl>
          {(fp.distinctiveFeatures ?? []).length > 0 && (
            <div className="mt-3 text-sm">
              <p className="font-medium text-ink-700">Unique marks checked at handoff</p>
              <ul className="list-disc pl-5 text-ink-700">{fp.distinctiveFeatures.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          )}
          {fp.conditionNotes.length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-sm text-ink-700">{fp.conditionNotes.map((n) => <li key={n}>{n}</li>)}</ul>
          )}
        </div>
      ) : (
        <div className="card border-hold-600/30 bg-hold-50 text-sm text-hold-600">This listing hasn&apos;t been verified yet.</div>
      )}

      {listing.market && listing.mode === "sale" && (
        <MarketCard market={listing.market as unknown as MarketCheck} askingCents={listing.priceCents} isSeller={isSeller} />
      )}

      {listing.mode === "rental" && (
        <div className="card text-sm">
          <h2 className="font-semibold">What the deposit can be charged for</h2>
          <p className="mt-1 text-ink-500">Agreed up front. Nothing else can ever be taken from the deposit.</p>
          <ul className="mt-3 divide-y divide-ink-100">
            {listing.accessories.map((a) => (
              <li key={a.name} className="flex justify-between py-2"><span>Missing: {a.name}</span><span>{formatMoney(a.priceCents)}</span></li>
            ))}
            {listing.damageRules.map((r) => (
              <li key={r.id} className="flex justify-between py-2"><span>{r.label}</span><span>{formatMoney(r.priceCents)}</span></li>
            ))}
          </ul>
        </div>
      )}

      {!isSeller && listing.status === "verified" && (
        <div className="card space-y-3">
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-ink-500">{listing.mode === "sale" ? "Price" : "Rental fee"}</dt><dd>{formatMoney(listing.priceCents)}</dd></div>
            {fee > 0 && <div className="flex justify-between"><dt className="text-ink-500">Clasp buyer protection</dt><dd>{formatMoney(fee)}</dd></div>}
            {listing.mode === "rental" && <div className="flex justify-between"><dt className="text-ink-500">Refundable deposit</dt><dd>{formatMoney(listing.depositCents)}</dd></div>}
            <div className="flex justify-between border-t border-ink-100 pt-1 font-semibold"><dt>Held by PayPal</dt><dd>{formatMoney(listing.priceCents + fee + listing.depositCents)}</dd></div>
          </dl>
          <p className="text-sm text-ink-700">
            {listing.mode === "sale"
              ? "Held, not charged. The seller is paid only after you scan the item at the handoff and it matches. If it doesn't, nothing is charged."
              : "The fee is paid at pickup; the deposit comes back when the item does, minus only charges agreed above."}
          </p>
          <PayButton listingId={listing.id} />
        </div>
      )}
      {!isSeller && listing.status === "reserved" && (
        <div className="card text-center text-sm text-ink-500">Someone is holding this item right now.</div>
      )}
      {!isSeller && listing.status === "closed" && (
        <div className="card text-center text-sm text-ink-500">This item has been sold.</div>
      )}

      {isSeller && (
        <div className="card space-y-3">
          <AutoRefresh />
          <h2 className="font-semibold">Seller view</h2>
          <NotifyButton subscriptionKey={listing.sellerKey} listingId={listing.id} label="Notify me when a buyer pays" />
          {listing.status === "draft" && <p className="mt-1 text-sm text-ink-500">Finish verifying from the create page.</p>}
          {liveDeals.length === 0 ? (
            <p className="mt-1 text-sm text-ink-500">No buyers yet. Share your link: /l/{listing.id}</p>
          ) : (
            <ul className="mt-2 divide-y divide-ink-100">
              {liveDeals.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{formatMoney(d.authorizedCents)} · {d.status.replace("_", " ")}</span>
                  <Link className="font-medium text-clasp-600" href={`/d/${d.id}?k=${listing.sellerKey}`}>Open</Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
