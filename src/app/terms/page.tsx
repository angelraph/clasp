import type { Metadata } from "next";
import Link from "next/link";
import { DocPage } from "@/components/DocPage";

export const metadata: Metadata = {
  title: "Terms · Clasp",
  description: "The terms for using Clasp, a prototype running on the PayPal sandbox.",
};

const TOC = [
  { id: "prototype", label: "A prototype" },
  { id: "what", label: "What Clasp does" },
  { id: "paypal", label: "PayPal" },
  { id: "fees", label: "Fees" },
  { id: "rules", label: "Your responsibilities" },
  { id: "prohibited", label: "Not allowed" },
  { id: "ai", label: "AI and verification" },
  { id: "liability", label: "Liability" },
  { id: "changes", label: "Changes & contact" },
];

export default function TermsPage() {
  return (
    <DocPage eyebrow="Terms" title="Terms of use" lead="Plain-language terms for using Clasp." toc={TOC} updated="October 15, 2026">
      <article className="prose-clasp">
        <h2 id="prototype">A prototype</h2>
        <p>
          Clasp is a prototype built for the PayPal AI Hackathon. It runs on the <strong>PayPal sandbox</strong>, PayPal&apos;s test
          environment: payments use test accounts and <strong>no real money moves</strong>. Don&apos;t rely on Clasp for real transactions yet.
        </p>

        <h2 id="what">What Clasp does</h2>
        <p>
          Clasp coordinates a deal between two people: it verifies a listing from photos, asks PayPal to hold the buyer&apos;s payment, checks
          the item at the handoff, and releases or cancels the payment by published rules. Clasp is not a bank, an escrow agent or a party to
          the sale. The seller sells, the buyer buys, and PayPal processes the payment.
        </p>

        <h2 id="paypal">PayPal</h2>
        <p>
          Payments are subject to PayPal&apos;s own terms and policies, including its buyer protection and dispute processes. Clasp is not
          affiliated with or endorsed by PayPal, Inc. A PayPal authorization can be honored for up to 3 days and renewed up to 29; an unused
          hold expires on its own.
        </p>

        <h2 id="fees">Fees</h2>
        <p>
          Listing is free and sellers receive their full asking price. Buyers pay a buyer protection fee (5%, minimum $1), shown before they
          approve and charged only when the deal completes. Rental deposits are released apart from charges on the owner&apos;s up-front price
          list.
        </p>

        <h2 id="rules">Your responsibilities</h2>
        <ul>
          <li>Only list items you own and have in your possession, described honestly.</li>
          <li>Use your own PayPal account and give accurate details.</li>
          <li>Keep your seller and deal links private; anyone with them can act on that listing or deal.</li>
          <li>Meet safely, and check the item before releasing payment.</li>
          <li>Follow the law where you live, including on what can be sold or rented.</li>
        </ul>

        <h2 id="prohibited">Not allowed</h2>
        <ul>
          <li>Stolen, counterfeit or illegal goods, weapons, drugs, and anything PayPal&apos;s acceptable use policy forbids.</li>
          <li>Photos you don&apos;t have the right to use, or photos of people without their permission.</li>
          <li>Trying to trick verification, e.g. showing a different device&apos;s screen.</li>
          <li>Automated abuse, scraping, or attempts to bypass rate limits or access other people&apos;s deals.</li>
        </ul>

        <h2 id="ai">AI and verification</h2>
        <p>
          Clasp uses AI to read photos. Readings can be wrong. Verification shows that an item matches what was listed; it is not a guarantee
          of condition, authenticity or function. Low-confidence readings ask for another photo instead of deciding, and AI findings can never
          add rental charges outside the agreed list.
        </p>

        <h2 id="liability">Liability</h2>
        <p>
          Clasp is provided &ldquo;as is&rdquo; while it&apos;s a prototype, without warranties. To the extent the law allows, we&apos;re not
          liable for losses arising from deals between users, items that don&apos;t meet expectations, or service interruptions. Nothing here
          limits rights you have under consumer law or PayPal&apos;s own protections.
        </p>

        <h2 id="changes">Changes &amp; contact</h2>
        <p>
          We may update these terms as Clasp develops and will change the date above when we do. Questions? <Link href="/support#contact">Contact support</Link>.
        </p>
      </article>
    </DocPage>
  );
}
