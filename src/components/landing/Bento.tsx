"use client";

import { useEffect, useRef, useState } from "react";
import { ItemSketch } from "./ItemSketch";

function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setSeen(true), io.disconnect()), { threshold: 0.3 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}

function useLoop(steps: number, ms: number, active: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setN((x) => (x + 1) % steps), ms);
    return () => clearInterval(t);
  }, [steps, ms, active]);
  return n;
}

function Card({ title, body, children, className = "" }: { title: string; body: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col overflow-hidden rounded-[10px] border border-line bg-card ${className}`}>
      <div className="p-6 pb-0">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 max-w-sm text-sm text-ink-500">{body}</p>
      </div>
      <div className="relative mt-6 flex flex-1 items-end">{children}</div>
    </div>
  );
}

/** The seller's possession photo: a one-time code on paper beside the item. */
export function PossessionCard() {
  return (
    <Card title="Prove you have it" body="A one-time code on paper, photographed with the item. Fake listings can't produce it.">
      <div className="mx-6 mb-6 flex w-full items-end gap-4">
        <ItemSketch className="w-1/2" />
        <div className="mb-6 -rotate-3 rounded-[4px] border border-line bg-paper px-5 py-4 shadow-[0_8px_20px_-12px_rgba(20,20,19,0.3)]">
          <p className="font-serif text-4xl italic tracking-[0.2em] text-ink-900">E7HX</p>
          <p className="status mt-2 text-matched">Code read · matches</p>
        </div>
      </div>
    </Card>
  );
}

/** A receipt that shows the hold: price, protection, held, paid. */
export function HoldCard() {
  return (
    <Card title="Held, not charged" body="The buyer approves in PayPal. The money waits in a hold until the item checks out.">
      <div className="mx-6 mb-6 w-full rounded-[10px] border border-line bg-paper p-5">
        <div className="flex items-center justify-between">
          <span className="status text-brass-ink"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brass" />Clasped</span>
          <span className="serial text-ink-500">AUTH 8MF54…482J</span>
        </div>
        <p className="amount mt-3 text-4xl">$262.50</p>
        <dl className="mt-4 space-y-1.5 border-t border-dashed border-line pt-3 text-sm">
          <div className="flex justify-between"><dt className="text-ink-500">Price</dt><dd className="amount">$250.00</dd></div>
          <div className="flex justify-between"><dt className="text-ink-500">Buyer protection</dt><dd className="amount">$12.50</dd></div>
          <div className="flex justify-between"><dt className="text-ink-500">Guaranteed hold</dt><dd>3 days, renewable to 29</dd></div>
        </dl>
      </div>
    </Card>
  );
}

/** Alternates a genuine handoff with a swapped device, so the refusal is visible. */
export function SwitchCard() {
  const [ref, seen] = useInView<HTMLDivElement>();
  const n = useLoop(2, 3200, seen);
  const swap = n === 1;
  return (
    <div ref={ref} className="contents">
      <Card title="The switch gets caught" body="At the meetup the buyer scans the item. A different device, or a locked one, and nothing is charged.">
        <div className="mx-6 mb-6 w-full space-y-3">
          <div className="flex items-center justify-between rounded-[10px] border border-line bg-paper px-4 py-3">
            <span className="text-xs text-ink-500">Listed</span>
            <span className="serial">IMEI ···· 5066</span>
          </div>
          <div className={`flex items-center justify-between rounded-[10px] border px-4 py-3 transition-colors duration-500 ${swap ? "border-oxblood/30 bg-oxblood-tint" : "border-matched/25 bg-matched-tint"}`}>
            <span className="text-xs text-ink-500">In hand</span>
            <span className="serial">{swap ? "IMEI 3534 7959 4878 398" : "IMEI 8694 9606 6195 066"}</span>
          </div>
          <p className={`status transition-colors duration-500 ${swap ? "text-oxblood" : "text-matched"}`}>
            {swap ? "Mismatch · hold stays · $0 charged" : "Matched · $250.00 released"}
          </p>
        </div>
      </Card>
    </div>
  );
}

/** A rental deposit splitting into what's kept and what goes back. */
export function DepositCard() {
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="contents">
      <Card title="Deposits settle themselves" body="Only damage from a price list both sides saw up front can be charged. The rest goes back automatically.">
        <div className="mx-6 mb-6 w-full">
          <div className="flex h-10 overflow-hidden rounded-[10px] border border-line">
            <div
              className="flex origin-left items-center justify-center bg-kept-tint text-xs font-medium text-kept"
              style={{ width: "18%", animation: seen ? "fill-bar 1s 0.2s cubic-bezier(.2,.7,.2,1) both" : "none" }}
            >
              $25
            </div>
            <div
              className="flex flex-1 origin-left items-center justify-center bg-paper text-xs text-ink-700"
              style={{ animation: seen ? "fill-bar 1.2s 0.5s cubic-bezier(.2,.7,.2,1) both" : "none" }}
            >
              $275 back to renter
            </div>
          </div>
          <dl className="mt-3 space-y-1.5 text-sm">
            <div className="flex justify-between"><dt><span className="status text-kept">Kept</span> <span className="text-ink-500">Missing charger</span></dt><dd className="amount">$25.00</dd></div>
            <div className="flex justify-between"><dt><span className="status text-ink-700">Released</span></dt><dd className="amount">$275.00</dd></div>
          </dl>
        </div>
      </Card>
    </div>
  );
}

/** The handoff record, filed with PayPal if a buyer disputes later. */
export function RecordCard() {
  return (
    <Card title="Your proof, already filed" body="If a buyer disputes later, Clasp sends PayPal the record: possession photo, match, and the payment timeline.">
      <div className="relative mx-6 mb-0 h-44 w-full">
        {[2, 1, 0].map((k) => (
          <div
            key={k}
            className="absolute inset-x-6 top-0 rounded-t-[10px] border border-b-0 border-line bg-paper p-4"
            style={{ transform: `translateY(${k * 10}px) scale(${1 - k * 0.04})`, zIndex: 3 - k, opacity: 1 - k * 0.25 }}
          >
            {k === 0 && (
              <>
                <p className="font-serif text-lg">Clasp handoff record</p>
                <div className="mt-3 space-y-1.5">
                  {[90, 70, 82, 55].map((w, j) => (
                    <div key={j} className="h-1.5 rounded-full bg-ink-100" style={{ width: `${w}%` }} />
                  ))}
                </div>
                <p className="status mt-4 text-matched">Sent to PayPal · Disputes API</p>
              </>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

const AGENT_LINES = [
  ["›", "search_verified_listings", "{ query: \"camera\", location: \"Lagos\" }"],
  ["‹", "3 verified listings", "Sony A7 III · $45/day · deposit $300"],
  ["›", "start_protected_purchase", "{ listing_id: \"y7d7hnzm8gxw\" }"],
  ["‹", "awaiting_human_approval", "approve_in_paypal → paypal.com/checkoutnow?…"],
];

/** An agent session: it can find and start, never pay. */
export function AgentCard() {
  const [ref, seen] = useInView<HTMLDivElement>();
  const n = useLoop(AGENT_LINES.length + 2, 1100, seen);
  return (
    <div ref={ref} className="contents">
      <Card title="Agents commit. People approve." body="AI shopping agents can find verified listings and start a purchase over MCP. Only the human can approve the hold.">
        <div className="mx-6 mb-6 min-h-[150px] w-full rounded-[10px] bg-ink-900 p-4 font-mono text-[11.5px] leading-relaxed text-paper/85">
          {AGENT_LINES.map(([dir, a, b], j) => (
            <p key={j} className={`transition-opacity duration-300 ${j <= n ? "opacity-100" : "opacity-0"}`}>
              <span className={dir === "›" ? "text-[#D9B98F]" : "text-paper/50"}>{dir}</span> <span className="text-paper">{a}</span>{" "}
              <span className="text-paper/55">{b}</span>
            </p>
          ))}
        </div>
      </Card>
    </div>
  );
}
