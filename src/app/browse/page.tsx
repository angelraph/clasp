import type { Metadata } from "next";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { searchListings } from "@/lib/search";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Browse verified listings · Clasp",
  description: "Second-hand items and rentals verified in the seller's hands. Pay into a PayPal hold; money moves only when the item checks out.",
};

type Props = { searchParams: Promise<{ q?: string; where?: string; mode?: string }> };

export default async function BrowsePage({ searchParams }: Props) {
  const { q = "", where = "", mode } = await searchParams;
  const results = await searchListings({
    query: q,
    location: where || undefined,
    mode: mode === "sale" || mode === "rental" ? mode : undefined,
    limit: 40,
  });

  return (
    <div className="space-y-4 pt-2">
      <h1 className="text-2xl font-semibold">Verified listings</h1>
      <form className="card space-y-3" action="/browse">
        <input name="q" defaultValue={q} className="field" placeholder="What are you looking for?" />
        <div className="grid grid-cols-2 gap-2">
          <input name="where" defaultValue={where} className="field" placeholder="City or area" />
          <select name="mode" defaultValue={mode ?? ""} className="field">
            <option value="">Buy or rent</option>
            <option value="sale">For sale</option>
            <option value="rental">For rent</option>
          </select>
        </div>
        <button className="btn-primary">Search</button>
      </form>

      {results.length === 0 ? (
        <p className="card text-center text-sm text-ink-500">Nothing verified matches yet. <Link className="text-clasp-600" href="/new">List something</Link>.</p>
      ) : (
        <ul className="space-y-2">
          {results.map((r) => (
            <li key={r.id}>
              <Link href={`/l/${r.id}`} className="card block hover:border-ink-300">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="text-sm text-ink-500">
                      {r.mode === "sale" ? "For sale" : "For rent"}
                      {r.location && ` · ${r.location}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold">{formatMoney(r.priceCents)}</p>
                    {r.mode === "rental" && <p className="text-xs text-ink-500">+ {formatMoney(r.depositCents)} deposit</p>}
                  </div>
                </div>
                <p className="mt-2 text-xs text-ok-600">✓ Verified in the seller&apos;s hands · {r.verifiedBy}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
