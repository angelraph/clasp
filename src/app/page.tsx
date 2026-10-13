import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { loadStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

const steps = [
  {
    title: "Prove you have it",
    body: "The seller writes a one-time code on paper and photographs it with the item. AI reads the code and records what makes this exact item unique: its serial number or IMEI, or its marks.",
  },
  {
    title: "PayPal holds the money",
    body: "The buyer approves in PayPal. The money is authorized, not charged. Nobody carries cash, nobody sends first.",
  },
  {
    title: "Money moves when the thing does",
    body: "At the meetup the buyer scans the item. If it's the listed item, the seller is paid on the spot. If it isn't, nothing is charged.",
  },
];

const sides = [
  { who: "Buyers", line: "Never pay for a fake listing, a swapped device or a locked phone. Your money only moves once the item in your hands checks out." },
  { who: "Sellers", line: "Get paid at the handoff, not \"after the check clears\". If a buyer later claims you sent the wrong thing, Clasp sends PayPal your proof." },
  { who: "Renters & owners", line: "Deposits come back automatically. Only damage from a price list both sides saw up front can ever be charged." },
];

export default async function Home() {
  const stats = await loadStats().catch(() => null);

  return (
    <div className="space-y-10 pt-6">
      <section>
        <p className="text-sm font-medium text-clasp-600">For marketplace deals, local meetups and rentals</p>
        <h1 className="mt-2 text-4xl font-semibold leading-tight tracking-tight">Pay strangers like you trust them.</h1>
        <p className="mt-3 text-lg text-ink-500">
          Clasp holds the money with PayPal and releases it only when the item checks out, verified by AI at the handoff.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link href="/new?mode=sale" className="btn-primary">Sell an item</Link>
          <Link href="/new?mode=rental" className="btn-secondary">Rent something out</Link>
        </div>
        <Link href="/browse" className="mt-3 block text-center text-sm font-medium text-clasp-600">
          Or browse verified listings →
        </Link>
      </section>

      <section className="card bg-ink-900 text-white">
        <h2 className="text-lg font-semibold">Buying from strangers is broken</h2>
        <ul className="mt-3 space-y-3 text-sm text-ink-300">
          <li>
            <strong className="text-white">34%</strong> of Facebook Marketplace listings a UK bank&apos;s fraud team contacted were fraudulent (TSB, 2023).
          </li>
          <li>
            <strong className="text-white">$12.5B</strong> reported lost to fraud in the US in 2024. Online shopping was the second most reported category (FTC).
          </li>
          <li>Cash and instant transfers protect nobody: sellers fear &quot;empty box&quot; claims, buyers fear swapped or locked devices.</li>
        </ul>
        <p className="mt-4 text-sm text-white">
          Escrow apps exist, but someone still taps &quot;received&quot; on trust. Clasp releases payment when the item is <em>proven</em>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">How it works</h2>
        {steps.map((s, i) => (
          <div key={s.title} className="card flex gap-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-clasp-50 font-semibold text-clasp-600">{i + 1}</span>
            <div>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-ink-500">{s.body}</p>
            </div>
          </div>
        ))}
        <div className="card">
          <h3 className="font-semibold">Renting? Same engine, two handoffs.</h3>
          <p className="mt-1 text-sm text-ink-500">
            Fee and deposit are held together. The fee is paid at pickup. At return, AI compares the item with its pickup photos, and only damage priced
            in advance is ever charged. The rest goes back automatically.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Who it protects</h2>
        <div className="grid gap-3">
          {sides.map((s) => (
            <div key={s.who} className="card">
              <h3 className="font-semibold">{s.who}</h3>
              <p className="mt-1 text-sm text-ink-500">{s.line}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold">The AI reads. Plain rules decide.</h2>
        <p className="mt-1 text-sm text-ink-500">
          The vision model only reports what it sees, with a confidence. It is never told which serial number to expect, never sees a price it could
          change, and never calls PayPal. Published, tested rules decide every capture, charge and release.
        </p>
      </section>

      {stats && stats.protectedDeals > 0 && (
        <section className="grid grid-cols-3 gap-2 text-center">
          <div className="card px-2 py-4">
            <p className="text-2xl font-semibold">{stats.protectedDeals}</p>
            <p className="text-xs text-ink-500">deals protected</p>
          </div>
          <div className="card px-2 py-4">
            <p className="text-2xl font-semibold">{formatMoney(stats.heldCents).replace(/\.00$/, "")}</p>
            <p className="text-xs text-ink-500">held until verified</p>
          </div>
          <div className="card px-2 py-4">
            <p className="text-2xl font-semibold">{stats.wrongItemsStopped}</p>
            <p className="text-xs text-ink-500">wrong items stopped</p>
          </div>
        </section>
      )}

      <section className="card">
        <h2 className="font-semibold">Built for AI shopping agents too</h2>
        <p className="mt-1 text-sm text-ink-500">
          Agents can find verified listings and start a protected purchase through Clasp&apos;s MCP server, but they can never move money. The human approves
          in PayPal, and the item releases the payment.
        </p>
        <Link href="/agents" className="mt-3 inline-block text-sm font-medium text-clasp-600">Connect an agent →</Link>
      </section>

      <p className="text-center text-xs text-ink-500">Runs on the PayPal sandbox. No real money moves.</p>
    </div>
  );
}
