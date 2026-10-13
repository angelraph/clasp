import { authorizeDeal } from "@/lib/deals";
import { handler, type RouteCtx } from "@/lib/http";

/** Called after the buyer approves in the PayPal popup: turns the approval into a hold. */
export const POST = handler(async (req: Request, { params }: RouteCtx) => {
  const { id } = await params;
  const { key, orderId } = (await req.json()) as { key?: string; orderId?: string };
  return authorizeDeal(id, key, orderId);
});
