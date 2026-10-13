/**
 * Deterministic money policy. The vision model only reports what it sees; every
 * decision to capture, hold, or release money is made here, by plain code.
 */
import type { Accessory, DamageRule, Identifier } from "./db/schema";

export const MIN_READ_CONFIDENCE = 0.8;
export const HONOR_PERIOD_DAYS = 3;
export const AUTHORIZATION_VALID_DAYS = 29;

// No 0/O, 1/I/L, 2/Z, 5/S, 6/G, 8/B: characters a camera and a model can confuse.
const CODE_ALPHABET = "ACDEFHJKMNPRTVWXY3479";

export function newPossessionCode(random: () => number = Math.random): string {
  let code = "";
  for (let i = 0; i < 4; i++) code += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return code;
}

export type ReadIdentifier = Identifier & { confidence: number };

export function normalizeIdentifier(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** IMEIs are 15 digits with a Luhn check digit, which catches most OCR misreads. */
export function isValidImei(value: string): boolean {
  const digits = normalizeIdentifier(value);
  if (!/^\d{15}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    let d = Number(digits[i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

/** Keeps only confident, well-formed reads, normalized for comparison. */
export function trustedIdentifiers(reads: ReadIdentifier[]): Identifier[] {
  const out: Identifier[] = [];
  const seen = new Set<string>();
  for (const read of reads) {
    if (read.confidence < MIN_READ_CONFIDENCE) continue;
    const kind = read.kind.toUpperCase();
    const value = normalizeIdentifier(read.value);
    if (value.length < 5) continue;
    if (kind === "IMEI" && !isValidImei(value)) continue;
    const key = `${kind}:${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ kind, value });
  }
  return out;
}

// ---------------------------------------------------------------- listing

export type ListingVerdict = {
  verified: boolean;
  codeMatches: boolean;
  identifiers: Identifier[];
  distinctiveFeatures: string[];
  reasons: string[];
};

export type FeatureRead = { feature: string; confidence: number };

/** Items with no serial need at least this many clear, unique marks to be matchable. */
export const MIN_FEATURES = 2;

export function verifyListing(input: {
  mode: "sale" | "rental";
  expectedCode: string;
  codeSeen: string | null;
  codeConfidence: number;
  identifierReads: ReadIdentifier[];
  featureReads: FeatureRead[];
}): ListingVerdict {
  const reasons: string[] = [];
  const seen = input.codeSeen ? normalizeIdentifier(input.codeSeen) : null;
  const codeMatches =
    seen === normalizeIdentifier(input.expectedCode) && input.codeConfidence >= MIN_READ_CONFIDENCE;
  if (!codeMatches) {
    reasons.push(
      seen
        ? `The code in the photo reads "${seen}", not "${input.expectedCode}".`
        : `The one-time code ${input.expectedCode} isn't clearly visible next to the item.`,
    );
  }
  const identifiers = trustedIdentifiers(input.identifierReads);
  const distinctiveFeatures = [
    ...new Set(input.featureReads.filter((f) => f.confidence >= MIN_READ_CONFIDENCE).map((f) => f.feature.trim())),
  ].filter(Boolean);
  // A sale is settled by matching the item at handoff, so it needs something to match:
  // a serial/IMEI, or enough unique marks.
  const matchable = identifiers.length > 0 || distinctiveFeatures.length >= MIN_FEATURES;
  if (input.mode === "sale" && !matchable) {
    reasons.push(
      "Nothing unique enough to recognise this exact item at the handoff. Add a clear photo of any serial number or label, or close-ups of unique marks (scratches, stickers, wear).",
    );
  }
  const verified = codeMatches && (input.mode === "rental" || matchable);
  return { verified, codeMatches, identifiers, distinctiveFeatures, reasons };
}

// ---------------------------------------------------------------- sale handoff

export type LockStatus = "off" | "on" | "not_shown";

export type HandoffVerdict = {
  verdict: "match" | "mismatch" | "rescan" | "locked";
  method: "identifier" | "features";
  canRelease: boolean;
  matched: Identifier | null;
  reasons: string[];
};

export type FeatureCheck = { feature: string; status: "seen" | "absent" | "not_in_view"; confidence: number };

function lockGate(base: Omit<HandoffVerdict, "verdict" | "canRelease" | "reasons">, hasLock: boolean, lockStatus: LockStatus, reasons: string[]): HandoffVerdict {
  if (hasLock && lockStatus !== "off") {
    return {
      ...base,
      // Not shown is a missing photo, not a locked device: ask for it rather than alarm the buyer.
      verdict: lockStatus === "on" ? "locked" : "rescan",
      canRelease: false,
      reasons: [
        ...reasons,
        lockStatus === "on"
          ? "The anti-theft lock (Find My / Find Hub) is still on. A locked device can't be used by the buyer."
          : "Also photograph the Find My / Find Hub screen so the buyer can confirm the lock is off.",
      ],
    };
  }
  return { ...base, verdict: "match", canRelease: true, reasons };
}

/** Items without a serial: every recorded mark that's in view must be there, and enough must be seen. */
function decideByFeatures(input: { features: string[]; checks: FeatureCheck[]; hasAntiTheftLock: boolean; lockStatus: LockStatus }): HandoffVerdict {
  const base = { method: "features" as const, matched: null };
  const contradicted = input.checks.filter((c) => c.status === "absent" && c.confidence >= MIN_READ_CONFIDENCE);
  if (contradicted.length > 0) {
    return {
      ...base,
      verdict: "mismatch",
      canRelease: false,
      reasons: contradicted.map((c) => `Expected "${c.feature}", but it isn't on the item in hand. This doesn't look like the listed item.`),
    };
  }
  const seen = input.checks.filter((c) => c.status === "seen" && c.confidence >= MIN_READ_CONFIDENCE);
  const needed = Math.min(MIN_FEATURES, input.features.length);
  if (seen.length < needed) {
    const missing = input.features.filter((f) => !seen.some((s) => s.feature === f));
    return {
      ...base,
      verdict: "rescan",
      canRelease: false,
      reasons: [`Couldn't confirm enough unique marks. Photograph these closer: ${missing.join("; ")}.`],
    };
  }
  return lockGate(base, input.hasAntiTheftLock, input.lockStatus, [
    `${seen.length} of ${input.features.length} unique marks from the listing confirmed: ${seen.map((s) => s.feature).join("; ")}.`,
  ]);
}

export function decideSaleHandoff(input: {
  listed: Identifier[];
  features: string[];
  hasAntiTheftLock: boolean;
  reads: ReadIdentifier[];
  featureChecks: FeatureCheck[];
  lockStatus: LockStatus;
}): HandoffVerdict {
  if (input.listed.length === 0) {
    return decideByFeatures({ features: input.features, checks: input.featureChecks, hasAntiTheftLock: input.hasAntiTheftLock, lockStatus: input.lockStatus });
  }

  const base = { method: "identifier" as const };
  const scanned = trustedIdentifiers(input.reads);
  const listed = input.listed.map((i) => ({ kind: i.kind.toUpperCase(), value: normalizeIdentifier(i.value) }));

  if (scanned.length === 0) {
    return {
      ...base,
      verdict: "rescan",
      canRelease: false,
      matched: null,
      reasons: [`Couldn't read an identifier clearly. Scan the ${listed.map((i) => i.kind).join(" or ")} again.`],
    };
  }

  const matched = scanned.find((s) => listed.some((l) => l.value === s.value)) ?? null;
  if (!matched) {
    const comparable = scanned.filter((s) => listed.some((l) => l.kind === s.kind));
    if (comparable.length > 0) {
      const s = comparable[0];
      const l = listed.find((x) => x.kind === s.kind)!;
      return {
        ...base,
        verdict: "mismatch",
        canRelease: false,
        matched: null,
        // Only the last 4 of the listed identifier: a mismatch must not teach a scammer the real one.
        reasons: [`${s.kind} in hand is ${s.value}; the listed item's ${l.kind} ends in ${l.value.slice(-4)}. This is not the listed item.`],
      };
    }
    return {
      ...base,
      verdict: "rescan",
      canRelease: false,
      matched: null,
      reasons: [`Scanned ${scanned.map((s) => s.kind).join(", ")}, but the listing was verified by ${listed.map((l) => l.kind).join(", ")}. Scan that instead.`],
    };
  }

  return lockGate({ ...base, matched }, input.hasAntiTheftLock, input.lockStatus, [
    `${matched.kind} ${matched.value} matches the listing.`,
  ]);
}

// ---------------------------------------------------------------- rental return

export type AccessoryRead = { name: string; present: boolean; confidence: number };
export type DamageRead = { description: string; ruleId: string | null; confidence: number; photoIndex: number | null };

export type Charge = { reason: string; amountCents: number; evidencePhotoIndex: number | null };

export type ReturnVerdict = {
  verdict: "clean" | "charge";
  charges: Charge[];
  flaggedNotCharged: string[];
  totalCents: number;
  releasedCents: number;
};

export function priceRentalReturn(input: {
  depositCents: number;
  accessories: Accessory[];
  damageRules: DamageRule[];
  presentAtPickup: Record<string, boolean>;
  accessoryReads: AccessoryRead[];
  damageReads: DamageRead[];
}): ReturnVerdict {
  const charges: Charge[] = [];
  const flagged: string[] = [];

  for (const accessory of input.accessories) {
    // Only charge for things the renter actually received.
    if (!input.presentAtPickup[accessory.name]) continue;
    const read = input.accessoryReads.find((r) => r.name === accessory.name);
    if (!read || read.present) continue;
    if (read.confidence >= MIN_READ_CONFIDENCE) {
      charges.push({ reason: `Missing: ${accessory.name}`, amountCents: accessory.priceCents, evidencePhotoIndex: null });
    } else {
      flagged.push(`${accessory.name} may be missing (low confidence). Not charged.`);
    }
  }

  const chargedRules = new Set<string>();
  for (const damage of input.damageReads) {
    const rule = damage.ruleId ? input.damageRules.find((r) => r.id === damage.ruleId) : undefined;
    if (!rule) {
      flagged.push(`${damage.description}: not covered by an agreed damage price. Not charged.`);
      continue;
    }
    if (damage.confidence < MIN_READ_CONFIDENCE) {
      flagged.push(`${damage.description}: low confidence. Not charged.`);
      continue;
    }
    // Each agreed damage price applies once, so duplicate detections can't stack.
    if (chargedRules.has(rule.id)) continue;
    chargedRules.add(rule.id);
    charges.push({ reason: `${rule.label}: ${damage.description}`, amountCents: rule.priceCents, evidencePhotoIndex: damage.photoIndex });
  }

  const totalCents = Math.min(
    charges.reduce((sum, c) => sum + c.amountCents, 0),
    input.depositCents,
  );
  return {
    verdict: totalCents > 0 ? "charge" : "clean",
    charges,
    flaggedNotCharged: flagged,
    totalCents,
    releasedCents: input.depositCents - totalCents,
  };
}

// ---------------------------------------------------------------- market price

/**
 * Whether a catalog product is the same model as the listing. Every model-number token
 * (anything containing a digit, like "A58", "13", "256GB" excluded) and the brand must
 * appear in the product title; otherwise its prices would compare apples to oranges.
 */
export function isSameModel(input: { make: string | null; model: string | null; productTitle: string; brands?: string[] }): boolean {
  const title = ` ${input.productTitle.toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  // Catalogs often keep the brand in a separate field rather than the title.
  const brandText = ` ${(input.brands ?? []).join(" ").toLowerCase().replace(/[^a-z0-9]+/g, " ")} `;
  const words = (s: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);
  const make = words(input.make);
  // Storage/colour-style tokens vary between offers of the same model, so they don't decide identity.
  const modelTokens = words(input.model).filter((t) => /\d/.test(t) && !/^\d+(gb|tb|mm|in)$/.test(t));
  if (make.length === 0 || modelTokens.length === 0) return false;
  const makeOk = make.every((t) => title.includes(` ${t} `) || brandText.includes(` ${t} `));
  return makeOk && modelTokens.every((t) => title.includes(` ${t} `));
}

export type PriceSignal = {
  level: "too_low" | "low" | "fair" | "high" | "unknown";
  referenceCents: number | null;
  offerCount: number;
  percentOfReference: number | null;
  message: string;
};

/** Fewer offers than this and a "going rate" would be one retailer's opinion. */
export const MIN_MARKET_OFFERS = 3;

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/**
 * Compares an asking price to the typical retail offer for the same model. Retailers label
 * refurbished stock as "new" inconsistently, so all offers form one reference rather than
 * claiming a "new" price that may not exist.
 */
export function priceSignal(input: { askingCents: number; offerCents: number[] }): PriceSignal {
  const offerCount = input.offerCents.length;
  const referenceCents = offerCount >= MIN_MARKET_OFFERS ? median(input.offerCents) : null;
  if (referenceCents === null) {
    return {
      level: "unknown",
      referenceCents: null,
      offerCount,
      percentOfReference: null,
      message: offerCount ? `Only ${offerCount} comparable retail offer${offerCount === 1 ? "" : "s"}, not enough to judge the price.` : "No comparable retail prices found.",
    };
  }
  const pct = Math.round((input.askingCents / referenceCents) * 100);
  const base = { referenceCents, offerCount, percentOfReference: pct };
  if (pct < 40) {
    return { ...base, level: "too_low", message: "Far below the going rate. Scams often look like this, which is why Clasp holds the money until you check the item." };
  }
  if (pct < 65) {
    return { ...base, level: "low", message: "A good deal compared with retail. Check the condition carefully at the handoff." };
  }
  if (pct > 130) {
    return { ...base, level: "high", message: "Priced above typical retail offers for this model. Worth comparing before you buy." };
  }
  return { ...base, level: "fair", message: "In line with typical retail offers for this model." };
}

// ---------------------------------------------------------------- hold clock

export function holdClock(authorizedAt: Date, now: Date = new Date()) {
  const day = 24 * 60 * 60 * 1000;
  const honorEndsAt = new Date(authorizedAt.getTime() + HONOR_PERIOD_DAYS * day);
  const expiresAt = new Date(authorizedAt.getTime() + AUTHORIZATION_VALID_DAYS * day);
  const phase = now < honorEndsAt ? "honor" : now < expiresAt ? "reauthorize" : "expired";
  return { honorEndsAt, expiresAt, phase } as const;
}
