import { formatMoney } from "@/lib/money";
import { ogCard, OG_SIZE } from "@/lib/og";
import { humanDuration, loadProof } from "@/lib/proof";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Verified with Clasp";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await loadProof(id);
  if (!p) {
    return ogCard({ badge: "Clasp", title: "Pay strangers like you trust them", line: "Money moves only when the thing does.", footer: "PayPal holds it. AI checks it.", photoId: null });
  }
  const line =
    p.mode === "sale"
      ? p.secondsCheckToPaid !== null
        ? `${formatMoney(p.priceCents)} paid ${humanDuration(p.secondsCheckToPaid)} after the item checked out`
        : `${formatMoney(p.priceCents)} paid when the item checked out`
      : `Deposit back: ${formatMoney(p.releasedDepositCents ?? p.depositCents)} of ${formatMoney(p.depositCents)}`;
  return ogCard({
    badge: `Verified ${p.mode}`,
    title: p.title,
    line,
    footer: `${p.matchedLabel} · PayPal held the money until then`,
    photoId: p.coverPhotoId,
  });
}
