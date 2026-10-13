import type { Metadata } from "next";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Clasp for AI agents",
  description: "Let shopping agents find verified second-hand listings and start PayPal-protected purchases that only a human can approve.",
};

const TOOLS = [
  ["search_verified_listings", "Find items and rentals by keyword, location, mode and max price. Read-only."],
  ["get_listing", "Details, verified condition, rental damage prices and how protection works. Read-only."],
  ["start_protected_purchase", "Creates a PayPal order on hold and returns an approval link. The human approves in PayPal; nothing is charged until the item checks out."],
  ["get_deal_status", "Where the purchase stands and what happens next (needs the buyer key)."],
];

export default function AgentsPage() {
  const url = `${env.appUrl()}/api/mcp`;
  return (
    <div className="mx-auto max-w-xl px-4 pt-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Clasp for AI agents</h1>
        <p className="mt-2 text-ink-700">
          Shopping agents can find listings verified in the seller&apos;s hands and start a protected purchase. They can never move money:
          the human approves the hold in PayPal, and the seller is paid only when the item checks out at the handoff.
        </p>
      </div>

      <div className="card space-y-2">
        <h2 className="font-semibold">Agents commit. PayPal holds. The item releases.</h2>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-ink-700">
          <li>The agent searches verified listings and picks one for its user.</li>
          <li>It starts a protected purchase and hands the user a PayPal approval link.</li>
          <li>The user approves in PayPal. The money is held, not charged.</li>
          <li>At the meetup the user scans the item. Only a match releases payment to the seller.</li>
        </ol>
      </div>

      <div className="card space-y-2 text-sm">
        <h2 className="font-semibold">Connect</h2>
        <p className="text-ink-500">MCP server (Streamable HTTP, no auth needed for search):</p>
        <pre className="overflow-x-auto rounded-xl bg-ink-900 p-3 text-xs text-white">{url}</pre>
        <p className="text-ink-500">Claude Code:</p>
        <pre className="overflow-x-auto rounded-xl bg-ink-900 p-3 text-xs text-white">{`claude mcp add --transport http clasp ${url}`}</pre>
        <p className="text-ink-500">Any MCP client config:</p>
        <pre className="overflow-x-auto rounded-xl bg-ink-900 p-3 text-xs text-white">{JSON.stringify({ mcpServers: { clasp: { url } } }, null, 2)}</pre>
      </div>

      <div className="card text-sm">
        <h2 className="font-semibold">Tools</h2>
        <dl className="mt-2 space-y-3">
          {TOOLS.map(([name, desc]) => (
            <div key={name}>
              <dt className="font-mono text-xs font-semibold">{name}</dt>
              <dd className="text-ink-700">{desc}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
