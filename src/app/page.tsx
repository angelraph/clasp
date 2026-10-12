import Link from "next/link";

const steps = [
  {
    title: "Prove you have it",
    body: "Write a one-time code on paper and photograph it with the item. AI reads the code and records what makes this exact item unique: its serial number if it has one, and its marks.",
  },
  {
    title: "PayPal holds the money",
    body: "The buyer approves in PayPal. Funds are authorized, not charged. Nobody carries cash and nobody sends first.",
  },
  {
    title: "Money moves when the thing does",
    body: "At the handoff, the buyer scans the item. If it's the listed item, the seller is paid on the spot. If not, no money moves.",
  },
];

export default function Home() {
  return (
    <div className="space-y-8 pt-6">
      <section>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight">Pay strangers like you trust them.</h1>
        <p className="mt-3 text-lg text-ink-500">
          Buying from someone you met on a marketplace? Renting gear to a stranger? Clasp holds the money with PayPal and
          releases it only when the item checks out.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link href="/new?mode=sale" className="btn-primary">Sell an item</Link>
          <Link href="/new?mode=rental" className="btn-secondary">Rent something out</Link>
        </div>
      </section>

      <section className="space-y-3">
        {steps.map((s, i) => (
          <div key={s.title} className="card flex gap-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-clasp-50 font-semibold text-clasp-600">
              {i + 1}
            </span>
            <div>
              <h2 className="font-semibold">{s.title}</h2>
              <p className="mt-1 text-sm text-ink-500">{s.body}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="card">
        <h2 className="font-semibold">Renting? Same engine, two handoffs.</h2>
        <p className="mt-1 text-sm text-ink-500">
          The fee and a refundable deposit are held together. The fee is paid at pickup. At return, AI compares the item
          to its pickup photos, and only damage priced in advance is ever charged. The rest of the deposit goes back
          automatically.
        </p>
      </section>

      <p className="text-center text-xs text-ink-500">
        Runs on the PayPal sandbox. The AI only reads photos. Plain, published rules decide every payment.
      </p>
    </div>
  );
}
