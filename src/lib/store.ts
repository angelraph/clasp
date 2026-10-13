import { and, asc, eq, inArray } from "drizzle-orm";
import { customAlphabet } from "nanoid";
import { getDb, schema } from "./db";
import type { Deal, Listing } from "./db/schema";
import { env } from "./env";
import { protectionFeeCents } from "./money";
import * as paypal from "./paypal";
import type { Photo } from "./vision";

export const newId = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 12);
export const newKey = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz", 32);

export class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function logEvent(e: {
  type: string;
  dealId?: string | null;
  listingId?: string | null;
  payload?: Record<string, unknown>;
}) {
  const db = await getDb();
  await db.insert(schema.events).values({
    id: newId(),
    type: e.type,
    dealId: e.dealId ?? null,
    listingId: e.listingId ?? null,
    payload: e.payload ?? {},
  });
}

export async function getListing(id: string): Promise<Listing> {
  const db = await getDb();
  const [listing] = await db.select().from(schema.listings).where(eq(schema.listings.id, id));
  if (!listing) throw new HttpError(404, "Listing not found");
  return listing;
}

export async function getDeal(id: string): Promise<{ deal: Deal; listing: Listing }> {
  const db = await getDb();
  const [deal] = await db.select().from(schema.deals).where(eq(schema.deals.id, id));
  if (!deal) throw new HttpError(404, "Deal not found");
  return { deal, listing: await getListing(deal.listingId) };
}

export function roleFor(deal: Deal, listing: Listing, key: string | null | undefined) {
  if (key && key === listing.sellerKey) return "seller" as const;
  if (key && key === deal.buyerKey) return "buyer" as const;
  return null;
}

export function requireRole(deal: Deal, listing: Listing, key: string | null | undefined, role: "buyer" | "seller") {
  if (roleFor(deal, listing, key) !== role) throw new HttpError(403, `Only the ${role} can do this`);
}

export async function updateDeal(id: string, values: Partial<Deal>) {
  const db = await getDb();
  await db.update(schema.deals).set(values).where(eq(schema.deals.id, id));
}

/**
 * Moves a deal from one status to another only if nobody else already did, so a
 * double-tap can't run the same money movement twice. Reverts if `work` throws.
 */
export async function withTransition<T>(
  deal: Deal,
  from: string,
  busy: string,
  work: () => Promise<T>,
): Promise<T> {
  const db = await getDb();
  const claimed = await db
    .update(schema.deals)
    .set({ status: busy })
    .where(and(eq(schema.deals.id, deal.id), eq(schema.deals.status, from)))
    .returning({ id: schema.deals.id });
  if (claimed.length === 0) throw new HttpError(409, "This step is already in progress or done");
  try {
    return await work();
  } catch (err) {
    await db.update(schema.deals).set({ status: from }).where(eq(schema.deals.id, deal.id));
    throw err;
  }
}

export async function updateListing(id: string, values: Partial<Listing>) {
  const db = await getDb();
  await db.update(schema.listings).set(values).where(eq(schema.listings.id, id));
}

/** Saves uploaded photos and returns them in upload order. */
export async function savePhotos(
  form: FormData,
  ctx: { listingId: string; dealId?: string; stage: string },
): Promise<{ ids: string[]; photos: Photo[] }> {
  const files = form.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) throw new HttpError(400, "Add at least one photo");
  if (files.length > 8) throw new HttpError(400, "At most 8 photos at a time");
  const db = await getDb();
  const ids: string[] = [];
  const photos: Photo[] = [];
  for (const file of files) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new HttpError(400, `Unsupported image type ${file.type}`);
    if (file.size > 4 * 1024 * 1024) throw new HttpError(400, "Each photo must be under 4 MB");
    const data = new Uint8Array(await file.arrayBuffer());
    const id = newId();
    await db.insert(schema.photos).values({
      id,
      listingId: ctx.listingId,
      dealId: ctx.dealId ?? null,
      stage: ctx.stage,
      mime: file.type,
      data,
    });
    ids.push(id);
    photos.push({ mime: file.type, data });
  }
  return { ids, photos };
}

export async function markPhotosPublic(ids: string[]) {
  if (ids.length === 0) return;
  const db = await getDb();
  await db.update(schema.photos).set({ isPublic: true }).where(inArray(schema.photos.id, ids));
}

export async function photoIds(filter: {
  listingId: string;
  dealId?: string;
  stage: string;
  publicOnly?: boolean;
}): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.photos.id })
    .from(schema.photos)
    .where(
      and(
        eq(schema.photos.listingId, filter.listingId),
        eq(schema.photos.stage, filter.stage),
        ...(filter.dealId ? [eq(schema.photos.dealId, filter.dealId)] : []),
        ...(filter.publicOnly ? [eq(schema.photos.isPublic, true)] : []),
      ),
    )
    .orderBy(asc(schema.photos.createdAt));
  return rows.map((r) => r.id);
}

export async function loadPhotos(ids: string[]): Promise<Photo[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  const rows = await db.select().from(schema.photos).where(inArray(schema.photos.id, ids));
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)!).map((r) => ({ mime: r.mime, data: r.data }));
}

export async function dealEvents(dealId: string) {
  const db = await getDb();
  return db
    .select({ type: schema.events.type, payload: schema.events.payload, createdAt: schema.events.createdAt })
    .from(schema.events)
    .where(eq(schema.events.dealId, dealId))
    .orderBy(asc(schema.events.createdAt));
}

/**
 * After the 3-day honor period a capture may fail, so reauthorize first (allowed up
 * to day 29). Only an untouched hold can be reauthorized.
 */
export async function ensureFreshHold(deal: Deal): Promise<Deal> {
  if (!deal.authorizationId || !deal.authorizedAt || deal.capturedCents > 0) return deal;
  const { phase } = (await import("./policy")).holdClock(deal.authorizedAt);
  if (phase === "honor") return deal;
  if (phase === "expired") throw new HttpError(409, "The hold expired after 29 days. The buyer needs to pay again.");
  const auth = await paypal.reauthorize(deal.authorizationId, `reauth-${deal.id}-${deal.authorizationId}`);
  const authorizedAt = auth.create_time ? new Date(auth.create_time) : new Date();
  await updateDeal(deal.id, { authorizationId: auth.id, authorizedAt });
  await logEvent({ dealId: deal.id, type: "paypal.reauthorized", payload: { previous: deal.authorizationId, authorizationId: auth.id } });
  return { ...deal, authorizationId: auth.id, authorizedAt };
}

/** The buyer protection fee for a price. Zero when the seller is the payee, since Clasp couldn't collect it. */
export function feeFor(priceCents: number): number {
  return env.paypalSettlement() === "platform_payout" ? protectionFeeCents(priceCents, env.claspFeeBps()) : 0;
}

/**
 * The only place money is captured. With platform_payout, Clasp captures
 * `captureCents` (which may include its fee) and pays the seller exactly
 * `payoutCents` by Payouts. With direct_payee the order already names the seller,
 * so the capture itself pays them.
 */
export async function captureForSeller(input: {
  deal: Deal;
  listing: Listing;
  captureCents: number;
  payoutCents: number;
  finalCapture: boolean;
  purpose: string;
}) {
  if (!input.deal.authorizationId) throw new HttpError(409, "No active hold on this deal");
  const requestId = `capture-${input.deal.id}-${input.purpose}`;
  const capture = await paypal.captureAuthorization({
    authorizationId: input.deal.authorizationId,
    amountCents: input.captureCents,
    currency: input.listing.currency,
    finalCapture: input.finalCapture,
    requestId,
    noteToPayer: `Clasp: ${input.listing.title} (${input.purpose})`,
  });
  await logEvent({
    dealId: input.deal.id,
    type: "paypal.capture",
    payload: { purpose: input.purpose, captureId: capture.id, status: capture.status, amount: capture.amount, finalCapture: input.finalCapture },
  });

  const platform = env.paypalSettlement() === "platform_payout";
  const paidOut = platform ? input.payoutCents : input.captureCents;
  if (platform && input.payoutCents > 0) {
    const result = await paypal.payout({
      batchId: `payout-${input.deal.id}-${input.purpose}`,
      receiverEmail: input.listing.sellerPaypalEmail,
      amountCents: input.payoutCents,
      currency: input.listing.currency,
      note: `Payment for ${input.listing.title}, verified by Clasp.`,
    });
    await logEvent({
      dealId: input.deal.id,
      type: "paypal.payout",
      payload: { ...result.batch_header, amount: { value: (input.payoutCents / 100).toFixed(2), currency_code: input.listing.currency } },
    });
  }

  await updateDeal(input.deal.id, {
    capturedCents: input.deal.capturedCents + input.captureCents,
    paidOutCents: input.deal.paidOutCents + paidOut,
  });
  return capture;
}
