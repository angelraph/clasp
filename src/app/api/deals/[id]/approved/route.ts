import { NextResponse } from "next/server";
import { authorizeDeal } from "@/lib/deals";
import { env } from "@/lib/env";
import type { RouteCtx } from "@/lib/http";

/**
 * PayPal sends the buyer here after they approve on PayPal's own page (the path used
 * when an AI agent started the purchase). PayPal appends ?token=<order id>.
 */
export async function GET(req: Request, { params }: RouteCtx) {
  const { id } = await params;
  const url = new URL(req.url);
  const key = url.searchParams.get("k");
  const orderId = url.searchParams.get("token");
  const dealUrl = `${env.appUrl()}/d/${id}?k=${encodeURIComponent(key ?? "")}`;
  try {
    await authorizeDeal(id, key, orderId);
    return NextResponse.redirect(dealUrl, 303);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't place the hold";
    return NextResponse.redirect(`${dealUrl}&error=${encodeURIComponent(message)}`, 303);
  }
}
