"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { NotifyButton } from "@/components/NotifyButton";
import { PhotoPicker } from "@/components/PhotoPicker";
import { ShareProof } from "@/components/ShareProof";
import { formatMoney } from "@/lib/money";

type Charge = { reason: string; amountCents: number; evidencePhotoId: string | null };
type Decision =
  | { kind: "sale_handoff"; verdict: "match" | "mismatch" | "rescan" | "locked"; canRelease: boolean; reasons: string[]; photoIds: string[] }
  | { kind: "rental_return"; verdict: "clean" | "charge"; charges: Charge[]; flaggedNotCharged: string[]; totalCents: number; releasedCents: number; photoIds: string[] };

type State = {
  role: "buyer" | "seller" | null;
  listing: {
    id: string;
    mode: "sale" | "rental";
    title: string;
    sellerName: string;
    priceCents: number;
    depositCents: number;
    hasAntiTheftLock: boolean;
    distinctiveFeatures: string[];
    identifierKinds: string[];
    accessories: { name: string }[];
  };
  deal: {
    status: string;
    authorizedCents: number;
    capturedCents: number;
    feeCents: number;
    paidOutCents: number;
    decision: Decision | null;
    pickupInspection: { presentAtPickup: Record<string, boolean>; conditionNotes: string[] } | null;
    clock: { honorEndsAt: string; expiresAt: string; phase: string } | null;
  };
  events: { type: string; at: string; payload: Record<string, unknown> }[];
};

const STATUS: Record<string, { label: string; tone: string }> = {
  awaiting_payment: { label: "Waiting for payment", tone: "bg-ink-100 text-ink-700" },
  held: { label: "Money held by PayPal", tone: "bg-hold-50 text-hold-600" },
  releasing: { label: "Paying seller…", tone: "bg-hold-50 text-hold-600" },
  released: { label: "Seller paid", tone: "bg-ok-50 text-ok-600" },
  picking_up: { label: "Recording pickup…", tone: "bg-hold-50 text-hold-600" },
  active: { label: "Rented out · deposit held", tone: "bg-clasp-50 text-clasp-600" },
  returned: { label: "Returned · awaiting settlement", tone: "bg-hold-50 text-hold-600" },
  settling: { label: "Settling…", tone: "bg-hold-50 text-hold-600" },
  settled: { label: "Settled", tone: "bg-ok-50 text-ok-600" },
  voiding: { label: "Cancelling hold…", tone: "bg-ink-100 text-ink-700" },
  voided: { label: "Cancelled · no money moved", tone: "bg-ink-100 text-ink-700" },
};

function eventLabel(e: State["events"][number]): string {
  const p = e.payload as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const amt = p.amount?.value ? ` $${p.amount.value}` : "";
  const map: Record<string, string> = {
    "paypal.order.created": "PayPal order created",
    "paypal.authorized": `PayPal hold placed${amt}`,
    "paypal.reauthorized": "Hold renewed with PayPal",
    "paypal.capture": `PayPal captured${amt} (${String(p.purpose ?? "").replace("_", " ")})`,
    "paypal.payout": `Payout sent to seller${amt}`,
    "dispute.seen": `Buyer opened a PayPal dispute (${p.disputeId ?? ""})`,
    "dispute.evidence_submitted": "Clasp sent the handoff record to PayPal as evidence",
    "dispute.defense_failed": "Couldn't send evidence automatically. Use “Send record to PayPal”",
    "paypal.voided": "PayPal hold cancelled, money released",
    "paypal.hold_lapses": "Remaining hold will lapse on its own; nothing more can be charged",
    "deal.cancelled": `Deal cancelled by the ${p.by ?? "buyer"}`,
    "handoff.match": "Handoff scan: identity matches",
    "handoff.mismatch": "Handoff scan: NOT the listed item",
    "handoff.rescan": "Handoff scan: another photo needed",
    "handoff.locked": "Handoff scan: device is locked",
    "rental.pickup_recorded": "Pickup condition recorded",
    "rental.return_clean": "Return scan: clean",
    "rental.return_charge": "Return scan: agreed charges found",
    "deal.released": "Deal complete",
    "deal.settled": "Rental settled",
  };
  const webhook: Record<string, string> = {
    "CHECKOUT.ORDER.APPROVED": "buyer approved the payment",
    "PAYMENT.AUTHORIZATION.CREATED": "funds are on hold",
    "PAYMENT.AUTHORIZATION.VOIDED": "hold released",
    "PAYMENT.CAPTURE.COMPLETED": "payment captured",
    "PAYMENT.CAPTURE.PENDING": "capture pending",
    "PAYMENT.CAPTURE.DECLINED": "capture declined",
    "PAYMENT.CAPTURE.REFUNDED": "payment refunded",
    "PAYMENT.CAPTURE.REVERSED": "payment reversed",
    "PAYMENT.PAYOUTSBATCH.SUCCESS": "payout batch processed",
    "PAYMENT.PAYOUTS-ITEM.SUCCEEDED": "seller received the payout",
    "PAYMENT.PAYOUTS-ITEM.UNCLAIMED": "payout waiting to be claimed",
    "PAYMENT.PAYOUTS-ITEM.FAILED": "payout failed",
    "CUSTOMER.DISPUTE.CREATED": "dispute opened",
    "CUSTOMER.DISPUTE.UPDATED": "dispute updated",
    "CUSTOMER.DISPUTE.RESOLVED": "dispute resolved",
  };
  if (e.type.startsWith("webhook.")) {
    const name = e.type.slice(8);
    return `PayPal confirmed: ${webhook[name] ?? name}${amt}`;
  }
  return map[e.type] ?? e.type;
}

function useCountdown(target: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!target) return null;
  const ms = new Date(target).getTime() - now;
  if (ms <= 0) return "ended";
  const h = Math.floor(ms / 3_600_000);
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${Math.floor((ms % 3_600_000) / 60_000)}m`;
}

export function DealRoom({ id, urlKey, initialError }: { id: string; urlKey: string | null; initialError?: string | null }) {
  const [key, setKey] = useState<string | null>(urlKey);
  const [state, setState] = useState<State | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (urlKey) return;
    try {
      setKey(localStorage.getItem(`clasp:deal:${id}`));
    } catch {}
  }, [id, urlKey]);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/deals/${id}${key ? `?k=${encodeURIComponent(key)}` : ""}`, { cache: "no-store" });
    const data = await res.json();
    if (res.ok) setState(data);
    else setError(data.error);
  }, [id, key]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, [refresh]);

  const honorLeft = useCountdown(state?.deal.clock?.honorEndsAt);

  async function act(path: string, label: string, withPhotos = false) {
    setError(null);
    setNotice(null);
    setBusy(label);
    try {
      let res: Response;
      if (withPhotos) {
        const form = new FormData();
        form.set("key", key ?? "");
        photos.forEach((p) => form.append("photos", p));
        res = await fetch(`/api/deals/${id}/${path}`, { method: "POST", body: form });
      } else {
        res = await fetch(`/api/deals/${id}/${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.paypalDebugId ? `${data.error} · PayPal debug id ${data.paypalDebugId}` : data.error);
      setPhotos([]);
      if (path === "defend") {
        const results = (data.results ?? []) as { outcome: string; disputeId: string }[];
        setNotice(
          results.length === 0
            ? "No PayPal disputes on this deal."
            : results.map((r) => (r.outcome === "submitted" ? `Record sent to PayPal for dispute ${r.disputeId}.` : r.outcome === "already_submitted" ? `Record already sent for dispute ${r.disputeId}.` : `Dispute ${r.disputeId} found; PayPal isn't asking for evidence yet.`)).join(" "),
        );
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  if (!state) return <p className="pt-10 text-center text-ink-500">{error ?? "Loading…"}</p>;
  const { listing, deal, role } = state;
  const status = STATUS[deal.status] ?? { label: deal.status, tone: "bg-ink-100" };
  const held = deal.authorizedCents - deal.capturedCents;
  const isOpenHold = ["held", "active", "returned"].includes(deal.status);
  const decision = deal.decision;

  const scanner = (title: string, hint: string, path: string, cta: string) => (
    <div className="card space-y-3">
      <h2 className="font-semibold">{title}</h2>
      <PhotoPicker files={photos} onChange={setPhotos} hint={hint} />
      <button className="btn-primary" disabled={!!busy || photos.length === 0} onClick={() => act(path, cta, true)}>
        {busy === cta ? "AI is checking the photos…" : cta}
      </button>
    </div>
  );

  return (
    <div className="space-y-4 pt-2">
      <div className="card">
        <p className="text-sm text-ink-500">
          {listing.mode === "sale" ? "Purchase" : "Rental"} from {listing.sellerName}
          {role && ` · you are the ${role === "seller" ? (listing.mode === "sale" ? "seller" : "owner") : listing.mode === "sale" ? "buyer" : "renter"}`}
        </p>
        <h1 className="mt-0.5 text-xl font-semibold">{listing.title}</h1>
        <span className={`mt-3 inline-block rounded-full px-3 py-1 text-sm font-medium ${status.tone}`}>{status.label}</span>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-ink-50 p-3">
            <p className="text-ink-500">Still held</p>
            <p className="text-lg font-semibold">{formatMoney(isOpenHold ? held : 0)}</p>
          </div>
          <div className="rounded-xl bg-ink-50 p-3">
            <p className="text-ink-500">Paid to {listing.mode === "sale" ? "seller" : "owner"}</p>
            <p className="text-lg font-semibold">{formatMoney(deal.paidOutCents)}</p>
          </div>
        </div>
        {deal.feeCents > 0 && (
          <p className="mt-3 text-xs text-ink-500">
            Includes a {formatMoney(deal.feeCents)} Clasp buyer protection fee, charged only when the deal completes. The{" "}
            {listing.mode === "sale" ? "seller" : "owner"} receives their full {formatMoney(listing.priceCents)}.
          </p>
        )}
        {deal.status === "held" && honorLeft && (
          <p className="mt-3 text-xs text-ink-500">
            PayPal guarantees the hold for {honorLeft === "ended" ? "—" : honorLeft} more; after that Clasp renews it (up to 29 days).
          </p>
        )}
      </div>

      {decision?.kind === "sale_handoff" && (
        <div
          className={`card ${
            decision.verdict === "match" ? "border-ok-600/30 bg-ok-50" : decision.verdict === "rescan" ? "border-hold-600/30 bg-hold-50" : "border-bad-600/30 bg-bad-50"
          }`}
        >
          <p className="font-semibold">
            {decision.verdict === "match" && "✓ This is the listed item"}
            {decision.verdict === "mismatch" && "✕ This is NOT the listed item"}
            {decision.verdict === "locked" && "✕ The device is still locked"}
            {decision.verdict === "rescan" && "One more photo needed"}
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm">{decision.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          <div className="mt-3 flex gap-2">
            {decision.photoIds.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p} src={`/api/photos/${p}?k=${encodeURIComponent(key ?? "")}`} alt="Handoff scan" className="h-20 w-20 rounded-lg object-cover" />
            ))}
          </div>
          {decision.verdict !== "match" && <p className="mt-2 text-sm">No money has moved. The hold stays until you rescan or cancel.</p>}
        </div>
      )}

      {decision?.kind === "rental_return" && (
        <div className={`card ${decision.verdict === "clean" ? "border-ok-600/30 bg-ok-50" : "border-hold-600/30 bg-hold-50"}`}>
          <p className="font-semibold">{decision.verdict === "clean" ? "✓ Returned in the same condition" : "Agreed charges found"}</p>
          {decision.charges.length > 0 && (
            <ul className="mt-2 divide-y divide-ink-200 text-sm">
              {decision.charges.map((c) => (
                <li key={c.reason} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex items-center gap-2">
                    {c.evidencePhotoId && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/photos/${c.evidencePhotoId}?k=${encodeURIComponent(key ?? "")}`} alt="" className="h-10 w-10 rounded object-cover" />
                    )}
                    {c.reason}
                  </span>
                  <span className="font-medium">{formatMoney(c.amountCents)}</span>
                </li>
              ))}
            </ul>
          )}
          {decision.flaggedNotCharged.length > 0 && (
            <div className="mt-2 text-sm text-ink-700">
              <p className="font-medium">Flagged, not charged</p>
              <ul className="list-disc pl-5">{decision.flaggedNotCharged.map((f) => <li key={f}>{f}</li>)}</ul>
            </div>
          )}
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <p>Charged: <strong>{formatMoney(decision.totalCents)}</strong></p>
            <p>Back to renter: <strong>{formatMoney(decision.releasedCents)}</strong></p>
          </div>
        </div>
      )}

      {/* ---------- actions ---------- */}
      {listing.mode === "sale" && deal.status === "held" && role === "buyer" && (
        <>
          {decision?.kind === "sale_handoff" && decision.canRelease ? (
            <button className="btn-primary" disabled={!!busy} onClick={() => act("release", "release")}>
              {busy === "release" ? "Paying seller…" : `Release ${formatMoney(listing.priceCents)} to ${listing.sellerName}`}
            </button>
          ) : (
            scanner(
              "At the handoff: scan the item",
              [
                listing.identifierKinds.length
                  ? `Photograph the ${listing.identifierKinds.join(" / ")} on the item in hand.`
                  : `Photograph these marks up close: ${listing.distinctiveFeatures.join("; ")}.`,
                listing.hasAntiTheftLock
                  ? "Also photograph the Find My / Find Hub screen with its main switch off. One scan or separate scans both work."
                  : "",
              ].join(" "),
              "handoff",
              "Check this item",
            )
          )}
          <button className="btn-danger" disabled={!!busy} onClick={() => act("cancel", "cancel")}>Cancel and release my hold</button>
        </>
      )}
      {listing.mode === "sale" && deal.status === "held" && role === "seller" && (
        <div className="card text-sm text-ink-700">
          The buyer&apos;s money is held. At the meetup, they scan the item. If it matches your verified listing, you&apos;re paid instantly.
        </div>
      )}

      {listing.mode === "rental" && deal.status === "held" && role === "buyer" &&
        scanner(
          "At pickup: record what you received",
          `Photograph the item from all sides and lay out every accessory (${listing.accessories.map((a) => a.name).join(", ") || "none listed"}). This protects you at return.`,
          "pickup",
          "Record pickup and pay the fee",
        )}
      {listing.mode === "rental" && deal.status === "held" && (
        <button className="btn-danger" disabled={!!busy || !role} onClick={() => act("cancel", "cancel")}>Cancel and release the hold</button>
      )}
      {listing.mode === "rental" && deal.status === "active" && deal.pickupInspection && (
        <div className="card text-sm">
          <p className="font-medium">Recorded at pickup</p>
          <ul className="mt-1 list-disc pl-5 text-ink-700">
            {Object.entries(deal.pickupInspection.presentAtPickup).map(([name, present]) => (
              <li key={name}>{name}: {present ? "received" : "not seen (can't be charged)"}</li>
            ))}
            {deal.pickupInspection.conditionNotes.map((n) => <li key={n}>Existing: {n}</li>)}
          </ul>
        </div>
      )}
      {listing.mode === "rental" && deal.status === "active" && role === "seller" &&
        scanner("At return: scan the item back in", "Same angles as pickup, with every accessory laid out.", "return", "Compare with pickup")}
      {listing.mode === "rental" && deal.status === "returned" && role === "seller" && decision?.kind === "rental_return" && (
        <button className="btn-primary" disabled={!!busy} onClick={() => act("settle", "settle")}>
          {busy === "settle"
            ? "Settling with PayPal…"
            : decision.totalCents > 0
              ? `Charge ${formatMoney(decision.totalCents)} · release ${formatMoney(decision.releasedCents)}`
              : `Release the full ${formatMoney(listing.depositCents)} deposit`}
        </button>
      )}

      {(deal.status === "released" || deal.status === "settled") && (
        <div className="card space-y-3 text-center">
          <p className="text-lg font-semibold">Done. Nobody had to trust anybody.</p>
          <p className="text-sm text-ink-500">
            {role === "seller"
              ? "Share your proof. It's how buyers know you're the real deal next time."
              : "Share the proof, or use Clasp for your next deal."}
          </p>
          <ShareProof dealId={id} title={listing.title} />
          <Link href="/new" className="btn-secondary">Sell or rent something with Clasp</Link>
        </div>
      )}

      {role && deal.capturedCents > 0 && (
        <div className="card space-y-2 text-sm">
          <h2 className="font-semibold">Your record</h2>
          <p className="text-ink-500">
            Photos, match results and the PayPal timeline in one PDF. If the buyer ever opens a PayPal dispute, Clasp sends it to PayPal automatically.
          </p>
          <a className="btn-secondary" href={`/api/deals/${id}/record?k=${encodeURIComponent(key ?? "")}`} target="_blank" rel="noreferrer">
            Download handoff record (PDF)
          </a>
          {role === "seller" && (
            <button className="btn-secondary" disabled={!!busy} onClick={() => act("defend", "defend")}>
              {busy === "defend" ? "Checking PayPal for disputes…" : "Check for disputes and send record to PayPal"}
            </button>
          )}
        </div>
      )}

      {role && key && !["released", "settled", "voided"].includes(deal.status) && (
        <NotifyButton subscriptionKey={key} dealId={id} label={listing.mode === "rental" && role === "buyer" ? "Notify me when my deposit is back" : "Notify me about this deal"} />
      )}

      {notice && <p className="text-sm text-ok-600">{notice}</p>}
      {error && <p className="text-sm text-bad-600">{error}</p>}

      <div className="card">
        <h2 className="text-sm font-semibold">Timeline</h2>
        <ol className="mt-2 space-y-2 text-sm">
          {state.events.map((e, i) => (
            <li key={i} className="flex justify-between gap-3">
              <span className={e.type.startsWith("webhook.") ? "text-clasp-600" : ""}>{eventLabel(e)}</span>
              <time className="shrink-0 text-ink-500">{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
