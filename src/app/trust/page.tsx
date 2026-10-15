import type { Metadata } from "next";
import Link from "next/link";
import { DocPage, StillStuck } from "@/components/DocPage";

export const metadata: Metadata = {
  title: "Trust & safety · Clasp",
  description: "What Clasp verifies, what the AI can and can't do, how photos stay private, and the honest limits.",
};

const TOC = [
  { id: "money", label: "Who holds the money" },
  { id: "verify", label: "What we verify" },
  { id: "ai", label: "What the AI can't do" },
  { id: "privacy", label: "Your photos" },
  { id: "scams", label: "Scams we stop" },
  { id: "safety", label: "Meeting safely" },
  { id: "limits", label: "Honest limits" },
];

function Pillar({ word, title, body }: { word: string; title: string; body: string }) {
  return (
    <div className="rounded-[10px] border border-line bg-card p-5">
      <p className="status text-brass-ink">{word}</p>
      <p className="mt-2 font-medium">{title}</p>
      <p className="mt-1 text-sm text-ink-500">{body}</p>
    </div>
  );
}

export default function TrustPage() {
  return (
    <DocPage
      eyebrow="Trust & safety"
      title="Built so nobody has to trust anybody."
      lead="Clasp's job is to make a deal with a stranger as safe as one with a friend. Here's exactly how, and where the edges are."
      toc={TOC}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Pillar word="Held" title="PayPal holds the money" body="Authorized, not charged, until the item checks out." />
        <Pillar word="Proven" title="The item releases it" body="Serial or unique marks must match. Not anyone's word." />
        <Pillar word="Private" title="Photos are cleaned" body="Other people's details are blurred before anything is saved." />
      </div>

      <article className="prose-clasp mt-6">
        <h2 id="money">Who holds the money</h2>
        <p>
          PayPal does. When a buyer pays, PayPal places an <strong>authorization</strong> on their account: the money is reserved, not sent.
          Clasp captures it only when the release rules are met, and pays the seller through PayPal Payouts. Clasp never sees card numbers,
          bank details or PayPal passwords.
        </p>

        <h2 id="verify">What we verify</h2>
        <ul>
          <li><strong>Possession.</strong> Sellers photograph the item beside a one-time code Clasp generates. A photo copied from elsewhere can&apos;t have it.</li>
          <li><strong>Identity.</strong> Serials and IMEIs are read at listing and again from the item in the buyer&apos;s hands. IMEIs must pass their built-in checksum, so a misread digit doesn&apos;t count.</li>
          <li><strong>Unique marks.</strong> For items without serials, specific scratches, stickers or wear are recorded and must be seen again.</li>
          <li><strong>Locks.</strong> For phones and tablets, the Find My or Find Hub switch must be shown off before payment can be released.</li>
          <li><strong>Price sanity.</strong> Listings get a live market check, so a too-good-to-be-true price is flagged.</li>
        </ul>

        <h2 id="ai">What the AI can&apos;t do</h2>
        <p>The AI reads photos and reports what it sees, with a confidence score. By design it:</p>
        <ul>
          <li>can&apos;t move money: it never calls PayPal;</li>
          <li>isn&apos;t told which serial to expect, so it can&apos;t be steered into a false match;</li>
          <li>never sees prices it could change;</li>
          <li>can&apos;t add a rental charge: only items on the owner&apos;s up-front price list can be charged, and only at high confidence.</li>
        </ul>
        <p>Every capture, charge and release is decided by plain, published, unit-tested rules. See the <Link href="/docs#policy">docs</Link>.</p>

        <h2 id="privacy">Your photos</h2>
        <p>
          Before any photo is saved, Clasp blurs other people&apos;s personal information: phone numbers, contact names, call logs, messages,
          emails and faces. It also strips hidden photo data like location. The unblurred original is never stored.
        </p>
        <p>
          Photos are private by default. Only clean shots of the item appear on your public listing; verification shots, serials and handoff
          scans are visible only to the people in the deal. Full details are in the <Link href="/privacy">privacy policy</Link>.
        </p>

        <h2 id="scams">Scams we stop</h2>
        <table>
          <thead><tr><th>Scam</th><th>How Clasp stops it</th></tr></thead>
          <tbody>
            <tr><td>Fake listing (item doesn&apos;t exist)</td><td>No possession photo with the one-time code, no verified listing.</td></tr>
            <tr><td>Deposit-first or send-first</td><td>Nobody sends anything. PayPal holds, and nothing moves before the handoff.</td></tr>
            <tr><td>Swapped or different device</td><td>The serial in hand doesn&apos;t match. Mismatch, nothing charged.</td></tr>
            <tr><td>Activation-locked phone</td><td>The lock must be shown off before payment can be released.</td></tr>
            <tr><td>&ldquo;Empty box&rdquo; or &ldquo;never received&rdquo; claims</td><td>The handoff record goes to PayPal as dispute evidence.</td></tr>
            <tr><td>Inflated damage claims on rentals</td><td>Only pre-agreed charges, with photo evidence, capped at the deposit.</td></tr>
          </tbody>
        </table>

        <h2 id="safety">Meeting safely</h2>
        <ul>
          <li>Meet in a public, well-lit place. Many police stations offer safe-exchange spots.</li>
          <li>Hold the item yourself and scan it. On a phone, dial <code>*#06#</code> on the device in your hands.</li>
          <li>Never release payment before the deal room says <strong>Matched</strong>.</li>
          <li>Never move the conversation to paying outside Clasp. If someone insists, walk away.</li>
        </ul>

        <h2 id="limits">Honest limits</h2>
        <ul>
          <li>Clasp is a prototype on the PayPal sandbox; no real money moves yet.</li>
          <li>The AI is not a certified inspector. It can misread, which is why low-confidence reads ask for another photo instead of deciding.</li>
          <li>A matching serial proves it&apos;s the listed item, not that every part works. Test the item at the meetup.</li>
          <li>Lock status is read from the device&apos;s own screen; carrier blacklist checks aren&apos;t included yet.</li>
        </ul>
      </article>
      <StillStuck />
    </DocPage>
  );
}
