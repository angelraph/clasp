import type { Metadata } from "next";
import { DocPage } from "@/components/DocPage";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  title: "Docs · Clasp",
  description: "How Clasp is built: PayPal authorization and capture, the AI/policy boundary, photo privacy, webhooks, disputes, payouts and the MCP server for agents.",
};

const TOC = [
  { id: "overview", label: "Overview" },
  { id: "architecture", label: "Architecture" },
  { id: "sale", label: "Sale flow" },
  { id: "rental", label: "Rental flow" },
  { id: "policy", label: "AI reads, rules decide" },
  { id: "privacy", label: "Photo privacy" },
  { id: "paypal", label: "PayPal integration" },
  { id: "webhooks", label: "Webhooks & disputes" },
  { id: "agents", label: "Agents (MCP)" },
  { id: "api", label: "HTTP API" },
  { id: "run", label: "Run it" },
  { id: "limits", label: "Limits" },
];

function Diagram() {
  const box = "fill-card stroke-line";
  return (
    <figure className="not-prose my-6 overflow-x-auto rounded-[10px] border border-line bg-paper p-4">
      <svg viewBox="0 0 760 320" className="min-w-[640px]" role="img" aria-label="Clasp architecture">
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#6F6A62" />
          </marker>
        </defs>
        <g fontFamily="var(--font-geist-sans)" fontSize="12" fill="#141413">
          <rect x="10" y="110" width="130" height="70" rx="10" className={box} />
          <text x="75" y="140" textAnchor="middle" fontWeight="600">Phone browser</text>
          <text x="75" y="158" textAnchor="middle" fill="#6F6A62">camera · PayPal JS v6</text>

          <rect x="200" y="20" width="200" height="260" rx="10" className={box} />
          <text x="300" y="44" textAnchor="middle" fontWeight="600">Clasp (Next.js)</text>
          {[
            ["Privacy redaction", 70],
            ["Vision reading", 112],
            ["Policy (plain code)", 154],
            ["Deal state + events", 196],
            ["MCP server", 238],
          ].map(([t, y]) => (
            <g key={t as string}>
              <rect x="218" y={(y as number) - 16} width="164" height="30" rx="6" fill={t === "Policy (plain code)" ? "#F1E8DA" : "#F4F1EA"} stroke="#E6E1D6" />
              <text x="300" y={(y as number) + 4} textAnchor="middle">{t as string}</text>
            </g>
          ))}

          <rect x="470" y="20" width="130" height="60" rx="10" className={box} />
          <text x="535" y="46" textAnchor="middle" fontWeight="600">OpenAI</text>
          <text x="535" y="63" textAnchor="middle" fill="#6F6A62">images in, JSON out</text>

          <rect x="470" y="110" width="130" height="80" rx="10" className={box} />
          <text x="535" y="136" textAnchor="middle" fontWeight="600">PayPal</text>
          <text x="535" y="153" textAnchor="middle" fill="#6F6A62">Orders · Payments</text>
          <text x="535" y="169" textAnchor="middle" fill="#6F6A62">Payouts · Disputes</text>

          <rect x="470" y="220" width="130" height="60" rx="10" className={box} />
          <text x="535" y="246" textAnchor="middle" fontWeight="600">Postgres</text>
          <text x="535" y="263" textAnchor="middle" fill="#6F6A62">Neon · PGlite locally</text>

          <rect x="650" y="110" width="100" height="80" rx="10" className={box} />
          <text x="700" y="140" textAnchor="middle" fontWeight="600">AI agents</text>
          <text x="700" y="158" textAnchor="middle" fill="#6F6A62">via MCP</text>

          <g stroke="#6F6A62" strokeWidth="1.2" fill="none" markerEnd="url(#arr)">
            <path d="M140 145 H198" />
            <path d="M382 70 C425 70 425 44 468 44" />
            <path d="M382 112 C425 112 425 58 468 58" />
            <path d="M382 154 H468" />
            <path d="M382 196 C425 196 425 250 468 250" />
            <path d="M700 192 C700 310 420 312 384 246" />
            <path d="M535 192 V218" strokeDasharray="3 3" />
          </g>
          <text x="425" y="172" textAnchor="middle" fontSize="10.5" fill="#7A5532">only policy</text>
          <text x="425" y="185" textAnchor="middle" fontSize="10.5" fill="#7A5532">calls PayPal</text>
          <text x="545" y="208" fontSize="10.5" fill="#6F6A62">webhooks</text>
        </g>
      </svg>
      <figcaption className="mt-2 text-xs text-ink-500">The vision model never calls PayPal and never decides money. Only the policy layer does.</figcaption>
    </figure>
  );
}

export default function DocsPage() {
  const base = env.appUrl();
  return (
    <DocPage
      eyebrow="Docs"
      title="How Clasp works under the hood."
      lead="For developers and judges: the PayPal flows, where the AI stops and plain rules take over, how photos stay private, and how agents connect."
      toc={TOC}
    >
      <article className="prose-clasp">
        <h2 id="overview">Overview</h2>
        <p>
          Clasp ties a PayPal payment to a physical item. The buyer&apos;s money is <strong>authorized, not captured</strong>. It&apos;s captured
          only after the item in the buyer&apos;s hands is proven to be the one that was listed: the same serial or IMEI, or the same unique
          marks. Sales use one handoff; rentals use two (pickup and return) against a fee-plus-deposit hold.
        </p>
        <p>
          Source: <a href="https://github.com/angelraph/clasp">github.com/angelraph/clasp</a> (MIT). Stack: Next.js 15, TypeScript, Drizzle on
          Postgres (Neon in production, embedded PGlite locally), the OpenAI Responses API with strict structured outputs, PayPal REST APIs and
          JS SDK v6, sharp for image processing, web push.
        </p>

        <h2 id="architecture">Architecture</h2>
        <Diagram />

        <h2 id="sale">Sale flow</h2>
        <table>
          <thead><tr><th>Step</th><th>What happens</th><th>PayPal</th></tr></thead>
          <tbody>
            <tr><td>List</td><td>Seller photographs the item with a one-time code. Photos are redacted, read, and policy verifies code + identifier.</td><td>none</td></tr>
            <tr><td>Pay</td><td>Buyer approves in the PayPal popup. Price + buyer protection is held.</td><td><code>POST /v2/checkout/orders</code> (intent AUTHORIZE), then <code>/authorize</code></td></tr>
            <tr><td>Handoff</td><td>Buyer scans the item. The model transcribes identifiers without being told the expected value; policy compares.</td><td>none</td></tr>
            <tr><td>Release</td><td>Only after a policy match. Capture, then pay the seller their full price.</td><td><code>/v2/payments/authorizations/:id/capture</code>, <code>POST /v1/payments/payouts</code></td></tr>
            <tr><td>Cancel</td><td>Either side, before capture.</td><td><code>/authorizations/:id/void</code></td></tr>
          </tbody>
        </table>
        <p>
          Holds are honored for 3 days. After that Clasp reauthorizes (allowed to day 29) before capturing. Every money call carries a
          <code>PayPal-Request-Id</code>, and each step is guarded by a compare-and-set status change, so a double tap can&apos;t charge twice.
        </p>

        <h2 id="rental">Rental flow</h2>
        <ol>
          <li>One authorization for <strong>fee + protection + deposit</strong>.</li>
          <li>Pickup: the renter records condition and accessories; the fee is captured with <code>final_capture: false</code>, so the deposit stays held.</li>
          <li>Return: the owner scans it back; the model compares pickup and return photos against a fixed list of damage categories.</li>
          <li>Settle: policy charges only confident findings from the owner&apos;s pre-agreed price list, capped at the deposit, with <code>final_capture: true</code>. A clean return voids the remainder.</li>
        </ol>

        <h2 id="policy">AI reads, rules decide</h2>
        <p>The model is a reader. Everything that moves money lives in <code>src/lib/policy.ts</code> and is unit-tested:</p>
        <ul>
          <li>Identifiers below 0.8 confidence are ignored; IMEIs must pass the Luhn check, which rejects most single-digit misreads.</li>
          <li>A mismatch never shows the listed identifier in full, so it can&apos;t teach a scammer the real one.</li>
          <li>Phones and tablets must show the anti-theft lock switched off.</li>
          <li>Items without serials need at least two recorded marks seen, and none clearly missing.</li>
          <li>Rental charges come only from the owner&apos;s price list, each applied once, capped at the deposit. Anything else is shown as &ldquo;flagged, not charged&rdquo;.</li>
          <li>Market checks (Channel3) compare only against products with the same brand and model number, and need at least 3 offers before judging a price.</li>
        </ul>

        <h2 id="privacy">Photo privacy</h2>
        <p>
          Before any photo is stored, a privacy pass finds other people&apos;s personal information (phone numbers, contact names, call logs,
          messages, emails, faces) and pixelates it with sharp. The item&apos;s serial and the one-time code stay readable. Images are
          re-encoded, which strips EXIF data like GPS. The original is never stored; if the check fails, the upload is refused.
        </p>
        <p>
          Photos are private by default. Only shots the model marks as showing the item and nothing identifying appear on public pages. Every
          other photo needs a seller or buyer key.
        </p>

        <h2 id="paypal">PayPal integration</h2>
        <table>
          <thead><tr><th>Capability</th><th>Used for</th></tr></thead>
          <tbody>
            <tr><td>JS SDK v6</td><td>PayPal button, one-time payment session</td></tr>
            <tr><td>Orders v2 · AUTHORIZE</td><td>Holds for sales and rentals; redirect approval for agent-started purchases</td></tr>
            <tr><td>Payments v2</td><td>Capture (partial and final), void, reauthorize</td></tr>
            <tr><td>Payouts</td><td>Paying the seller their full price at release</td></tr>
            <tr><td>Webhooks</td><td>Signature-verified PayPal confirmations in every deal timeline</td></tr>
            <tr><td>Disputes</td><td>Automatic evidence: the handoff record PDF via <code>provide-evidence</code></td></tr>
          </tbody>
        </table>
        <p>
          Settlement uses <code>platform_payout</code>: Clasp is the payee and pays sellers by Payouts, so it can add buyer protection on top
          (5%, min $1). Naming the seller as payee is supported in code, but PayPal refuses AUTHORIZE holds for third-party payees without
          partner approval.
        </p>

        <h2 id="webhooks">Webhooks &amp; disputes</h2>
        <p>
          <code>POST /api/webhooks/paypal</code> verifies each event with PayPal&apos;s <code>verify-webhook-signature</code> and maps it to a deal
          via <code>custom_id</code>, payout batch ID, or disputed capture. Subscribed events include authorization created/voided, capture
          completed/declined/refunded, payout item outcomes, and dispute created/updated/resolved.
        </p>
        <p>
          On a dispute, Clasp builds the handoff record (possession proof, match, photos, PayPal timeline) and submits it with the evidence type
          PayPal requested, falling back to <code>OTHER</code>. Submissions are recorded so nothing is sent twice.
        </p>

        <h2 id="agents">Agents (MCP)</h2>
        <p>Streamable HTTP MCP server, no auth for search:</p>
        <pre><code>{`${base}/api/mcp`}</code></pre>
        <p>
          Tools: <code>search_verified_listings</code>, <code>get_listing</code>, <code>start_protected_purchase</code>,
          <code>get_deal_status</code>. Agents can start a purchase but never move money: the tool returns a PayPal approval link that the human
          must open. See <a href="/agents">For AI agents</a>.
        </p>

        <h2 id="api">HTTP API</h2>
        <table>
          <thead><tr><th>Route</th><th>Purpose</th></tr></thead>
          <tbody>
            <tr><td><code>POST /api/listings</code></td><td>Create a listing; returns the seller key and one-time code</td></tr>
            <tr><td><code>POST /api/listings/:id/verify</code></td><td>Upload possession photos (multipart)</td></tr>
            <tr><td><code>POST /api/deals</code></td><td>Start a deal and PayPal order</td></tr>
            <tr><td><code>POST /api/deals/:id/authorize</code></td><td>Place the hold after approval</td></tr>
            <tr><td><code>POST /api/deals/:id/handoff</code> · <code>/release</code></td><td>Sale handoff scan and release</td></tr>
            <tr><td><code>POST /api/deals/:id/pickup</code> · <code>/return</code> · <code>/settle</code></td><td>Rental steps</td></tr>
            <tr><td><code>POST /api/deals/:id/cancel</code></td><td>Release the hold before capture</td></tr>
            <tr><td><code>GET /api/deals/:id/record</code></td><td>Handoff record PDF (party key)</td></tr>
            <tr><td><code>POST /api/support</code></td><td>Open a support ticket</td></tr>
          </tbody>
        </table>
        <p>Write endpoints and every AI call are rate limited per caller and per listing or deal.</p>

        <h2 id="run">Run it</h2>
        <pre><code>{`git clone https://github.com/angelraph/clasp
cd clasp && npm install
cp .env.example .env.local   # PayPal sandbox + OpenAI keys
npm run dev                   # http://localhost:3000
npm test                      # policy unit tests`}</code></pre>
        <p>Without <code>DATABASE_URL</code>, Clasp uses an embedded Postgres in <code>./.data</code>, so there&apos;s nothing else to install.</p>

        <h2 id="limits">Limits</h2>
        <ul>
          <li>Runs on the PayPal sandbox; production would use PayPal&apos;s platform features (fees, delayed disbursement), which need partner approval.</li>
          <li>The vision model reads; it is not a certified inspector. Low-confidence findings are never charged.</li>
          <li>Lock status is read from the device&apos;s own screen; carrier blacklist and IMEI database checks aren&apos;t included.</li>
          <li>Redaction relies on the model finding personal areas; boxes are padded, but very small or unusual text could be missed.</li>
        </ul>
      </article>
    </DocPage>
  );
}
