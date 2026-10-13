import Link from "next/link";
import { AgentCard, DepositCard, HoldCard, PossessionCard, RecordCard, SwitchCard } from "@/components/landing/Bento";
import { CountUp } from "@/components/landing/CountUp";
import { FlowPhone } from "@/components/landing/FlowPhone";
import { Reveal } from "@/components/landing/Reveal";
import { Ribbon } from "@/components/landing/Ribbon";
import { FAQ } from "@/lib/faq";
import { loadStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function Home() {
  const stats = await loadStats().catch(() => null);
  const faqPreview = FAQ.flatMap((g) => g.items).filter((f) =>
    ["What is Clasp?", "When am I actually charged?", "Can the AI take my money?", "What does it cost?"].includes(f.q),
  );

  return (
    <div className="overflow-x-clip">
      {/* ------------------------------------------------------------ hero */}
      <section className="relative">
        <Ribbon className="pointer-events-none absolute -right-40 -top-20 h-[720px] w-[1200px] max-w-none opacity-90 [mask-image:linear-gradient(to_left,black_40%,transparent)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-20 pt-14 lg:grid-cols-[1.15fr_1fr] lg:pt-20">
          <div>
            {stats && stats.heldCents > 0 && (
              <p className="animate-[rise_0.7s_both] text-sm text-ink-500">
                Held safely until verified, so far:{" "}
                <span className="amount text-base text-ink-900">
                  <CountUp value={stats.heldCents} format="usd-cents" />
                </span>{" "}
                <span className="text-ink-500">across {stats.protectedDeals} deal{stats.protectedDeals === 1 ? "" : "s"}</span>
              </p>
            )}
            <h1 className="mt-5 animate-[rise_0.7s_0.08s_both] text-[44px] font-semibold leading-[1.03] tracking-[-0.035em] sm:text-6xl">
              Pay strangers
              <br />
              like you trust them.
            </h1>
            <p className="mt-6 max-w-xl animate-[rise_0.7s_0.16s_both] text-xl leading-snug text-ink-500 sm:text-2xl">
              <span className="text-ink-900">PayPal holds the money.</span> AI checks the item in the buyer&apos;s hands. The seller is paid the
              moment it&apos;s the real thing, and never if it isn&apos;t.
            </p>
            <div className="mt-8 flex animate-[rise_0.7s_0.24s_both] flex-wrap gap-3">
              <Link href="/new?mode=sale" className="rounded-[10px] bg-ink-900 px-5 py-3 font-medium text-paper hover:bg-ink-700">
                Sell an item <span aria-hidden>→</span>
              </Link>
              <Link href="/new?mode=rental" className="rounded-[10px] border border-line bg-card px-5 py-3 font-medium hover:bg-ink-100">
                Rent something out
              </Link>
            </div>
            <p className="mt-5 animate-[rise_0.7s_0.32s_both] text-sm text-ink-500">
              For Marketplace, Craigslist and Reddit deals, local meetups and gear rentals. <Link href="/browse" className="text-brass-ink underline-offset-4 hover:underline">Browse verified listings</Link>
            </p>
          </div>
          <div className="animate-[rise_0.9s_0.2s_both]">
            <FlowPhone />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ problem band */}
      <section className="bg-ink-900 text-paper">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <Reveal>
            <p className="status text-[#D9B98F]">The problem</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
              Buying from a stranger still runs on cash, hope and screenshots.
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-8 sm:grid-cols-3">
            <Reveal delay={0}>
              <p className="amount text-6xl text-paper"><CountUp value={34} format="percent" /></p>
              <p className="mt-3 text-sm text-paper/65">of Facebook Marketplace listings a UK bank&apos;s fraud team contacted turned out to be fraudulent. <span className="text-paper/40">TSB, 2023</span></p>
            </Reveal>
            <Reveal delay={120}>
              <p className="amount text-6xl text-paper"><CountUp value={12.5} format="billions" /></p>
              <p className="mt-3 text-sm text-paper/65">reported lost to fraud in the US in 2024. Online shopping was the second most reported category. <span className="text-paper/40">FTC</span></p>
            </Reveal>
            <Reveal delay={240}>
              <p className="amount text-6xl text-paper">0</p>
              <p className="mt-3 text-sm text-paper/65">protection for either side with cash or instant transfers. Sellers fear &ldquo;empty box&rdquo; claims; buyers fear swapped or locked devices.</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ how it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24">
        <Reveal>
          <p className="status text-brass-ink">How it works</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Money moves when the thing does.
            <span className="text-ink-500"> Not before, and not on anyone&apos;s word.</span>
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-6">
          <Reveal className="md:col-span-3"><PossessionCard /></Reveal>
          <Reveal className="md:col-span-3" delay={100}><HoldCard /></Reveal>
          <Reveal className="md:col-span-4" delay={0}><SwitchCard /></Reveal>
          <Reveal className="md:col-span-2" delay={100}>
            <div className="flex h-full flex-col justify-between rounded-[10px] border border-line bg-card p-6">
              <div>
                <p className="status text-brass-ink">The rule</p>
                <p className="mt-3 font-serif text-2xl leading-snug">The AI reads. Plain rules decide.</p>
              </div>
              <p className="mt-6 text-sm text-ink-500">
                The model transcribes serials and marks with a confidence. It never calls PayPal, never sees a price, and is never told what to
                expect. Tested code decides every capture.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ rentals, disputes, agents */}
      <section className="border-y border-line bg-card/60">
        <div className="mx-auto max-w-6xl px-4 py-24">
          <Reveal>
            <p className="status text-brass-ink">Beyond the handoff</p>
            <h2 className="mt-3 max-w-3xl text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
              One engine for every handoff.
              <span className="text-ink-500"> Sales, rentals, disputes, and the agents that shop for us.</span>
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <Reveal><DepositCard /></Reveal>
            <Reveal delay={100}><RecordCard /></Reveal>
            <Reveal delay={200}><AgentCard /></Reveal>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ who it protects */}
      <section className="mx-auto max-w-6xl px-4 py-24">
        <Reveal>
          <h2 className="max-w-3xl text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            Built for both sides of the meetup.
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-px overflow-hidden rounded-[10px] border border-line bg-line md:grid-cols-3">
          {[
            ["Buyers", "Never pay for a fake listing, a swapped device or a locked phone. You're charged only after the item in your hands checks out."],
            ["Sellers", "Paid at the handoff, in full, not \"after it clears\". If a buyer later claims you sent the wrong thing, your proof is already filed."],
            ["Renters & owners", "Deposits come back on their own. Only damage from a price list both sides saw up front can ever be charged."],
          ].map(([who, line], i) => (
            <Reveal key={who} delay={i * 100} className="bg-card p-7">
              <p className="status text-ink-500">{who}</p>
              <p className="mt-3 text-lg leading-snug">{line}</p>
            </Reveal>
          ))}
        </div>

        {stats && stats.protectedDeals > 0 && (
          <Reveal className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-[10px] border border-line bg-line text-center">
            <div className="bg-card p-6"><p className="amount text-4xl"><CountUp value={stats.protectedDeals} format="int" /></p><p className="status mt-2 text-ink-500">Deals protected</p></div>
            <div className="bg-card p-6"><p className="amount text-4xl"><CountUp value={stats.heldCents} format="usd-cents" /></p><p className="status mt-2 text-ink-500">Held until verified</p></div>
            <div className="bg-card p-6"><p className="amount text-4xl"><CountUp value={stats.wrongItemsStopped} format="int" /></p><p className="status mt-2 text-ink-500">Wrong items stopped</p></div>
          </Reveal>
        )}
      </section>

      {/* ------------------------------------------------------------ FAQ preview */}
      <section className="mx-auto max-w-6xl px-4 pb-24">
        <div className="grid gap-10 md:grid-cols-[1fr_1.6fr]">
          <Reveal>
            <h2 className="text-3xl font-semibold tracking-[-0.03em]">Questions, answered plainly.</h2>
            <Link href="/faq" className="mt-4 inline-block text-brass-ink underline-offset-4 hover:underline">All questions →</Link>
          </Reveal>
          <Reveal delay={100} className="divide-y divide-line border-y border-line">
            {faqPreview.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium">
                  {f.q}
                  <span className="text-ink-500 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-ink-500">{f.a}</p>
              </details>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ closing CTA */}
      <section className="relative mx-4 overflow-hidden rounded-[10px] bg-ink-900 text-paper sm:mx-auto sm:max-w-6xl">
        <Ribbon lines={20} className="pointer-events-none absolute inset-0 h-full w-full opacity-60" />
        <div className="relative px-6 py-16 text-center sm:py-20">
          <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">Your next deal with a stranger, clasped.</h2>
          <p className="mx-auto mt-4 max-w-lg text-paper/70">List in two minutes. Free for sellers. The buyer pays into a PayPal hold that only the real item can release.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/new?mode=sale" className="rounded-[10px] bg-paper px-5 py-3 font-medium text-ink-900 hover:bg-card">Sell an item</Link>
            <Link href="/new?mode=rental" className="rounded-[10px] border border-paper/30 px-5 py-3 font-medium hover:bg-paper/10">Rent something out</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
