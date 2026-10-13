import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { humanDuration, loadProof } from "@/lib/proof";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function headline(p: NonNullable<Awaited<ReturnType<typeof loadProof>>>) {
  if (p.mode === "sale") {
    return p.secondsCheckToPaid !== null
      ? `Paid ${humanDuration(p.secondsCheckToPaid)} after the item checked out`
      : "Paid the moment the item checked out";
  }
  return p.chargedCents
    ? `${formatMoney(p.releasedDepositCents ?? 0)} of the deposit returned automatically`
    : "Full deposit returned automatically";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = await loadProof(id);
  if (!p) return { title: "Clasp" };
  const title = `${p.mode === "sale" ? "Verified sale" : "Verified rental"}: ${p.title}`;
  return { title, description: `${headline(p)}. Verified with Clasp: money moves only when the thing does.`, openGraph: { title, type: "website" } };
}

function Step({ done, title, detail, at }: { done: boolean; title: string; detail: string; at: string | null }) {
  return (
    <li className="flex gap-3">
      <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold ${done ? "bg-ok-600 text-white" : "bg-ink-200 text-ink-500"}`}>
        ✓
      </span>
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-ink-500">{detail}</p>
        {at && (
          <time className="text-xs text-ink-500" dateTime={at}>
            {new Date(at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC
          </time>
        )}
      </div>
    </li>
  );
}

export default async function ProofPage({ params }: Props) {
  const { id } = await params;
  const p = await loadProof(id);
  if (!p) notFound();

  return (
    <div className="mx-auto max-w-xl px-4 pt-6 space-y-4">
      <div className="card overflow-hidden p-0">
        {p.coverPhotoId && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api/photos/${p.coverPhotoId}`} alt="" className="h-56 w-full object-cover" />
        )}
        <div className="p-5">
          <p className="text-sm font-medium text-ok-600">✓ Verified {p.mode === "sale" ? "sale" : "rental"} with Clasp</p>
          <h1 className="mt-1 text-2xl font-semibold">{p.title}</h1>
          <p className="mt-2 text-lg">{headline(p)}.</p>
          <p className="mt-1 text-sm text-ink-500">
            {p.mode === "sale"
              ? `${formatMoney(p.priceCents)} from a stranger to ${p.sellerFirstName}. No cash, no "send first", no trust required.`
              : `Rented from ${p.sellerFirstName}. Deposit held by PayPal, never paid to anyone until the item came back.`}
          </p>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold">What Clasp verified</h2>
        <ol className="mt-3 space-y-4">
          <Step done title="Seller proved they had it" detail="Photographed with a one-time code before anyone paid." at={p.verifiedAt} />
          <Step
            done
            title="PayPal held the money"
            detail={p.mode === "sale" ? "Authorized, not charged, until the handoff." : "Fee and deposit authorized together."}
            at={p.heldAt}
          />
          <Step done title={p.mode === "sale" ? "Item checked in the buyer's hands" : "Item checked at return"} detail={p.matchedLabel} at={p.checkedAt} />
          <Step
            done
            title={p.mode === "sale" ? `${p.sellerFirstName} was paid` : "Deposit settled"}
            detail={
              p.mode === "sale"
                ? "Captured and paid out through PayPal."
                : p.chargedCents
                  ? `${formatMoney(p.chargedCents)} charged from a price list agreed up front; the rest released.`
                  : "Nothing charged; the hold was released."
            }
            at={p.paidAt}
          />
        </ol>
      </div>

      <div className="card bg-ink-900 text-white">
        <h2 className="text-lg font-semibold">Buying, selling or renting with a stranger?</h2>
        <p className="mt-1 text-sm text-ink-300">
          Clasp holds the money with PayPal and releases it only when the item checks out. Free for sellers.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href="/new?mode=sale" className="btn bg-white text-ink-900 hover:bg-ink-100">Sell with Clasp</Link>
          <Link href="/new?mode=rental" className="btn border border-white/30 text-white hover:bg-white/10">Rent out</Link>
        </div>
      </div>
      <p className="text-center text-xs text-ink-500">Proof {p.dealId} · PayPal sandbox</p>
    </div>
  );
}
