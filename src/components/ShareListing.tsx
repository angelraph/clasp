"use client";

import { useState } from "react";

/** Share a listing link (native share sheet on phones, copy elsewhere). */
export function ShareListing({ listingId, title, compact = false }: { listingId: string; title: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = `${window.location.origin}/l/${listingId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text: `${title}: verified with Clasp. Pay into a PayPal hold.`, url });
        return;
      } catch {
        // cancelled
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button onClick={share} className={`shrink-0 rounded-[10px] border border-line bg-card text-sm font-medium hover:bg-ink-100 ${compact ? "px-3 py-1.5" : "px-4 py-2"}`}>
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
