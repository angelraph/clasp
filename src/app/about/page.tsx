import type { Metadata } from "next";
import Link from "next/link";
import { Mark } from "@/components/Logo";
import { Reveal } from "@/components/landing/Reveal";

export const metadata: Metadata = {
  title: "About · Clasp",
  description: "Why Clasp exists: making a deal with a stranger as safe as one with a friend, with PayPal and AI.",
};

const PRINCIPLES = [
  ["Proof over promises", "Money moves when the item proves itself, not when someone taps \"received\"."],
  ["The AI reads. Rules decide.", "Models are great readers and poor judges of money. Every payment decision is plain, published, tested code."],
  ["Privacy by default", "Other people's details are blurred before anything is saved. Photos are private unless they're safe to show."],
  ["Honest about limits", "We say what Clasp can't check yet, and low-confidence reads ask for another photo instead of guessing."],
];

const NEXT = [
  ["Shipped deals", "Extend the handoff check to parcels: the buyer scans on delivery, with PayPal tracking attached to the capture."],
  ["Partner payouts", "PayPal platform features for instant seller disbursement and fees, without Clasp ever holding funds."],
  ["Deeper device checks", "Carrier blacklist and IMEI database lookups alongside the on-screen lock check."],
  ["Rental businesses", "Camera, tool and bike rental shops running every deposit through Clasp, with damage priced up front."],
  ["The Clasp badge", "A verified-listing badge sellers can embed on any marketplace, so protection travels with the item."],
  ["Agent-native commerce", "Shopping agents that find verified items and hand people a PayPal approval, never the other way round."],
];

export default function AboutPage() {
  return (
    <div>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:pt-20">
        <Mark size={44} />
        <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-[-0.035em] sm:text-6xl">
          Make a deal with a stranger as safe as one with a friend.
        </h1>
        <p className="mt-6 max-w-2xl text-xl leading-snug text-ink-500">
          Billions of dollars of second-hand goods change hands between strangers every year, still mostly on cash, screenshots and hope.
          Clasp gives that moment the one thing it&apos;s missing: <span className="text-ink-900">proof before payment.</span>
        </p>
      </section>

      <section className="bg-ink-900 text-paper">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2">
          <Reveal>
            <p className="status text-[#D9B98F]">Why now</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">The trust gap is widening.</h2>
          </Reveal>
          <Reveal delay={100} className="space-y-4 text-paper/75">
            <p>Marketplaces grew to billions of users without a safe way to pay at a meetup. Scammers adapted faster than the tools: fake listings, swapped devices, locked phones, &ldquo;empty box&rdquo; claims.</p>
            <p>At the same time, AI can finally read the physical world from a phone camera, and shopping agents are starting to buy on our behalf. Both need the same thing: a payment that moves only when the real item does.</p>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-[-0.03em]">What we believe</h2>
        </Reveal>
        <div className="mt-8 grid gap-px overflow-hidden rounded-[10px] border border-line bg-line sm:grid-cols-2">
          {PRINCIPLES.map(([t, b], i) => (
            <Reveal key={t} delay={i * 80} className="bg-card p-6">
              <p className="font-serif text-xl">{t}</p>
              <p className="mt-2 text-sm text-ink-500">{b}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-y border-line bg-card/60">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <Reveal>
            <p className="status text-brass-ink">Where Clasp goes next</p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.03em]">One engine for every handoff between strangers.</h2>
          </Reveal>
          <ol className="mt-10 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {NEXT.map(([t, b], i) => (
              <Reveal as="li" key={t} delay={(i % 3) * 80}>
                <p className="amount text-brass">{String(i + 1).padStart(2, "0")}</p>
                <p className="mt-1 font-medium">{t}</p>
                <p className="mt-1 text-sm text-ink-500">{b}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="grid gap-8 md:grid-cols-[1fr_1.4fr]">
          <h2 className="text-3xl font-semibold tracking-[-0.03em]">Built for the PayPal AI Hackathon.</h2>
          <div className="space-y-4 text-ink-700">
            <p>
              Clasp is built by Uzoechi Raphael on PayPal&apos;s developer platform: holds, captures, payouts, webhooks and disputes, with AI that
              reads the physical world and plain rules that decide every payment.
            </p>
            <p>
              It&apos;s open source. Read <Link href="/docs" className="text-brass-ink underline underline-offset-4">how it works</Link>, browse the{" "}
              <a href="https://github.com/angelraph/clasp" className="text-brass-ink underline underline-offset-4">code</a>, or{" "}
              <Link href="/new" className="text-brass-ink underline underline-offset-4">try a deal</Link>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
