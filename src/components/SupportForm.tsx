"use client";

import { useState } from "react";

const TOPICS: [string, string][] = [
  ["payment", "A payment or hold"],
  ["handoff", "A handoff scan didn't match"],
  ["rental", "A rental deposit or charge"],
  ["dispute", "A PayPal dispute"],
  ["listing", "My listing or verification"],
  ["privacy", "Privacy or a photo"],
  ["other", "Something else"],
];

export function SupportForm() {
  const [topic, setTopic] = useState("payment");
  const [email, setEmail] = useState("");
  const [deal, setDeal] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ ticket: string; linkedDeal: string | null } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, email, deal, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't send your message");
      setDone(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-[10px] border border-matched/25 bg-matched-tint p-6">
        <p className="status text-matched">Received</p>
        <p className="mt-2 text-lg font-medium">Ticket {done.ticket}</p>
        <p className="mt-1 text-sm text-ink-700">
          We&apos;ll reply to {email}.{done.linkedDeal ? ` It's linked to deal ${done.linkedDeal}, so we can see its full timeline.` : ""} Keep the
          ticket number for reference.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-[10px] border border-line bg-card p-5 sm:p-6">
      <div>
        <label className="label" htmlFor="topic">What&apos;s it about?</label>
        <select id="topic" className="field" value={topic} onChange={(e) => setTopic(e.target.value)}>
          {TOPICS.map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="email">Your email</label>
          <input id="email" type="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="deal">Deal link <span className="font-normal text-ink-500">(optional)</span></label>
          <input id="deal" className="field" placeholder="Paste your deal or proof link" value={deal} onChange={(e) => setDeal(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="message">What happened?</label>
        <textarea id="message" required minLength={10} rows={5} className="field" value={message} onChange={(e) => setMessage(e.target.value)} />
        <p className="mt-1 text-xs text-ink-500">Never include passwords or card numbers. We&apos;ll never ask for them.</p>
      </div>
      {error && <p className="text-sm text-oxblood">{error}</p>}
      <button className="btn-primary sm:w-auto sm:px-6" disabled={busy}>{busy ? "Sending…" : "Send to support"}</button>
    </form>
  );
}
