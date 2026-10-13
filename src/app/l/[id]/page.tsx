import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { MarketCard } from "@/components/MarketCard";
import { NotifyButton } from "@/components/NotifyButton";
import { PayButton } from "@/components/PayButton";
import { PhotoMosaic } from "@/components/PhotoMosaic";
import { ShareListing } from "@/components/ShareListing";
import { DEAL_STATUS, Status } from "@/components/Status";
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
  return value.length <= 4 ? value : `···· ${value.slice(-4)}`;
}

function Highlight({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex gap-4">
      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brass" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-ink-500">{body}</p>
      </div>
    </div>
  );
}

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ k?: string; cancelled?: string }>;
}) {
  const { id } = await params;
  const { k, cancelled } = await searchParams;
  const listing = await getListing(id).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  const isSeller = k === listing.sellerKey;
  // Buyers see only photos judged free of identifiers; the seller sees everything they uploaded.
  const photos = await photoIds({ listingId: id, stage: "listing", publicOnly: !isSeller });
  const srcs = photos.map((p) => `/api/photos/${p}${isSeller ? `?k=${encodeURIComponent(k ?? "")}` : ""}`);
  const fp = listing.fingerprint;
  const fee = feeFor(listing.priceCents);
  const total = listing.priceCents + fee + listing.depositCents;
  const market = listing.market as unknown as MarketCheck | null;

  const db = await getDb();
  const deals = isSeller
    ? await db.select().from(schema.deals).where(eq(schema.deals.listingId, id)).orderBy(desc(schema.deals.createdAt))
    : [];
  const liveDeals = deals.filter((d) => d.status !== "awaiting_payment");
  const canBuy = !isSeller && listing.status === "verified";

  const priceCard = (
    <div id="pay" className="card scroll-mt-20 space-y-4">
      <div>
        <p className="amount text-4xl">{formatMoney(listing.priceCents)}</p>
        <p className="text-sm text-ink-500">{listing.mode === "sale" ? "asking price" : "rental fee"}</p>
      </div>
      <dl className="space-y-1.5 border-t border-line pt-3 text-sm">
        <div className="flex justify-between"><dt className="text-ink-500">{listing.mode === "sale" ? "Price" : "Rental fee"}</dt><dd className="amount">{formatMoney(listing.priceCents)}</dd></div>
        {fee > 0 && <div className="flex justify-between"><dt className="text-ink-500">Buyer protection</dt><dd className="amount">{formatMoney(fee)}</dd></div>}
        {listing.mode === "rental" && <div className="flex justify-between"><dt className="text-ink-500">Refundable deposit</dt><dd className="amount">{formatMoney(listing.depositCents)}</dd></div>}
        <div className="flex justify-between border-t border-line pt-2 font-medium"><dt>Held by PayPal</dt><dd className="amount text-base">{formatMoney(total)}</dd></div>
      </dl>

      {canBuy && (
        <>
          <PayButton listingId={listing.id} />
          <p className="text-center text-sm text-ink-500">
            {listing.mode === "sale" ? "You won't be charged until the item checks out at the handoff." : "Nothing is charged until pickup. The deposit comes back when the item does."}
          </p>
        </>
      )}
      {!isSeller && listing.status === "reserved" && <p className="text-center text-sm text-ink-500">Someone is holding this item right now.</p>}
      {!isSeller && listing.status === "closed" && <p className="text-center text-sm text-ink-500">This item has been sold.</p>}
      {!isSeller && listing.status === "draft" && <p className="text-center text-sm text-kept">Not verified yet, so it can&apos;t be bought.</p>}
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 pb-28 pt-4 sm:pt-8 lg:pb-8">
      {cancelled && <p className="mb-4 rounded-[10px] border border-line bg-card px-4 py-3 text-sm">Payment cancelled in PayPal. Nothing was charged.</p>}

      {/* title row */}
      <div className="mb-4 hidden items-end justify-between gap-4 sm:flex">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">{listing.title}</h1>
          <p className="mt-1 text-ink-500">
            {listing.mode === "sale" ? "For sale" : "For rent"}
            {listing.location && ` · ${listing.location}`}
          </p>
        </div>
        <ShareListing listingId={listing.id} title={listing.title} />
      </div>

      <PhotoMosaic srcs={srcs} />

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-8">
          {/* mobile title */}
          <div className="sm:hidden">
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-semibold tracking-[-0.02em]">{listing.title}</h1>
              <ShareListing listingId={listing.id} title={listing.title} compact />
            </div>
            <p className="mt-1 text-ink-500">
              {listing.mode === "sale" ? "For sale" : "For rent"}
              {listing.location && ` · ${listing.location}`}
            </p>
          </div>

          <div className="flex items-center gap-3 border-y border-line py-4">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-ink-900 font-serif text-lg text-paper">
              {listing.sellerName.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p className="font-medium">Listed by {listing.sellerName.split(/\s+/)[0]}</p>
              <p className="text-sm text-ink-500">
                {listing.verifiedAt
                  ? `Possession verified ${listing.verifiedAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                  : "Verification pending"}
              </p>
            </div>
          </div>

          {listing.verifiedAt && fp ? (
            <div className="space-y-5">
              <Highlight
                title="In the seller's hands"
                body="Photographed beside a one-time code Clasp generated, so this isn't a picture from somewhere else."
              />
              {fp.identifiers.length > 0 ? (
                <Highlight
                  title={`${fp.identifiers[0].kind.replace(/\d+$/, "")} on file`}
                  body="Read from the item at listing. At the handoff the one in your hands must match, or nothing is charged."
                />
              ) : (
                (fp.distinctiveFeatures ?? []).length > 0 && (
                  <Highlight title={`${fp.distinctiveFeatures.length} unique marks on file`} body="Recorded at listing and checked again on the item in your hands." />
                )
              )}
              {fp.hasAntiTheftLock && (
                <Highlight title="Lock check at handoff" body="You'll confirm Find My / Find Hub is off, so you don't pay for a locked device." />
              )}
            </div>
          ) : (
            <p className="rounded-[10px] border border-kept/25 bg-kept-tint px-4 py-3 text-sm text-kept">This listing hasn&apos;t been verified yet.</p>
          )}

          {listing.description && (
            <div className="border-t border-line pt-6">
              <p className="whitespace-pre-line leading-relaxed text-ink-700">{listing.description}</p>
            </div>
          )}

          {fp && (
            <div className="border-t border-line pt-6">
              <h2 className="text-xl font-semibold tracking-tight">What Clasp verified</h2>
              <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                {fp.make && (
                  <div className="flex justify-between gap-3 border-b border-line pb-2 sm:block sm:border-0 sm:pb-0">
                    <dt className="text-ink-500">Make / model</dt>
                    <dd>{[fp.make, fp.model].filter(Boolean).join(" ")}</dd>
                  </div>
                )}
                {fp.identifiers.map((i) => (
                  <div key={i.kind + i.value} className="flex justify-between gap-3 border-b border-line pb-2 sm:block sm:border-0 sm:pb-0">
                    <dt className="text-ink-500">{i.kind}</dt>
                    <dd className="serial">{mask(i.value)}</dd>
                  </div>
                ))}
                {fp.batteryHealthPercent !== null && (
                  <div className="flex justify-between gap-3 border-b border-line pb-2 sm:block sm:border-0 sm:pb-0">
                    <dt className="text-ink-500">Battery health</dt>
                    <dd>{fp.batteryHealthPercent}%</dd>
                  </div>
                )}
              </dl>
              {fp.conditionNotes.length > 0 && (
                <div className="mt-5">
                  <p className="status text-ink-500">Condition seen in the photos</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-ink-700">
                    {fp.conditionNotes.map((n) => (
                      <li key={n} className="flex gap-2"><span className="text-ink-300">—</span>{n}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(fp.distinctiveFeatures ?? []).length > 0 && (
                <div className="mt-5">
                  <p className="status text-ink-500">Unique marks checked at the handoff</p>
                  <ul className="mt-2 space-y-1.5 text-sm text-ink-700">
                    {fp.distinctiveFeatures.map((f) => (
                      <li key={f} className="flex gap-2"><span className="text-brass">◆</span>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {market && listing.mode === "sale" && <MarketCard market={market} askingCents={listing.priceCents} isSeller={isSeller} />}

          {listing.mode === "rental" && (
            <div className="border-t border-line pt-6">
              <h2 className="text-xl font-semibold tracking-tight">What the deposit can be charged for</h2>
              <p className="mt-1 text-sm text-ink-500">Agreed before you pay. Nothing else can ever be taken from the deposit.</p>
              <ul className="mt-4 divide-y divide-line border-y border-line text-sm">
                {listing.accessories.map((a) => (
                  <li key={a.name} className="flex justify-between py-2.5"><span>Missing {a.name.toLowerCase()}</span><span className="amount">{formatMoney(a.priceCents)}</span></li>
                ))}
                {listing.damageRules.map((r) => (
                  <li key={r.id} className="flex justify-between py-2.5"><span>{r.label}</span><span className="amount">{formatMoney(r.priceCents)}</span></li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t border-line pt-6">
            <h2 className="text-xl font-semibold tracking-tight">How you&apos;re protected</h2>
            <ol className="mt-4 space-y-4">
              {(listing.mode === "sale"
                ? [
                    ["Pay into a hold", "PayPal authorizes the amount. Nothing is sent to the seller."],
                    ["Check it at the meetup", "Scan the serial or marks on the item in your hands."],
                    ["Release, or walk away", "A match lets you release payment. Anything else, and the hold is cancelled."],
                  ]
                : [
                    ["Pay into a hold", "Fee and deposit are authorized together."],
                    ["Record pickup", "Photograph the item and accessories; the fee is paid then."],
                    ["Return it", "The deposit is released, minus only charges from the list above."],
                  ]
              ).map(([t, b], i) => (
                <li key={t} className="flex gap-4">
                  <span className="amount grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line text-sm">{i + 1}</span>
                  <div><p className="font-medium">{t}</p><p className="text-sm text-ink-500">{b}</p></div>
                </li>
              ))}
            </ol>
          </div>

          {isSeller && (
            <div className="space-y-4 rounded-[10px] border border-line bg-card p-5">
              <AutoRefresh />
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Seller view</h2>
                <Status tone={listing.status === "verified" ? "matched" : listing.status === "reserved" ? "brass" : "muted"}>
                  {listing.status === "verified" ? "Live" : listing.status}
                </Status>
              </div>
              <NotifyButton subscriptionKey={listing.sellerKey} listingId={listing.id} label="Notify me when a buyer pays" />
              {listing.status === "draft" && <p className="text-sm text-ink-500">Finish verifying from the create page.</p>}
              {liveDeals.length === 0 ? (
                <p className="text-sm text-ink-500">No buyers yet. Share your listing link in your Marketplace, Craigslist or Reddit post.</p>
              ) : (
                <ul className="divide-y divide-line border-y border-line">
                  {liveDeals.map((d) => {
                    const s = DEAL_STATUS[d.status] ?? { word: d.status, tone: "muted" as const };
                    return (
                      <li key={d.id}>
                        <Link href={`/d/${d.id}?k=${listing.sellerKey}`} className="flex items-center justify-between py-3 hover:bg-ink-100/50">
                          <span className="amount">{formatMoney(d.authorizedCents)}</span>
                          <span className="flex items-center gap-3">
                            <Status tone={s.tone}>{s.word}</Status>
                            <span className="text-ink-500">→</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* One price card: sticky beside the details on desktop, after them on phones. */}
        <aside>
          <div className="lg:sticky lg:top-20">{priceCard}</div>
        </aside>
      </div>

      {/* phones: a fixed bottom bar, like a booking bar */}
      {canBuy && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div>
              <p className="amount text-xl leading-none">{formatMoney(total)}</p>
              <p className="mt-1 text-xs text-ink-500">held, not charged</p>
            </div>
            <a href="#pay" className="rounded-[10px] bg-ink-900 px-5 py-3 text-sm font-medium text-paper">Pay into a hold</a>
          </div>
        </div>
      )}
    </div>
  );
}
