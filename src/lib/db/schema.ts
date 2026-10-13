import { boolean, customType, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType: () => "bytea",
});

export type Mode = "sale" | "rental";

export type Identifier = { kind: string; value: string };

/** What the listing-time inspection established about the item. */
export type Fingerprint = {
  category: string;
  make: string | null;
  model: string | null;
  identifiers: Identifier[];
  /** Unique, checkable marks used to match items that have no serial number. */
  distinctiveFeatures: string[];
  /** True when the item has an anti-theft lock (Find My, Find My Device, etc.) to check at handoff. */
  hasAntiTheftLock: boolean;
  batteryHealthPercent: number | null;
  conditionNotes: string[];
  readAt: string;
};

export type Accessory = { name: string; priceCents: number };
export type DamageRule = { id: string; label: string; priceCents: number };

export const listings = pgTable("listings", {
  id: text("id").primaryKey(),
  mode: text("mode").$type<Mode>().notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  // Sale: the price. Rental: the rental fee.
  priceCents: integer("price_cents").notNull(),
  depositCents: integer("deposit_cents").notNull().default(0),
  currency: text("currency").notNull().default("USD"),
  // Where the handoff happens (city / area). Handoffs are in person, so buyers need it.
  location: text("location").notNull().default(""),
  sellerName: text("seller_name").notNull(),
  sellerPaypalEmail: text("seller_paypal_email").notNull(),
  // Where the seller wants updates, if different from (or instead of) push.
  notifyEmail: text("notify_email"),
  sellerKey: text("seller_key").notNull(),
  possessionCode: text("possession_code").notNull(),
  // draft -> verified -> reserved -> closed
  status: text("status").notNull().default("draft"),
  fingerprint: jsonb("fingerprint").$type<Fingerprint | null>(),
  verification: jsonb("verification").$type<Record<string, unknown> | null>(),
  accessories: jsonb("accessories").$type<Accessory[]>().notNull().default([]),
  damageRules: jsonb("damage_rules").$type<DamageRule[]>().notNull().default([]),
  // Channel3 market price check, filled in shortly after verification.
  market: jsonb("market").$type<Record<string, unknown> | null>(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const deals = pgTable("deals", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull().references(() => listings.id),
  buyerKey: text("buyer_key").notNull(),
  // From the PayPal payer on authorization, for deal updates.
  buyerEmail: text("buyer_email"),
  orderId: text("order_id"),
  authorizationId: text("authorization_id"),
  authorizedCents: integer("authorized_cents").notNull(),
  authorizedAt: timestamp("authorized_at", { withTimezone: true }),
  capturedCents: integer("captured_cents").notNull().default(0),
  // Buyer-paid Clasp protection fee, included in the hold and captured with the first capture.
  feeCents: integer("fee_cents").notNull().default(0),
  // What actually reached the seller (captures minus Clasp's fee).
  paidOutCents: integer("paid_out_cents").notNull().default(0),
  // awaiting_payment -> held -> (sale) released | (rental) active -> returned -> settled; voided at any point
  status: text("status").notNull().default("awaiting_payment"),
  // Latest machine decision shown to both parties.
  decision: jsonb("decision").$type<Record<string, unknown> | null>(),
  pickupInspection: jsonb("pickup_inspection").$type<Record<string, unknown> | null>(),
  returnInspection: jsonb("return_inspection").$type<Record<string, unknown> | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const photos = pgTable("photos", {
  id: text("id").primaryKey(),
  listingId: text("listing_id").notNull().references(() => listings.id),
  dealId: text("deal_id").references(() => deals.id),
  // listing | handoff | pickup | return
  stage: text("stage").notNull(),
  // Only photos the model judged free of identifiers and personal data are ever public.
  isPublic: boolean("is_public").notNull().default(false),
  mime: text("mime").notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Fixed-window counters that cap expensive actions (AI calls, PayPal orders) per caller. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});

/** Browser push subscriptions, scoped to the listing (seller) or deal (buyer) they follow. */
export const pushSubscriptions = pgTable("push_subscriptions", {
  endpoint: text("endpoint").primaryKey(),
  keys: jsonb("keys").$type<{ p256dh: string; auth: string }>().notNull(),
  role: text("role").$type<"seller" | "buyer">().notNull(),
  listingId: text("listing_id").notNull().references(() => listings.id),
  dealId: text("deal_id").references(() => deals.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Append-only timeline: our actions, PayPal API results, and verified webhooks. */
export const events = pgTable("events", {
  id: text("id").primaryKey(),
  dealId: text("deal_id").references(() => deals.id),
  listingId: text("listing_id").references(() => listings.id),
  type: text("type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Listing = typeof listings.$inferSelect;
export type Deal = typeof deals.$inferSelect;
