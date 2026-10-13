/**
 * Tells the right party what just happened to their money: browser push (works with the
 * page closed, no account needed) and email when configured. Failures are logged and
 * never interrupt the payment flow.
 */
import { and, eq, inArray } from "drizzle-orm";
import { after } from "next/server";
import webpush from "web-push";
import { getDb, schema } from "./db";
import type { Deal, Listing } from "./db/schema";
import { env } from "./env";

export type Audience = "seller" | "buyer";
export type Message = { title: string; body: string };

let vapidReady: boolean | null = null;
function pushConfigured(): boolean {
  if (vapidReady !== null) return vapidReady;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  vapidReady = !!(pub && priv);
  if (vapidReady) webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:hello@clasp.app", pub!, priv!);
  return vapidReady;
}

function linkFor(audience: Audience, listing: Listing, deal: Deal | null): string {
  const base = env.appUrl();
  if (!deal) return `${base}/l/${listing.id}?k=${listing.sellerKey}`;
  return `${base}/d/${deal.id}?k=${audience === "seller" ? listing.sellerKey : deal.buyerKey}`;
}

async function sendPush(audience: Audience, listing: Listing, deal: Deal | null, msg: Message, url: string) {
  if (!pushConfigured()) return;
  const db = await getDb();
  const subs = await db
    .select()
    .from(schema.pushSubscriptions)
    .where(
      audience === "seller"
        ? and(eq(schema.pushSubscriptions.role, "seller"), eq(schema.pushSubscriptions.listingId, listing.id))
        : and(eq(schema.pushSubscriptions.role, "buyer"), eq(schema.pushSubscriptions.dealId, deal?.id ?? "")),
    );
  const gone: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: s.keys },
          JSON.stringify({ title: msg.title, body: msg.body, url, tag: deal?.id ?? listing.id }),
          { TTL: 60 * 60 * 24 },
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(s.endpoint);
        else console.error("Push failed", status, err);
      }
    }),
  );
  if (gone.length) await db.delete(schema.pushSubscriptions).where(inArray(schema.pushSubscriptions.endpoint, gone));
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function sendEmail(to: string | null | undefined, msg: Message, url: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !to) return;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "Clasp <onboarding@resend.dev>",
      to: [to],
      subject: msg.title,
      html: `<div style="font-family:system-ui,sans-serif;max-width:480px"><h2 style="margin:0 0 8px">${escapeHtml(msg.title)}</h2><p style="color:#363c4a">${escapeHtml(msg.body)}</p><p><a href="${url}" style="display:inline-block;background:#11141b;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none">Open in Clasp</a></p><p style="color:#6b7385;font-size:12px">Clasp: money moves only when the thing does.</p></div>`,
    }),
  });
  if (!res.ok) console.error("Email failed", res.status, await res.text());
}

export async function notify(audience: Audience, listing: Listing, deal: Deal | null, msg: Message) {
  const url = linkFor(audience, listing, deal);
  const email = audience === "seller" ? listing.notifyEmail : deal?.buyerEmail;
  await Promise.allSettled([sendPush(audience, listing, deal, msg, url), sendEmail(email, msg, url)]).then((results) =>
    results.forEach((r) => r.status === "rejected" && console.error("Notify failed", r.reason)),
  );
}

/** Sends after the HTTP response, so a slow push service never delays a payment step. */
export function notifyLater(audience: Audience, listing: Listing, deal: Deal | null, msg: Message) {
  after(() => notify(audience, listing, deal, msg));
}
