import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/DocPage";

export const metadata: Metadata = {
  title: "Privacy · Clasp",
  description: "What Clasp collects, why, who it's shared with, and how photos are protected.",
};

const TOC = [
  { id: "summary", label: "Summary" },
  { id: "collect", label: "What we collect" },
  { id: "photos", label: "Photos" },
  { id: "use", label: "How we use it" },
  { id: "share", label: "Who we share with" },
  { id: "keys", label: "Access & links" },
  { id: "retention", label: "Keeping & deleting" },
  { id: "contact", label: "Contact" },
];

export default function PrivacyPage() {
  return (
    <DocPage
      eyebrow="Privacy"
      title="Privacy policy"
      lead="Clasp collects the minimum needed to hold money safely and prove a handoff happened. We don't sell data, run ads, or use trackers."
      toc={TOC}
      updated="October 15, 2026"
    >
      <article className="prose-clasp">
        <h2 id="summary">Summary</h2>
        <ul>
          <li>Payments happen inside PayPal. We never receive card numbers, bank details or PayPal passwords.</li>
          <li>Other people&apos;s personal information in your photos is blurred before anything is stored.</li>
          <li>Photos are private by default; only clean shots of the item can appear publicly.</li>
          <li>There are no accounts or passwords. Access to a listing or deal is by its private link.</li>
          <li>No advertising, no third-party analytics, no data sales.</li>
        </ul>

        <h2 id="collect">What we collect</h2>
        <table>
          <thead><tr><th>Data</th><th>From</th><th>Why</th></tr></thead>
          <tbody>
            <tr><td>Listing details (title, description, price, meeting area)</td><td>Seller</td><td>To show the listing</td></tr>
            <tr><td>Seller name and PayPal email</td><td>Seller</td><td>To pay the seller via PayPal Payouts</td></tr>
            <tr><td>Optional updates email</td><td>Seller</td><td>To send deal notifications</td></tr>
            <tr><td>Buyer&apos;s PayPal email</td><td>PayPal, on approval</td><td>To send the buyer deal updates</td></tr>
            <tr><td>Photos (redacted)</td><td>Seller and buyer</td><td>Verification, handoff checks and dispute evidence</td></tr>
            <tr><td>Deal timeline (PayPal IDs, statuses, times)</td><td>Clasp and PayPal</td><td>To run the deal and build the handoff record</td></tr>
            <tr><td>Notification subscriptions</td><td>Your browser, if you opt in</td><td>To deliver push notifications</td></tr>
            <tr><td>Support messages and email</td><td>You</td><td>To answer you</td></tr>
            <tr><td>A one-way scrambled tag of your IP address</td><td>Your request</td><td>Rate limiting. The raw IP isn&apos;t stored.</td></tr>
          </tbody>
        </table>

        <h2 id="photos">Photos</h2>
        <p>
          Every uploaded photo is analyzed and areas showing other people&apos;s personal information are pixelated before saving: phone
          numbers, contact names, call logs, messages, emails, faces and personal watermarks. Photos are re-encoded, which removes embedded
          metadata such as GPS location. The unredacted original is never stored. If redaction can&apos;t run, the photo isn&apos;t saved.
        </p>
        <p>
          The item&apos;s own serial or IMEI stays readable, because verification depends on it. On public pages only the last four digits are
          ever shown, and photos that contain identifiers are never public.
        </p>

        <h2 id="use">How we use it</h2>
        <p>
          Only to run deals: verifying listings, holding and releasing payments, notifying the parties, defending disputes with the handoff
          record, preventing abuse, and answering support requests.
        </p>

        <h2 id="share">Who we share with</h2>
        <table>
          <thead><tr><th>Service</th><th>What they receive</th><th>Purpose</th></tr></thead>
          <tbody>
            <tr><td>PayPal</td><td>Order amounts, seller PayPal email, and the handoff record if a dispute is opened</td><td>Payments, payouts, disputes</td></tr>
            <tr><td>OpenAI</td><td>Photos, to read them and to find personal information to blur</td><td>Verification and redaction. API data isn&apos;t used for model training by default.</td></tr>
            <tr><td>Channel3</td><td>The product make and model, and one public item photo</td><td>Market price checks</td></tr>
            <tr><td>Neon and Vercel</td><td>Stored data and requests</td><td>Database and hosting</td></tr>
            <tr><td>Your browser&apos;s push service</td><td>Notification text</td><td>Push notifications, if you opt in</td></tr>
            <tr><td>Resend</td><td>Your email and the message</td><td>Email notifications, if enabled</td></tr>
          </tbody>
        </table>
        <p>The other party in a deal sees the deal&apos;s photos, verification results and timeline. Nobody else does.</p>

        <h2 id="keys">Access &amp; links</h2>
        <p>
          Listings and deals are protected by long random links (&ldquo;keys&rdquo;) instead of accounts. Anyone with your seller or deal link
          can act on it, so treat it like a password and share only the public listing link. Proof pages show no keys, emails or full serials.
        </p>

        <h2 id="retention">Keeping &amp; deleting</h2>
        <p>
          Deal records are kept so they can serve as evidence if a dispute is opened later. To have a listing, its photos or your support
          messages deleted, <Link href="/support#contact">contact support</Link> with the link, and we&apos;ll remove them unless a payment
          dispute on that deal is still open.
        </p>

        <h2 id="contact">Contact</h2>
        <p>Questions or requests: use the <Link href="/support#contact">support form</Link> and choose &ldquo;Privacy or a photo&rdquo;.</p>
        <p className="text-sm text-ink-500">Clasp is a prototype built for the PayPal AI Hackathon and runs on the PayPal sandbox.</p>
      </article>
    </DocPage>
  );
}
