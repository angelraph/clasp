/**
 * Builds the "Clasp handoff record" PDF: what was listed, what was verified, what the
 * buyer scanned, and what PayPal did, with the photos. Used as dispute evidence and as
 * a downloadable record for the seller.
 */
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import type { Deal, Listing } from "./db/schema";
import { formatMoney } from "./money";
import { dealEvents, loadPhotos, photoIds } from "./store";

// Standard PDF fonts only cover WinAnsi; keep text to plain ASCII.
/** Joins sentences without doubling their final periods. */
function list(items: string[]): string {
  return items.map((i) => i.trim().replace(/[.;]+$/, "")).join("; ");
}

function ascii(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E]/g, "");
}

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(
    private doc: PDFDocument,
    private font: PDFFont,
    private bold: PDFFont,
  ) {
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage([612, 792]);
    this.y = 750;
  }
  ensure(space: number) {
    if (this.y - space < 50) this.newPage();
  }
  text(value: string, opts: { size?: number; bold?: boolean; color?: [number, number, number] } = {}) {
    const size = opts.size ?? 10;
    const font = opts.bold ? this.bold : this.font;
    const words = ascii(value).split(" ");
    let line = "";
    const lines: string[] = [];
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(next, size) > 512) {
        lines.push(line);
        line = w;
      } else line = next;
    }
    if (line) lines.push(line);
    for (const l of lines) {
      this.ensure(size + 4);
      this.page.drawText(l, { x: 50, y: this.y, size, font, color: rgb(...(opts.color ?? [0.07, 0.08, 0.1])) });
      this.y -= size + 4;
    }
  }
  gap(h = 8) {
    this.y -= h;
  }
}

const LABELS: Record<string, string> = {
  "paypal.order.created": "PayPal order created",
  "paypal.authorized": "PayPal authorization (hold) placed",
  "paypal.reauthorized": "PayPal hold reauthorized",
  "paypal.capture": "PayPal capture",
  "paypal.payout": "PayPal payout to seller",
  "paypal.voided": "PayPal authorization voided",
  "paypal.hold_lapses": "Uncaptured remainder left to lapse (no further capture)",
  "deal.cancelled": "Deal cancelled",
  "handoff.match": "Handoff scan: identity matched",
  "handoff.mismatch": "Handoff scan: NOT the listed item",
  "handoff.rescan": "Handoff scan: more evidence requested",
  "handoff.locked": "Handoff scan: device lock on",
  "rental.pickup_recorded": "Rental pickup condition recorded",
  "rental.return_clean": "Rental return: no new damage",
  "rental.return_charge": "Rental return: agreed charges found",
  "deal.released": "Buyer released payment",
  "deal.settled": "Rental settled",
};

export async function buildEvidencePdf(deal: Deal, listing: Listing): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Clasp handoff record ${deal.id}`);
  doc.setProducer("Clasp");
  const w = new Writer(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold));

  w.text("Clasp handoff record", { size: 20, bold: true });
  w.text(`Deal ${deal.id} - generated ${new Date().toISOString()}`, { size: 9, color: [0.4, 0.43, 0.5] });
  w.gap(10);
  w.text(listing.mode === "sale" ? "Sale" : "Rental", { bold: true, size: 12 });
  w.text(`Item: ${listing.title}`);
  w.text(`Seller: ${listing.sellerName}`);
  w.text(`${listing.mode === "sale" ? "Price" : "Rental fee"}: ${formatMoney(listing.priceCents)}${listing.depositCents ? ` - deposit ${formatMoney(listing.depositCents)}` : ""}`);
  w.text(`Amount authorized by buyer: ${formatMoney(deal.authorizedCents)}; captured: ${formatMoney(deal.capturedCents)}`);
  w.gap();

  const fp = listing.fingerprint;
  w.text("1. Seller possession verified at listing", { bold: true, size: 12 });
  w.text(
    `On ${listing.verifiedAt?.toISOString() ?? "unknown"} the seller photographed the item next to the one-time code "${listing.possessionCode}", which Clasp generated for this listing. The code was read from the photo and matched.`,
  );
  if (fp) {
    if (fp.identifiers.length) w.text(`Identifiers read: ${fp.identifiers.map((i) => `${i.kind} ${i.value}`).join(", ")}`);
    if (fp.distinctiveFeatures?.length) w.text(`Unique marks recorded: ${list(fp.distinctiveFeatures)}`);
    if (fp.conditionNotes.length) w.text(`Condition disclosed to buyer: ${list(fp.conditionNotes)}`);
  }
  w.gap();

  const decision = deal.decision as Record<string, unknown> | null;
  if (listing.mode === "sale") {
    w.text("2. Item checked in the buyer's hands at handoff", { bold: true, size: 12 });
    if (decision?.kind === "sale_handoff") {
      w.text(`Result: ${String(decision.verdict).toUpperCase()} (method: ${decision.method ?? "identifier"})`);
      for (const r of (decision.reasons as string[]) ?? []) w.text(`- ${r}`);
      w.text(
        "The buyer photographed the item at the meetup. The identifiers were read without the system being told which value to expect, then compared in code. Payment was captured only after a match, and only when the buyer pressed Release.",
      );
    }
  } else {
    w.text("2. Rental condition at pickup and return", { bold: true, size: 12 });
    const pickup = deal.pickupInspection as { presentAtPickup?: Record<string, boolean>; conditionNotes?: string[] } | null;
    if (pickup) {
      w.text(`Accessories at pickup: ${Object.entries(pickup.presentAtPickup ?? {}).map(([k, v]) => `${k}: ${v ? "received" : "not seen"}`).join(", ") || "none listed"}`);
      if (pickup.conditionNotes?.length) w.text(`Pre-existing condition: ${list(pickup.conditionNotes)}`);
    }
    if (decision?.kind === "rental_return") {
      const charges = (decision.charges as { reason: string; amountCents: number }[]) ?? [];
      w.text(`Charges from deposit (only from the price table agreed before payment): ${charges.length ? charges.map((c) => `${c.reason} ${formatMoney(c.amountCents)}`).join("; ") : "none"}`);
      w.text(`Released to renter: ${formatMoney(Number(decision.releasedCents ?? 0))}`);
    }
  }
  w.gap();

  w.text("3. Timeline (UTC)", { bold: true, size: 12 });
  for (const e of await dealEvents(deal.id)) {
    if (!LABELS[e.type] && !e.type.startsWith("webhook.")) continue;
    const p = e.payload as { amount?: { value?: string }; captureId?: string; authorizationId?: string };
    const extra = [p.amount?.value ? `$${p.amount.value}` : "", p.captureId ? `capture ${p.captureId}` : "", p.authorizationId ? `authorization ${p.authorizationId}` : ""].filter(Boolean).join(", ");
    const label = LABELS[e.type] ?? `PayPal webhook ${e.type.slice(8)}`;
    w.text(`${e.createdAt.toISOString().replace("T", " ").slice(0, 19)}  ${label}${extra ? ` (${extra})` : ""}`, { size: 9 });
  }

  // Photos, each captioned with the stage it came from.
  const stages = listing.mode === "sale" ? ["listing", "handoff"] : ["listing", "pickup", "return"];
  for (const stage of stages) {
    const ids = await photoIds({ listingId: listing.id, stage, ...(stage === "listing" ? {} : { dealId: deal.id }) });
    const photos = await loadPhotos(ids.slice(-6));
    for (const [i, photo] of photos.entries()) {
      let image;
      try {
        image = photo.mime === "image/png" ? await doc.embedPng(photo.data) : photo.mime === "image/jpeg" ? await doc.embedJpg(photo.data) : null;
      } catch {
        image = null;
      }
      if (!image) continue;
      const scale = Math.min(512 / image.width, 560 / image.height, 1);
      w.ensure(image.height * scale + 30);
      w.text(`Photo: ${stage}${stage === "listing" ? " (seller possession proof)" : ""} #${i + 1}`, { bold: true });
      w.page.drawImage(image, { x: 50, y: w.y - image.height * scale, width: image.width * scale, height: image.height * scale });
      w.y -= image.height * scale + 16;
    }
  }

  return doc.save();
}
