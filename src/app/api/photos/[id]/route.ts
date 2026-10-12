import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import type { RouteCtx } from "@/lib/http";

export async function GET(_req: Request, { params }: RouteCtx) {
  const { id } = await params;
  const db = await getDb();
  const [photo] = await db.select().from(schema.photos).where(eq(schema.photos.id, id));
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(photo.data), {
    headers: { "Content-Type": photo.mime, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
