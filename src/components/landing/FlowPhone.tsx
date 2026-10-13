"use client";

import { useEffect, useState } from "react";
import { Mark } from "@/components/Logo";
import { ItemSketch } from "./ItemSketch";

const SERIAL = "8694 9606 6195 066";
const SCENES = ["listing", "clasped", "scan", "matched"] as const;
type Scene = (typeof SCENES)[number];

function Status({ tone, children }: { tone: "brass" | "matched" | "ink"; children: React.ReactNode }) {
  const color = tone === "brass" ? "text-brass-ink" : tone === "matched" ? "text-matched" : "text-ink-700";
  const dot = tone === "brass" ? "bg-brass" : tone === "matched" ? "bg-matched" : "bg-ink-500";
  return (
    <span className={`status ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ${tone === "brass" ? "animate-pulse" : ""}`} />
      {children}
    </span>
  );
}

/** A phone that plays the whole Clasp flow on a loop: listed, clasped, scanned, matched. */
export function FlowPhone() {
  const [i, setI] = useState(0);
  const [typed, setTyped] = useState(0);
  const scene: Scene = SCENES[i];

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setI(3);
      setTyped(SERIAL.length);
      return;
    }
    const t = setInterval(() => setI((n) => (n + 1) % SCENES.length), 2900);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (scene !== "scan") return;
    setTyped(0);
    const t = setInterval(() => setTyped((n) => (n >= SERIAL.length ? n : n + 1)), 70);
    return () => clearInterval(t);
  }, [scene]);

  return (
    <div className="relative mx-auto w-[280px]">
      <div className="rounded-[38px] border border-ink-900/10 bg-ink-900 p-2.5 shadow-[0_40px_80px_-30px_rgba(20,20,19,0.45)]">
        <div className="relative h-[540px] overflow-hidden rounded-[30px] bg-paper">
          <div className="flex items-center justify-between px-5 pt-4">
            <Mark size={20} />
            <span className="status text-ink-500">Deal 67tj</span>
          </div>

          {/* listing */}
          <div className={`absolute inset-x-0 top-12 px-4 transition-all duration-700 ${scene === "listing" ? "opacity-100" : "pointer-events-none -translate-y-2 opacity-0"}`}>
            <ItemSketch className="aspect-square w-full" />
            <p className="mt-3 text-xs text-ink-500">For sale · Lagos, Ikeja</p>
            <p className="font-medium">OPPO A58, 128 GB</p>
            <p className="amount mt-1 text-3xl">$250.00</p>
            <p className="mt-2 text-xs text-matched">Verified in the seller&apos;s hands · IMEI on file</p>
            <div className="mt-3 rounded-[10px] bg-ink-900 py-2.5 text-center text-sm font-medium text-paper">Pay into a hold</div>
          </div>

          {/* clasped */}
          <div className={`absolute inset-x-0 top-12 px-4 transition-all duration-700 ${scene === "clasped" ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}>
            <Status tone="brass">Clasped</Status>
            <p className="amount mt-3 text-5xl">$262.50</p>
            <p className="mt-1 text-sm text-ink-500">held by PayPal, not charged</p>
            <dl className="mt-6 space-y-2 border-t border-line pt-4 text-sm">
              <div className="flex justify-between"><dt className="text-ink-500">Price</dt><dd className="amount">$250.00</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Buyer protection</dt><dd className="amount">$12.50</dd></div>
              <div className="flex justify-between"><dt className="text-ink-500">Paid to seller</dt><dd className="amount">$0.00</dd></div>
            </dl>
            <p className="mt-6 text-xs text-ink-500">Meet up. The seller is paid when the item checks out.</p>
          </div>

          {/* scan */}
          <div className={`absolute inset-x-0 top-12 px-4 transition-all duration-700 ${scene === "scan" ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}>
            <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[10px] bg-ink-900">
              <div className="absolute inset-6 rounded-[10px] border border-paper/40" />
              <div className="absolute inset-x-6 top-6 h-px animate-[scan_1.6s_ease-in-out_infinite] bg-brass" />
              <div className="absolute inset-x-0 bottom-6 px-8 text-center">
                <p className="status text-paper/60">Reading IMEI</p>
                <p className="serial mt-1 text-paper">{SERIAL.slice(0, typed)}<span className="animate-pulse">▍</span></p>
              </div>
            </div>
            <p className="mt-3 text-xs text-ink-500">The AI transcribes. It is never told what to expect.</p>
          </div>

          {/* matched */}
          <div className={`absolute inset-x-0 top-12 px-4 transition-all duration-700 ${scene === "matched" ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0"}`}>
            <Status tone="matched">Matched</Status>
            <p className="serial mt-3 text-ink-700">IMEI ···· 5066 = listed ···· 5066</p>
            <p className="amount mt-6 text-5xl">$250.00</p>
            <p className="mt-1 text-sm text-ink-500">released to Uzoechi</p>
            <div className="mt-6 space-y-2 border-t border-line pt-4 text-xs">
              <p className="flex justify-between"><span className="text-ink-500">PayPal capture</span><span className="status text-matched">Completed</span></p>
              <p className="flex justify-between"><span className="text-ink-500">Payout to seller</span><span className="status text-matched">Sent</span></p>
            </div>
            <p className="mt-6 text-sm font-medium">Nobody had to trust anybody.</p>
          </div>

          <div className="absolute inset-x-0 bottom-4 flex justify-center gap-1.5">
            {SCENES.map((s, n) => (
              <span key={s} className={`h-1 rounded-full transition-all duration-500 ${n === i ? "w-6 bg-ink-900" : "w-1.5 bg-ink-300"}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
