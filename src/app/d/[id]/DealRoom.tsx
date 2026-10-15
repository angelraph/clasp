"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { NotifyButton } from "@/components/NotifyButton";
import { PhotoPicker } from "@/components/PhotoPicker";
import { ShareProof } from "@/components/ShareProof";
import { DEAL_STATUS, Status } from "@/components/Status";
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
    "support.ticket_opened": `Support ticket ${p.ticket ?? ""} opened`,
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

  if (!state) return <p className="mx-auto max-w-xl px-4 pt-16 text-center text-ink-500">{error ?? "Loading…"}</p>;
  const { listing, deal, role } = state;
  const s = DEAL_STATUS[deal.status] ?? { word: deal.status, tone: "muted" as const, line: "" };
  const held = deal.authorizedCents - deal.capturedCents;
  const isOpenHold = ["held", "active", "returned", "releasing", "picking_up", "settling"].includes(deal.status);
  const decision = deal.decision;
  const party = listing.mode === "sale" ? "seller" : "owner";
  const youAre = role === "seller" ? party : role === "buyer" ? (listing.mode === "sale" ? "buyer" : "renter") : null;

  // The one number that matters right now.
  const hero =
    deal.status === "released"
      ? { cents: deal.paidOutCents, label: `paid to ${listing.sellerName.split(/\s+/)[0]}` }
      : deal.status === "settled" && decision?.kind === "rental_return"
        ? { cents: decision.releasedCents, label: "of the deposit released" }
        : deal.status === "voided"
          ? { cents: 0, label: "charged" }
          : { cents: isOpenHold ? held : deal.authorizedCents, label: isOpenHold ? "held by PayPal, not charged" : "to authorize" };

  const scanner = (title: string, hint: string, path: string, cta: string) => (
    <div className="card space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-ink-500">{hint}</p>
      </div>
      <PhotoPicker files={photos} onChange={setPhotos} />
      <button className="btn-primary" disabled={!!busy || photos.length === 0} onClick={() => act(path, cta, true)}>
        {busy === cta ? "Reading the photos…" : cta}
      </button>
    </div>
  );

  const thumb = (p: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={p} src={`/api/photos/${p}?k=${encodeURIComponent(key ?? "")}`} alt="Scan" className="aspect-square w-full rounded-[10px] object-cover" />
  );

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 pb-16 pt-6">
      {/* header: status word, the one amount, nothing else */}
      <section>
        <p className="text-sm text-ink-500">
          {listing.mode === "sale" ? "Purchase" : "Rental"} · {listing.title}
          {youAre && <span className="text-ink-300"> · you&apos;re the {youAre}</span>}
        </p>
        <div className="mt-4">
          <Status tone={s.tone} pulse={deal.status === "held"}>{s.word}</Status>
        </div>
        <p className="amount mt-2 text-6xl leading-none">{formatMoney(hero.cents)}</p>
        <p className="mt-2 text-ink-500">{hero.label}</p>

        <dl className="mt-6 grid grid-cols-3 divide-x divide-line border-y border-line text-sm">
          <div className="py-3 pr-3">
            <dt className="text-ink-500">Authorized</dt>
            <dd className="amount mt-0.5 text-base">{formatMoney(deal.authorizedCents)}</dd>
          </div>
          <div className="px-3 py-3">
            <dt className="text-ink-500">Captured</dt>
            <dd className="amount mt-0.5 text-base">{formatMoney(deal.capturedCents)}</dd>
          </div>
          <div className="py-3 pl-3">
            <dt className="text-ink-500">To {party}</dt>
            <dd className="amount mt-0.5 text-base">{formatMoney(deal.paidOutCents)}</dd>
          </div>
        </dl>
        {deal.status === "held" && honorLeft && (
          <p className="mt-3 text-xs text-ink-500">
            Guaranteed by PayPal for {honorLeft === "ended" ? "a little longer" : honorLeft}; Clasp renews it automatically, up to 29 days.
          </p>
        )}
        {deal.feeCents > 0 && (
          <p className="mt-1 text-xs text-ink-500">
            Includes {formatMoney(deal.feeCents)} buyer protection. The {party} receives their full {formatMoney(listing.priceCents)}.
          </p>
        )}
      </section>

      {/* the latest verdict */}
      {decision?.kind === "sale_handoff" && (
        <section
          className={`rounded-[10px] border p-5 ${
            decision.verdict === "match"
              ? "border-matched/25 bg-matched-tint"
              : decision.verdict === "rescan"
                ? "border-line bg-card"
                : "border-oxblood/25 bg-oxblood-tint"
          }`}
        >
          <Status tone={decision.verdict === "match" ? "matched" : decision.verdict === "rescan" ? "kept" : "oxblood"}>
            {decision.verdict === "match" ? "Matched" : decision.verdict === "mismatch" ? "Mismatch" : decision.verdict === "locked" ? "Locked" : "One more photo"}
          </Status>
          <p className="mt-2 text-lg font-medium">
            {decision.verdict === "match" && "This is the listed item."}
            {decision.verdict === "mismatch" && "This is not the listed item."}
            {decision.verdict === "locked" && "The device's anti-theft lock is on."}
            {decision.verdict === "rescan" && "Almost there. One more photo needed."}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            {decision.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
          {decision.photoIds.length > 0 && <div className="mt-4 grid grid-cols-4 gap-2">{decision.photoIds.slice(-4).map(thumb)}</div>}
          {decision.verdict !== "match" && <p className="mt-3 text-sm text-ink-500">No money has moved. The hold stays until you scan again or cancel.</p>}
        </section>
      )}

      {decision?.kind === "rental_return" && (
        <section className="rounded-[10px] border border-line bg-card p-5">
          <Status tone={decision.verdict === "clean" ? "matched" : "kept"}>{decision.verdict === "clean" ? "Clean return" : "Kept"}</Status>
          <p className="mt-2 text-lg font-medium">{decision.verdict === "clean" ? "Returned in the same condition." : "Charges from the agreed list."}</p>
          {decision.charges.length > 0 && (
            <ul className="mt-3 divide-y divide-line border-y border-line text-sm">
              {decision.charges.map((c) => (
                <li key={c.reason} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="flex items-center gap-3">
                    {c.evidencePhotoId && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={`/api/photos/${c.evidencePhotoId}?k=${encodeURIComponent(key ?? "")}`} alt="" className="h-10 w-10 rounded-[6px] object-cover" />
                    )}
                    {c.reason}
                  </span>
                  <span className="amount">{formatMoney(c.amountCents)}</span>
                </li>
              ))}
            </ul>
          )}
          {decision.flaggedNotCharged.length > 0 && (
            <div className="mt-4 text-sm">
              <p className="status text-ink-500">Flagged, not charged</p>
              <ul className="mt-1 space-y-1 text-ink-700">
                {decision.flaggedNotCharged.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="status text-kept">Kept</dt>
              <dd className="amount text-xl">{formatMoney(decision.totalCents)}</dd>
            </div>
            <div>
              <dt className="status text-ink-700">Released</dt>
              <dd className="amount text-xl">{formatMoney(decision.releasedCents)}</dd>
            </div>
          </dl>
        </section>
      )}

      {/* the one thing to do next */}
      {listing.mode === "sale" && deal.status === "held" && role === "buyer" && (
        <div className="space-y-3">
          {decision?.kind === "sale_handoff" && decision.canRelease ? (
            <button className="btn-primary py-4 text-base" disabled={!!busy} onClick={() => act("release", "release")}>
              {busy === "release" ? "Paying the seller…" : `Release ${formatMoney(listing.priceCents)} to ${listing.sellerName.split(/\s+/)[0]}`}
            </button>
          ) : (
            scanner(
              "Scan the item in your hands",
              [
                listing.identifierKinds.length
                  ? `Photograph the ${listing.identifierKinds.join(" / ")} on the device you're holding (on a phone, dial *#06# yourself).`
                  : `Photograph these marks up close: ${listing.distinctiveFeatures.join("; ")}.`,
                listing.hasAntiTheftLock ? "Also photograph the Find My / Find Hub screen with its main switch off. One scan or separate scans both work." : "",
              ].join(" "),
              "handoff",
              "Check this item",
            )
          )}
          <button className="w-full py-2 text-sm text-ink-500 hover:text-oxblood" disabled={!!busy} onClick={() => act("cancel", "cancel")}>
            Cancel and release my hold
          </button>
        </div>
      )}
      {listing.mode === "sale" && deal.status === "held" && role === "seller" && (
        <p className="rounded-[10px] border border-line bg-card p-5 text-ink-700">
          The buyer&apos;s money is held. At the meetup they scan the item; if it matches your verified listing, you&apos;re paid on the spot.
        </p>
      )}

      {listing.mode === "rental" &&
        deal.status === "held" &&
        role === "buyer" &&
        scanner(
          "Record what you received",
          `Photograph the item from all sides with every accessory laid out (${listing.accessories.map((a) => a.name).join(", ") || "none listed"}). This protects you at return.`,
          "pickup",
          "Record pickup and pay the fee",
        )}
      {listing.mode === "rental" && deal.status === "held" && role && (
        <button className="w-full py-2 text-sm text-ink-500 hover:text-oxblood" disabled={!!busy} onClick={() => act("cancel", "cancel")}>
          Cancel and release the hold
        </button>
      )}
      {listing.mode === "rental" && deal.status === "active" && deal.pickupInspection && (
        <section className="rounded-[10px] border border-line bg-card p-5 text-sm">
          <p className="status text-ink-500">Recorded at pickup</p>
          <ul className="mt-2 space-y-1 text-ink-700">
            {Object.entries(deal.pickupInspection.presentAtPickup).map(([name, present]) => (
              <li key={name} className="flex justify-between">
                <span>{name}</span>
                <span className={present ? "text-matched" : "text-ink-500"}>{present ? "received" : "not seen · can't be charged"}</span>
              </li>
            ))}
            {deal.pickupInspection.conditionNotes.map((n) => (
              <li key={n} className="text-ink-500">Existing: {n}</li>
            ))}
          </ul>
        </section>
      )}
      {listing.mode === "rental" &&
        deal.status === "active" &&
        role === "seller" &&
        scanner("Scan it back in", "Same angles as pickup, with every accessory laid out.", "return", "Compare with pickup")}
      {listing.mode === "rental" && deal.status === "returned" && role === "seller" && decision?.kind === "rental_return" && (
        <button className="btn-primary py-4 text-base" disabled={!!busy} onClick={() => act("settle", "settle")}>
          {busy === "settle"
            ? "Settling with PayPal…"
            : decision.totalCents > 0
              ? `Keep ${formatMoney(decision.totalCents)} · release ${formatMoney(decision.releasedCents)}`
              : `Release the full ${formatMoney(listing.depositCents)} deposit`}
        </button>
      )}

      {(deal.status === "released" || deal.status === "settled") && (
        <section className="space-y-3 rounded-[10px] border border-line bg-card p-5 text-center">
          <p className="font-serif text-2xl">Nobody had to trust anybody.</p>
          <p className="text-sm text-ink-500">
            {role === "seller" ? "Share your proof. It's how the next buyer knows you're the real deal." : "Share the proof, or use Clasp for your next deal."}
          </p>
          <ShareProof dealId={id} title={listing.title} />
          <Link href="/new" className="btn-secondary">Sell or rent something with Clasp</Link>
        </section>
      )}

      {role && deal.capturedCents > 0 && (
        <section className="space-y-2">
          <a className="btn-secondary" href={`/api/deals/${id}/record?k=${encodeURIComponent(key ?? "")}`} target="_blank" rel="noreferrer">
            Download the handoff record (PDF)
          </a>
          {role === "seller" && (
            <button className="btn-secondary" disabled={!!busy} onClick={() => act("defend", "defend")}>
              {busy === "defend" ? "Checking PayPal for disputes…" : "Check for disputes and send the record"}
            </button>
          )}
          <p className="text-xs text-ink-500">If the buyer ever opens a PayPal dispute, Clasp sends this record to PayPal automatically.</p>
        </section>
      )}

      {role && key && !["released", "settled", "voided"].includes(deal.status) && (
        <NotifyButton
          subscriptionKey={key}
          dealId={id}
          label={listing.mode === "rental" && role === "buyer" ? "Notify me when my deposit is back" : "Notify me about this deal"}
        />
      )}

      {notice && <p className="text-sm text-matched">{notice}</p>}
      {error && <p className="rounded-[10px] border border-oxblood/25 bg-oxblood-tint px-4 py-3 text-sm text-oxblood">{error}</p>}

      {/* activity: one quiet line per event, Linear-style */}
      <section>
        <p className="status text-ink-500">Activity</p>
        <ol className="relative mt-3 space-y-3 border-l border-line pl-5">
          {state.events.map((e, i) => {
            const fromPayPal = e.type.startsWith("webhook.");
            const isMoney = e.type.startsWith("paypal.") || fromPayPal;
            return (
              <li key={i} className="relative text-sm">
                <span
                  className={`absolute -left-[24.5px] top-1.5 h-2 w-2 rounded-full ring-4 ring-paper ${
                    e.type.includes("mismatch") ? "bg-oxblood" : fromPayPal ? "bg-matched" : isMoney ? "bg-brass" : "bg-ink-300"
                  }`}
                />
                <div className="flex items-baseline justify-between gap-3">
                  <span className={isMoney ? "text-ink-900" : "text-ink-700"}>{eventLabel(e)}</span>
                  <time className="shrink-0 text-xs text-ink-500" dateTime={e.at}>
                    {ago(e.at)}
                  </time>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}
