import { describe, expect, it } from "vitest";
import {
  decideSaleHandoff,
  holdClock,
  isValidImei,
  newPossessionCode,
  priceRentalReturn,
  priceSignal,
  verifyListing,
} from "./policy";

// 490154203237518 is the standard documentation example of a valid IMEI.
const IMEI = "490154203237518";

describe("isValidImei", () => {
  it("accepts a Luhn-valid 15 digit IMEI, with formatting", () => {
    expect(isValidImei(IMEI)).toBe(true);
    expect(isValidImei("49 015420 323751 8")).toBe(true);
  });
  it("rejects a one-digit misread", () => {
    expect(isValidImei("490154203237519")).toBe(false);
  });
});

describe("newPossessionCode", () => {
  it("never uses easily confused characters", () => {
    for (let i = 0; i < 500; i++) expect(newPossessionCode()).toMatch(/^[ACDEFHJKMNPRTVWXY3479]{4}$/);
  });
});

describe("verifyListing", () => {
  const base = { mode: "sale" as const, expectedCode: "K7R4", codeConfidence: 0.95 };
  it("verifies when code and a valid identifier are read", () => {
    const v = verifyListing({ ...base, codeSeen: "k7r4", identifierReads: [{ kind: "imei", value: IMEI, confidence: 0.9 }], featureReads: [] });
    expect(v.verified).toBe(true);
    expect(v.identifiers).toEqual([{ kind: "IMEI", value: IMEI }]);
  });
  it("refuses a wrong code", () => {
    const v = verifyListing({ ...base, codeSeen: "K7R3", identifierReads: [{ kind: "IMEI", value: IMEI, confidence: 0.9 }], featureReads: [] });
    expect(v.verified).toBe(false);
    expect(v.codeMatches).toBe(false);
  });
  it("refuses a sale with no trustworthy identifier", () => {
    const v = verifyListing({ ...base, codeSeen: "K7R4", identifierReads: [{ kind: "IMEI", value: "490154203237519", confidence: 0.99 }], featureReads: [] });
    expect(v.verified).toBe(false);
  });
  it("lets a rental verify on the code alone", () => {
    const v = verifyListing({ ...base, mode: "rental", codeSeen: "K7R4", identifierReads: [], featureReads: [] });
    expect(v.verified).toBe(true);
  });
});

describe("decideSaleHandoff", () => {
  const listed = [{ kind: "IMEI", value: IMEI }];
  it("releases on a match with Find My off", () => {
    const v = decideSaleHandoff({ listed, features: [], hasAntiTheftLock: true, reads: [{ kind: "IMEI", value: IMEI, confidence: 0.9 }], featureChecks: [], lockStatus: "off" });
    expect(v.verdict).toBe("match");
    expect(v.canRelease).toBe(true);
  });
  it("blocks a swapped device", () => {
    const v = decideSaleHandoff({ listed, features: [], hasAntiTheftLock: true, reads: [{ kind: "IMEI", value: "356938035643809", confidence: 0.95 }], featureChecks: [], lockStatus: "off" });
    expect(v.verdict).toBe("mismatch");
    expect(v.canRelease).toBe(false);
  });
  it("blocks a matched phone whose lock is on", () => {
    const v = decideSaleHandoff({ listed, features: [], hasAntiTheftLock: true, reads: [{ kind: "IMEI", value: IMEI, confidence: 0.9 }], featureChecks: [], lockStatus: "on" });
    expect(v.verdict).toBe("locked");
    expect(v.canRelease).toBe(false);
  });
  it("asks for the lock screen when it wasn't photographed", () => {
    const v = decideSaleHandoff({ listed, features: [], hasAntiTheftLock: true, reads: [{ kind: "IMEI", value: IMEI, confidence: 0.9 }], featureChecks: [], lockStatus: "not_shown" });
    expect(v.verdict).toBe("rescan");
    expect(v.canRelease).toBe(false);
  });
  it("asks for a rescan on a low-confidence read instead of failing", () => {
    const v = decideSaleHandoff({ listed, features: [], hasAntiTheftLock: true, reads: [{ kind: "IMEI", value: IMEI, confidence: 0.4 }], featureChecks: [], lockStatus: "off" });
    expect(v.verdict).toBe("rescan");
  });
  it("does not require a lock check for items without an anti-theft lock", () => {
    const v = decideSaleHandoff({ listed: [{ kind: "SERIAL", value: "C02XK1ABJG5H" }], features: [], hasAntiTheftLock: false, reads: [{ kind: "SERIAL", value: "c02xk1abjg5h", confidence: 0.9 }], featureChecks: [], lockStatus: "not_shown" });
    expect(v.canRelease).toBe(true);
  });
});

describe("items without a serial number", () => {
  const features = ["scuff on left heel", "ink mark inside tongue", "frayed right lace"];
  const base = { listed: [], features, hasAntiTheftLock: false, reads: [], lockStatus: "not_shown" as const };

  it("lets a sale verify on unique marks alone", () => {
    const v = verifyListing({
      mode: "sale", expectedCode: "K7R4", codeSeen: "K7R4", codeConfidence: 0.95, identifierReads: [],
      featureReads: [{ feature: "scuff on left heel", confidence: 0.9 }, { feature: "ink mark inside tongue", confidence: 0.85 }],
    });
    expect(v.verified).toBe(true);
    expect(v.distinctiveFeatures).toHaveLength(2);
  });
  it("refuses a sale with nothing unique to match", () => {
    const v = verifyListing({
      mode: "sale", expectedCode: "K7R4", codeSeen: "K7R4", codeConfidence: 0.95, identifierReads: [],
      featureReads: [{ feature: "scuff on left heel", confidence: 0.9 }, { feature: "blurry mark", confidence: 0.5 }],
    });
    expect(v.verified).toBe(false);
  });
  it("matches when enough marks are seen and none contradicted", () => {
    const v = decideSaleHandoff({
      ...base,
      featureChecks: [
        { feature: features[0], status: "seen", confidence: 0.9 },
        { feature: features[1], status: "seen", confidence: 0.85 },
        { feature: features[2], status: "not_in_view", confidence: 0.9 },
      ],
    });
    expect(v.verdict).toBe("match");
    expect(v.method).toBe("features");
  });
  it("refuses when a recorded mark is clearly missing (a clean replica)", () => {
    const v = decideSaleHandoff({
      ...base,
      featureChecks: [
        { feature: features[0], status: "absent", confidence: 0.9 },
        { feature: features[1], status: "seen", confidence: 0.9 },
        { feature: features[2], status: "seen", confidence: 0.9 },
      ],
    });
    expect(v.verdict).toBe("mismatch");
    expect(v.canRelease).toBe(false);
  });
  it("asks for closer photos instead of guessing", () => {
    const v = decideSaleHandoff({
      ...base,
      featureChecks: [{ feature: features[0], status: "seen", confidence: 0.6 }],
    });
    expect(v.verdict).toBe("rescan");
  });
});

describe("priceRentalReturn", () => {
  const accessories = [
    { name: "Charger", priceCents: 2500 },
    { name: "Lens cap", priceCents: 1200 },
  ];
  const damageRules = [{ id: "lens_scratch", label: "Scratched lens", priceCents: 4000 }];
  const presentAtPickup = { Charger: true, "Lens cap": false };

  it("charges only for confident misses of items the renter received", () => {
    const v = priceRentalReturn({
      depositCents: 30000, accessories, damageRules, presentAtPickup,
      accessoryReads: [
        { name: "Charger", present: false, confidence: 0.92 },
        { name: "Lens cap", present: false, confidence: 0.95 },
      ],
      damageReads: [],
    });
    expect(v.totalCents).toBe(2500);
    expect(v.releasedCents).toBe(27500);
  });
  it("never charges for damage outside the agreed table or below confidence", () => {
    const v = priceRentalReturn({
      depositCents: 30000, accessories, damageRules, presentAtPickup,
      accessoryReads: [{ name: "Charger", present: true, confidence: 0.9 }],
      damageReads: [
        { description: "dent on body", ruleId: null, confidence: 0.99, photoIndex: 0 },
        { description: "scratch on lens", ruleId: "lens_scratch", confidence: 0.5, photoIndex: 1 },
      ],
    });
    expect(v.verdict).toBe("clean");
    expect(v.flaggedNotCharged).toHaveLength(2);
  });
  it("charges an agreed damage once and caps at the deposit", () => {
    const v = priceRentalReturn({
      depositCents: 5000, accessories, damageRules, presentAtPickup,
      accessoryReads: [{ name: "Charger", present: false, confidence: 0.9 }],
      damageReads: [
        { description: "scratch", ruleId: "lens_scratch", confidence: 0.9, photoIndex: 0 },
        { description: "scratch again", ruleId: "lens_scratch", confidence: 0.9, photoIndex: 1 },
      ],
    });
    expect(v.charges).toHaveLength(2);
    expect(v.totalCents).toBe(5000);
    expect(v.releasedCents).toBe(0);
  });
});

describe("priceSignal", () => {
  const newOffers = [80000, 82000, 79900, 85000];
  it("flags far-below-market prices", () => {
    expect(priceSignal({ askingCents: 15000, newOfferCents: newOffers, usedOfferCents: [] }).level).toBe("too_low");
  });
  it("calls a normal second-hand price fair", () => {
    expect(priceSignal({ askingCents: 45000, newOfferCents: newOffers, usedOfferCents: [] }).level).toBe("fair");
  });
  it("prefers used offers as the reference when there are enough", () => {
    const s = priceSignal({ askingCents: 40000, newOfferCents: newOffers, usedOfferCents: [42000, 45000, 39000] });
    expect(s.referenceKind).toBe("used");
    expect(s.level).toBe("fair");
  });
  it("warns when priced above new", () => {
    expect(priceSignal({ askingCents: 95000, newOfferCents: newOffers, usedOfferCents: [] }).level).toBe("above_new");
  });
  it("says unknown with no data instead of guessing", () => {
    expect(priceSignal({ askingCents: 1000, newOfferCents: [], usedOfferCents: [] }).level).toBe("unknown");
  });
});

describe("holdClock", () => {
  it("tracks the honor period and expiry", () => {
    const t = new Date("2026-10-12T00:00:00Z");
    expect(holdClock(t, new Date("2026-10-14T00:00:00Z")).phase).toBe("honor");
    expect(holdClock(t, new Date("2026-10-20T00:00:00Z")).phase).toBe("reauthorize");
    expect(holdClock(t, new Date("2026-11-11T00:00:00Z")).phase).toBe("expired");
  });
});
