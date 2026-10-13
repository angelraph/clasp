import { buildEvidencePdf } from "@/lib/evidence";
import { handler, type RouteCtx } from "@/lib/http";
import { getDeal, HttpError, roleFor } from "@/lib/store";

export const maxDuration = 60;

/** The handoff record PDF, for either party to keep. */
export const GET = handler(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const key = new URL(req.url).searchParams.get("k");
  const { deal, listing } = await getDeal(id);
  if (!roleFor(deal, listing, key)) throw new HttpError(403, "Not a party to this deal");
  const pdf = await buildEvidencePdf(deal, listing);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="clasp-handoff-record-${deal.id}.pdf"`,
    },
  });
});
