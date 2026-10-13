/**
 * Money states as words in small tracked capitals. Brass means held, green means matched
 * and paid, dark brass means part was kept, oxblood means the switch was caught. A release
 * back to the buyer is a success, so it's ink, not red.
 */
export type Tone = "brass" | "matched" | "kept" | "oxblood" | "ink" | "muted";

const TONES: Record<Tone, { text: string; dot: string }> = {
  brass: { text: "text-brass-ink", dot: "bg-brass" },
  matched: { text: "text-matched", dot: "bg-matched" },
  kept: { text: "text-kept", dot: "bg-kept" },
  oxblood: { text: "text-oxblood", dot: "bg-oxblood" },
  ink: { text: "text-ink-900", dot: "bg-ink-900" },
  muted: { text: "text-ink-500", dot: "bg-ink-300" },
};

export function Status({ tone, children, pulse = false }: { tone: Tone; children: React.ReactNode; pulse?: boolean }) {
  const t = TONES[tone];
  return (
    <span className={`status ${t.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot} ${pulse ? "animate-pulse" : ""}`} />
      {children}
    </span>
  );
}

/** Deal status → the word and tone shown everywhere. */
export const DEAL_STATUS: Record<string, { word: string; tone: Tone; line: string }> = {
  awaiting_payment: { word: "Awaiting payment", tone: "muted", line: "Waiting for the buyer to approve in PayPal" },
  held: { word: "Clasped", tone: "brass", line: "Held by PayPal, not charged" },
  releasing: { word: "Releasing", tone: "brass", line: "Paying the seller" },
  released: { word: "Released", tone: "matched", line: "Matched and paid to the seller" },
  picking_up: { word: "Recording", tone: "brass", line: "Recording pickup condition" },
  active: { word: "Rented", tone: "brass", line: "Fee paid · deposit held" },
  returned: { word: "Returned", tone: "brass", line: "Return checked · awaiting settlement" },
  settling: { word: "Settling", tone: "brass", line: "Settling the deposit" },
  settled: { word: "Settled", tone: "ink", line: "Deposit settled" },
  voiding: { word: "Cancelling", tone: "muted", line: "Releasing the hold" },
  voided: { word: "Cancelled", tone: "muted", line: "Hold released · nothing charged" },
};
