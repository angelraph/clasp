import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { RouteCtx } from "@/lib/http";

/**
 * Public photos (item shots with nothing identifying) are open. Everything else
 * (verification shots, identifiers, handoff and rental scans) needs a key from a party
 * to this listing or deal.
 */
export async function GET(req: Request, { params }: RouteCtx) {
  const { id } = await params;
  const db = await getDb();
  const [photo] = await db.select().from(schema.photos).where(eq(schema.photos.id, id));
  if (!photo) return new Response("Not found", { status: 404 });

  if (!photo.isPublic) {
    const key = new URL(req.url).searchParams.get("k");
    const [listing] = await db.select({ sellerKey: schema.listings.sellerKey }).from(schema.listings).where(eq(schema.listings.id, photo.listingId));
    let allowed = !!key && key === listing?.sellerKey;
    if (!allowed && key && photo.dealId) {
      const [deal] = await db.select({ buyerKey: schema.deals.buyerKey }).from(schema.deals).where(eq(schema.deals.id, photo.dealId));
      allowed = key === deal?.buyerKey;
    }
    if (!allowed) return new Response("Not found", { status: 404 });
  }

  return new Response(Buffer.from(photo.data), {
    headers: {
      "Content-Type": photo.mime,
      "Cache-Control": photo.isPublic ? "public, max-age=31536000, immutable" : "private, no-store",
    },
  });
}
