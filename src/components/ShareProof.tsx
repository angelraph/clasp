"use client";

import { useState } from "react";

/** Shares the public proof page: native share sheet on phones, WhatsApp, or copy. */
export function ShareProof({ dealId, title }: { dealId: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? `/p/${dealId}` : `${window.location.origin}/p/${dealId}`;
  const text = `Verified with Clasp: ${title}. PayPal held the money until the item checked out.`;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Verified with Clasp", text, url });
        return;
      } catch {
        // Cancelled or unsupported: fall through to copying.
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <button className="btn-primary" onClick={share}>{copied ? "Link copied" : "Share proof"}</button>
      <a
        className="btn-secondary"
        href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}
        target="_blank"
        rel="noreferrer"
      >
        WhatsApp
      </a>
      <a className="col-span-2 text-sm font-medium text-clasp-600" href={`/p/${dealId}`} target="_blank" rel="noreferrer">
        View public proof page
      </a>
    </div>
  );
}
