import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { handler } from "@/lib/http";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { newPossessionCode } from "@/lib/policy";
import { HttpError, logEvent, newId, newKey } from "@/lib/store";

const cents = z.number().int().positive().max(1_000_000);

const body = z
  .object({
    mode: z.enum(["sale", "rental"]),
    title: z.string().trim().min(3).max(100),
    description: z.string().trim().max(1000).default(""),
    location: z.string().trim().min(2, "Add where the handoff happens (city or area)").max(80),
    priceCents: cents,
    depositCents: z.number().int().min(0).max(1_000_000).default(0),
    sellerName: z.string().trim().min(1).max(60),
    sellerPaypalEmail: z.string().trim().email(),
    notifyEmail: z.union([z.string().trim().email(), z.literal("")]).optional(),
    accessories: z.array(z.object({ name: z.string().trim().min(1).max(40), priceCents: cents })).max(10).default([]),
    damageRules: z.array(z.object({ label: z.string().trim().min(1).max(60), priceCents: cents })).max(10).default([]),
  })
  .refine((b) => b.mode === "sale" || b.depositCents > 0, { message: "A rental needs a deposit" });

export const POST = handler(async (req: Request) => {
  const parsed = body.safeParse(await req.json());
  if (!parsed.success) throw new HttpError(400, parsed.error.issues.map((i) => i.message).join("; "));
  await rateLimit(`listings:ip:${clientIp(req)}`, 20, 3600);
  const input = parsed.data;

  const id = newId();
  const sellerKey = newKey();
  const possessionCode = newPossessionCode();
  const db = await getDb();
  await db.insert(schema.listings).values({
    id,
    mode: input.mode,
    title: input.title,
    description: input.description,
    location: input.location,
    priceCents: input.priceCents,
    depositCents: input.mode === "rental" ? input.depositCents : 0,
    sellerName: input.sellerName,
    sellerPaypalEmail: input.sellerPaypalEmail,
    notifyEmail: input.notifyEmail || null,
    sellerKey,
    possessionCode,
    accessories: input.mode === "rental" ? input.accessories : [],
    damageRules:
      input.mode === "rental"
        ? input.damageRules.map((r, i) => ({ id: `rule_${i + 1}`, label: r.label, priceCents: r.priceCents }))
        : [],
  });
  await logEvent({ listingId: id, type: "listing.created", payload: { mode: input.mode } });
  return { id, sellerKey, possessionCode };
});
