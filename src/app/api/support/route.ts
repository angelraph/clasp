import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { handler } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { HttpError, logEvent, newId } from "@/lib/store";

const TOPICS = ["payment", "handoff", "rental", "dispute", "listing", "privacy", "other"] as const;

const body = z.object({
  topic: z.enum(TOPICS),
  email: z.string().trim().email("Enter an email so we can reply"),
  deal: z.string().trim().max(300).optional().default(""),
  message: z.string().trim().min(10, "Tell us a little more (10+ characters)").max(4000),
});

/** Accepts a deal ID or any Clasp deal/proof URL and returns the deal ID, if it exists. */
async function resolveDeal(input: string): Promise<string | null> {
  const id = input.match(/\/(?:d|p)\/([a-z0-9]{12})/)?.[1] ?? (/^[a-z0-9]{12}$/.test(input) ? input : null);
  if (!id) return null;
  const db = await getDb();
  const [d] = await db.select({ id: schema.deals.id }).from(schema.deals).where(eq(schema.deals.id, id));
  return d?.id ?? null;
}

export const POST = handler(async (req: Request) => {
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, parsed.error.issues.map((i) => i.message).join("; "));
  await rateLimit(`support:ip:${clientIp(req)}`, 8, 3600);
  const { topic, email, deal, message } = parsed.data;

  const dealId = deal ? await resolveDeal(deal) : null;
  const id = `T-${newId().slice(0, 8).toUpperCase()}`;
  const db = await getDb();
  await db.insert(schema.supportTickets).values({ id, topic, email, dealId, message });
  if (dealId) await logEvent({ dealId, type: "support.ticket_opened", payload: { ticket: id, topic } });

  // Forward to the support inbox when email is configured; the ticket is stored either way.
  const to = process.env.SUPPORT_EMAIL;
  if (process.env.RESEND_API_KEY && to) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Clasp <onboarding@resend.dev>",
        to: [to],
        reply_to: email,
        subject: `[${id}] ${topic}${dealId ? ` · deal ${dealId}` : ""}`,
        text: `${message}\n\nFrom: ${email}${dealId ? `\nDeal: ${dealId}` : ""}`,
      }),
    }).catch((err) => console.error("Support email failed", err));
  }
  return { ticket: id, linkedDeal: dealId };
});
