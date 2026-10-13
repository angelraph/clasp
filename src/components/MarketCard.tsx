import type { MarketCheck } from "@/lib/channel3";
import { formatMoney } from "@/lib/money";

const TONE: Record<string, string> = {
  too_low: "border-bad-600/30 bg-bad-50",
  low: "border-hold-600/30 bg-hold-50",
  fair: "border-ok-600/30 bg-ok-50",
  high: "border-hold-600/30 bg-hold-50",
  unknown: "",
};

/** Live market prices from Channel3, with a plain-code verdict on the asking price. */
export function MarketCard({ market, askingCents, isSeller }: { market: MarketCheck; askingCents: number; isSeller: boolean }) {
  const s = market.signal;
  const offers = [...market.newOffers.map((o) => ({ ...o, kind: "new" })), ...market.usedOffers.map((o) => ({ ...o, kind: "used" }))]
    .sort((a, b) => a.cents - b.cents)
    .slice(0, 4);
  return (
    <div className={`card text-sm ${TONE[s.level] ?? ""}`}>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold">Market check</h2>
        <span className="text-xs text-ink-500">Live prices via Channel3</span>
      </div>
      {s.referenceCents !== null ? (
        <p className="mt-2">
          Typical retail price about <strong>{formatMoney(s.referenceCents)}</strong> ({s.offerCount} offers, new and refurbished). This listing is{" "}
          <strong>{s.percentOfReference}%</strong> of that.
        </p>
      ) : null}
      <p className="mt-1 text-ink-700">{isSeller && s.level === "too_low" ? "You may be underpricing this." : s.message}</p>
      {market.matchedProduct && (
        <p className="mt-2 text-xs text-ink-500">
          Compared with: {market.matchedProduct.title}
          {market.photoLooksLike && market.photoLooksLike !== market.matchedProduct.title && <> · photo resembles: {market.photoLooksLike}</>}
        </p>
      )}
      {offers.length > 0 && (
        <ul className="mt-3 divide-y divide-ink-200/60">
          {offers.map((o) => (
            <li key={o.url} className="flex justify-between gap-3 py-1.5">
              <a href={o.url} target="_blank" rel="noreferrer nofollow" className="truncate text-clasp-600">
                {o.domain}
              </a>
              <span className="shrink-0">
                {formatMoney(o.cents)} <span className="text-ink-500">{o.kind}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {isSeller && s.referenceCents !== null && (
        <p className="mt-2 text-xs text-ink-500">Your asking price: {formatMoney(askingCents)}.</p>
      )}
    </div>
  );
}
