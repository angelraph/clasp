import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { startDeal } from "@/lib/deals";
import { formatMoney } from "@/lib/money";
import { holdClock } from "@/lib/policy";
import { rateLimit } from "@/lib/ratelimit";
import { searchListings, summarize } from "@/lib/search";
import { getDeal, getListing, HttpError, roleFor } from "@/lib/store";

export const maxDuration = 60;

const INSTRUCTIONS = `Clasp lets you shop second-hand and rental listings that were verified in the seller's hands, and pay through PayPal with protection built in.

How protection works, so you can explain it to your user:
- Every listing was photographed by the seller with a one-time code, so the item exists and the seller has it.
- Payment is a PayPal authorization (a hold). Nothing is charged until the buyer scans the item at an in-person handoff and Clasp confirms it is the listed item (serial number/IMEI or unique marks).
- Rentals hold fee + deposit; only damage from a price list shown up front can be charged.

Rules for agents:
- You can search and start a purchase, but you cannot move money. start_protected_purchase returns a PayPal link that the human must open and approve themselves. Always show it to them; never claim the purchase is complete.
- Handoffs are in person: check the listing's location suits your user before starting a purchase.`;

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] };
}

function errorResult(err: unknown) {
  const message = err instanceof HttpError || err instanceof Error ? err.message : "Unexpected error";
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true };
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "search_verified_listings",
      {
        title: "Search verified listings",
        description:
          "Find items for sale or rent whose seller proved possession with a photo. Results include price, the total the buyer will authorize, meeting location, condition notes from the verification photos and a live market price check.",
        inputSchema: z.object({
          query: z.string().describe('What to look for, e.g. "iPhone 13", "camera", "bike"').default(""),
          location: z.string().optional().describe("City or area to filter by (handoffs are in person)"),
          mode: z.enum(["sale", "rental"]).optional(),
          max_price_usd: z.number().positive().optional(),
          limit: z.number().int().min(1).max(25).default(10),
        }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ query, location, mode, max_price_usd, limit }) => {
        try {
          const results = await searchListings({
            query,
            location,
            mode,
            maxPriceCents: max_price_usd ? Math.round(max_price_usd * 100) : undefined,
            limit,
          });
          if (results.length === 0) return text("No verified listings match. Try a broader query or another location.");
          return text(
            results.map((r) => ({
              listing_id: r.id,
              title: r.title,
              mode: r.mode,
              location: r.location,
              price: formatMoney(r.priceCents),
              ...(r.mode === "rental" ? { deposit: formatMoney(r.depositCents) } : {}),
              buyer_authorizes: formatMoney(r.buyerTotalCents),
              verified_by: r.verifiedBy,
              condition: r.conditionNotes,
              market: r.marketSignal,
              url: r.url,
            })),
          );
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    server.registerTool(
      "get_listing",
      {
        title: "Get listing details",
        description: "Full details for one listing, including rental damage prices agreed up front and how the payment protection works.",
        inputSchema: z.object({ listing_id: z.string() }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ listing_id }) => {
        try {
          const listing = await getListing(listing_id);
          if (listing.status === "draft") throw new HttpError(404, "Listing not found");
          return text({
            ...summarize(listing),
            available: listing.status === "verified",
            description: listing.description,
            ...(listing.mode === "rental"
              ? {
                  chargeable_from_deposit: [
                    ...listing.accessories.map((a) => `Missing ${a.name}: ${formatMoney(a.priceCents)}`),
                    ...listing.damageRules.map((r) => `${r.label}: ${formatMoney(r.priceCents)}`),
                  ],
                }
              : {}),
            protection:
              listing.mode === "sale"
                ? "PayPal holds the money. The seller is paid only after the buyer scans the item at the handoff and it matches the verified listing. If it doesn't, nothing is charged."
                : "PayPal holds fee + deposit. The fee is paid at pickup; at return only the charges listed above can be taken, and the rest is released.",
          });
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    server.registerTool(
      "start_protected_purchase",
      {
        title: "Start a protected purchase",
        description:
          "Reserves nothing and charges nothing. Creates a PayPal order on hold and returns an approval link that the HUMAN must open and approve in PayPal. After approval PayPal holds the funds until the item checks out at the handoff. Return both links to the user and keep the deal_url private: it is their key to the deal.",
        inputSchema: z.object({ listing_id: z.string() }),
        annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
      },
      async ({ listing_id }) => {
        try {
          await rateLimit(`agent:start:${listing_id}`, 10, 3600);
          const deal = await startDeal(listing_id, { redirect: true, startedBy: "agent" });
          if (!deal.approveUrl) throw new Error("PayPal didn't return an approval link");
          return text({
            status: "awaiting_human_approval",
            amount_to_authorize: formatMoney(deal.amountCents),
            approve_in_paypal: deal.approveUrl,
            deal_url: deal.dealUrl,
            deal_id: deal.dealId,
            buyer_key: deal.buyerKey,
            next_steps: [
              "Ask the user to open approve_in_paypal and approve. That places a hold; nothing is charged yet.",
              "PayPal then returns them to deal_url, where they scan the item at the meetup.",
              "The seller is paid only after the scan matches and the user taps Release.",
            ],
          });
        } catch (err) {
          return errorResult(err);
        }
      },
    );

    server.registerTool(
      "get_deal_status",
      {
        title: "Get deal status",
        description: "Where a protected purchase stands: waiting for approval, held, verified, paid, cancelled; and what happens next.",
        inputSchema: z.object({ deal_id: z.string(), buyer_key: z.string() }),
        annotations: { readOnlyHint: true, openWorldHint: false },
      },
      async ({ deal_id, buyer_key }) => {
        try {
          const { deal, listing } = await getDeal(deal_id);
          if (roleFor(deal, listing, buyer_key) !== "buyer") throw new HttpError(403, "Wrong buyer_key for this deal");
          const next: Record<string, string> = {
            awaiting_payment: "Waiting for the user to approve in PayPal.",
            held: listing.mode === "sale" ? "Money is on hold. At the meetup, scan the item in the deal room." : "Money is on hold. At pickup, record the item's condition in the deal room.",
            active: "Rental in progress. The owner scans the item back in at return.",
            returned: "Return checked. The owner settles the deposit next.",
            released: "Complete. The seller was paid after the item checked out.",
            settled: "Complete. The deposit was settled.",
            voided: "Cancelled. PayPal released the hold; nothing was charged.",
          };
          return text({
            status: deal.status,
            title: listing.title,
            authorized: formatMoney(deal.authorizedCents),
            captured: formatMoney(deal.capturedCents),
            hold_guaranteed_until: deal.authorizedAt ? holdClock(deal.authorizedAt).honorEndsAt.toISOString() : null,
            next: next[deal.status] ?? "In progress.",
          });
        } catch (err) {
          return errorResult(err);
        }
      },
    );
  },
  {
    serverInfo: { name: "clasp", version: "1.0.0" },
    instructions: INSTRUCTIONS,
  },
);

export { handler as GET, handler as POST, handler as DELETE };
