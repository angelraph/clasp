import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/DocPage";
import { SupportForm } from "@/components/SupportForm";

export const metadata: Metadata = {
  title: "Help center · Clasp",
  description: "Step-by-step guides for listing, paying, scanning at the handoff, rentals, notifications and disputes, and a way to reach support.",
};

const GUIDES = [
  { id: "list", label: "List an item" },
  { id: "pay", label: "Pay into a hold" },
  { id: "handoff", label: "At the handoff" },
  { id: "no-match", label: "If it doesn't match" },
  { id: "rentals", label: "Rentals" },
  { id: "notifications", label: "Notifications" },
  { id: "disputes", label: "Disputes" },
  { id: "contact", label: "Contact support" },
];

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="mt-4 space-y-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-4">
          <span className="amount grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line bg-card text-sm">{i + 1}</span>
          <div className="pt-0.5 leading-relaxed text-ink-700">{it}</div>
        </li>
      ))}
    </ol>
  );
}

function Guide({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-line pt-10 first:border-0 first:pt-0">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export default function SupportPage() {
  return (
    <DocPage
      eyebrow="Help center"
      title="How to use Clasp, step by step."
      lead={
        <>
          Short guides for every moment of a deal. Looking for quick answers? Try the <Link href="/faq" className="text-brass-ink underline underline-offset-4">FAQ</Link>.
        </>
      }
      toc={GUIDES}
    >
      <div className="space-y-12">
        <Guide id="list" title="List an item">
          <Steps
            items={[
              <>Tap <strong>Sell or rent</strong>, describe the item, set a price and where you&apos;ll meet. Use the PayPal email you want to be paid at.</>,
              <>Clasp shows a <strong>one-time code</strong>. Write it on paper and photograph it next to the item.</>,
              <>Add close-ups of what makes it unique: a serial number or IMEI (on a phone, dial <code className="serial rounded border border-line bg-card px-1">*#06#</code>), and any scratches or marks.</>,
              <>Tap <strong>Verify with AI</strong>. Personal information in your photos, like phone numbers or names, is blurred automatically before anything is saved.</>,
              <>Share your listing link anywhere you sell: Marketplace, Craigslist, Reddit or WhatsApp.</>,
            ]}
          />
        </Guide>

        <Guide id="pay" title="Pay into a hold">
          <Steps
            items={[
              <>Open the listing and check the verified details, condition notes and the market check.</>,
              <>Tap the PayPal button and approve. PayPal places a <strong>hold</strong> for the price plus buyer protection. Nothing is sent to the seller.</>,
              <>You land in your <strong>deal room</strong>. Keep that link: it&apos;s your key to the deal. Tap <strong>Notify me</strong> to get updates.</>,
            ]}
          />
        </Guide>

        <Guide id="handoff" title="At the handoff">
          <Steps
            items={[
              <>Meet somewhere public. Hold the item yourself.</>,
              <>In the deal room, tap <strong>Check this item</strong> and photograph its serial or IMEI. On a phone, dial <code className="serial rounded border border-line bg-card px-1">*#06#</code> on the device in your hands; don&apos;t rely on a screenshot the seller shows you.</>,
              <>For phones and tablets, also photograph the <strong>Find My</strong> or <strong>Find Hub</strong> screen with the main switch off, so you don&apos;t buy a locked device.</>,
              <>When it says <strong>Matched</strong>, tap <strong>Release</strong>. The seller is paid on the spot, and you both get a proof page.</>,
            ]}
          />
        </Guide>

        <Guide id="no-match" title="If it doesn't match">
          <div className="prose-clasp mt-4">
            <p><strong>Mismatch</strong> means the serial in your hands isn&apos;t the one on the listing. Don&apos;t release. Ask about it, scan again if you think the photo was unclear, or cancel. Cancelling releases the hold and nothing is charged.</p>
            <p><strong>One more photo</strong> means Clasp couldn&apos;t read something clearly, or still needs the lock screen. Take a closer, sharper photo in good light. Earlier matches in the same deal are remembered for an hour.</p>
            <p><strong>Locked</strong> means the anti-theft lock is on. Ask the seller to sign out of the device and turn it off before you pay.</p>
          </div>
        </Guide>

        <Guide id="rentals" title="Rentals">
          <Steps
            items={[
              <>Owners list the item with a deposit and a short price list for missing accessories or specific damage. Renters see it before paying.</>,
              <>At pickup the renter photographs the item and every accessory. That records what they received, and the rental fee is paid.</>,
              <>At return the owner scans it back in. Clasp compares it with the pickup photos and charges only confident findings from the agreed list. The rest of the deposit is released.</>,
            ]}
          />
        </Guide>

        <Guide id="notifications" title="Notifications">
          <div className="prose-clasp mt-4">
            <p>Tap <strong>Notify me</strong> on your listing or deal to get alerts when a buyer pays, an item matches, you&apos;re paid, or your deposit is back.</p>
            <ul>
              <li><strong>Android and desktop:</strong> allow notifications when your browser asks.</li>
              <li><strong>iPhone:</strong> tap Share, then <em>Add to Home Screen</em>, open Clasp from your home screen, then tap Notify me. iOS only allows web notifications for apps added this way.</li>
            </ul>
          </div>
        </Guide>

        <Guide id="disputes" title="Disputes">
          <div className="prose-clasp mt-4">
            <p>Every completed deal has a <strong>handoff record</strong>: the possession photo, the match result, the photos and the full PayPal timeline. Either side can download it from the deal room.</p>
            <p>If a buyer opens a PayPal dispute, Clasp sends that record to PayPal as evidence automatically. Sellers can also tap <strong>Check for disputes and send the record</strong> at any time.</p>
          </div>
        </Guide>

        <section id="contact" className="scroll-mt-20 border-t border-line pt-10">
          <h2 className="text-2xl font-semibold tracking-tight">Contact support</h2>
          <p className="mt-2 text-ink-500">Include your deal link if it&apos;s about a deal. We can then see its timeline, never your PayPal login.</p>
          <div className="mt-6"><SupportForm /></div>
        </section>
      </div>
    </DocPage>
  );
}
