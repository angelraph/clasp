"use client";

import Link from "next/link";
import { useState } from "react";
import { PhotoPicker } from "@/components/PhotoPicker";
import { formatMoney, parseDollarsToCents } from "@/lib/money";

type Mode = "sale" | "rental";
type Row = { label: string; price: string };
type Created = { id: string; sellerKey: string; possessionCode: string };
type Verdict = { verified: boolean; reasons: string[]; identifiers: { kind: string; value: string }[] };

function RowsEditor({ rows, onChange, placeholder }: { rows: Row[]; onChange: (r: Row[]) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="flex gap-2">
          <input
            className="field"
            placeholder={placeholder}
            value={row.label}
            onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))}
          />
          <input
            className="field w-28"
            inputMode="decimal"
            placeholder="$0"
            value={row.price}
            onChange={(e) => onChange(rows.map((r, j) => (j === i ? { ...r, price: e.target.value } : r)))}
          />
          <button type="button" className="px-2 text-ink-500" onClick={() => onChange(rows.filter((_, j) => j !== i))} aria-label="Remove">
            ×
          </button>
        </div>
      ))}
      <button type="button" className="text-sm font-medium text-clasp-600" onClick={() => onChange([...rows, { label: "", price: "" }])}>
        + Add
      </button>
    </div>
  );
}

export function NewListing({ initialMode }: { initialMode: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const [sellerName, setSellerName] = useState("");
  const [email, setEmail] = useState("");
  const [notifyEmail, setNotifyEmail] = useState("");
  const [accessories, setAccessories] = useState<Row[]>([{ label: "Charger", price: "" }]);
  const [damage, setDamage] = useState<Row[]>([{ label: "Scratched lens or screen", price: "" }]);

  const [created, setCreated] = useState<Created | null>(null);
  const [photos, setPhotos] = useState<File[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = (r: Row[]) =>
    r.filter((x) => x.label.trim()).map((x) => ({ label: x.label.trim(), name: x.label.trim(), priceCents: parseDollarsToCents(x.price) }));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          title,
          description,
          priceCents: parseDollarsToCents(price),
          depositCents: mode === "rental" ? parseDollarsToCents(deposit) : 0,
          sellerName,
          sellerPaypalEmail: email,
          notifyEmail,
          accessories: mode === "rental" ? rows(accessories).map(({ name, priceCents }) => ({ name, priceCents })) : [],
          damageRules: mode === "rental" ? rows(damage).map(({ label, priceCents }) => ({ label, priceCents })) : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      try {
        localStorage.setItem(`clasp:listing:${data.id}`, data.sellerKey);
      } catch {}
      setCreated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    if (!created) return;
    setError(null);
    setBusy(true);
    try {
      const form = new FormData();
      form.set("key", created.sellerKey);
      photos.forEach((p) => form.append("photos", p));
      const res = await fetch(`/api/listings/${created.id}/verify`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setVerdict(data.verdict);
      if (!data.verdict.verified) setPhotos([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (created && verdict?.verified) {
    const link = `${window.location.origin}/l/${created.id}`;
    return (
      <div className="space-y-4 pt-4">
        <div className="card border-ok-600/30 bg-ok-50">
          <p className="text-sm font-medium text-ok-600">Possession verified</p>
          <h1 className="mt-1 text-2xl font-semibold">Your Clasp link is live</h1>
          <p className="mt-2 text-sm text-ink-700">
            Paste it into your Marketplace, Craigslist, or Reddit listing. Buyers can see the item was verified in your
            hands, and pay into a PayPal hold.
          </p>
          <div className="mt-4 break-all rounded-xl bg-white p-3 font-mono text-sm ring-1 ring-ink-200">{link}</div>
          <button className="btn-primary mt-3" onClick={() => navigator.clipboard.writeText(link)}>Copy link</button>
        </div>
        <Link href={`/l/${created.id}?k=${created.sellerKey}`} className="btn-secondary">Open my seller view</Link>
        <p className="text-center text-xs text-ink-500">Keep your seller view link private. It lets you manage this listing.</p>
      </div>
    );
  }

  if (created) {
    return (
      <div className="space-y-4 pt-4">
        <div className="card text-center">
          <p className="text-sm text-ink-500">Write this code on paper</p>
          <p className="my-3 font-mono text-6xl font-bold tracking-[0.3em]">{created.possessionCode}</p>
          <p className="text-sm text-ink-700">
            Photograph it <strong>next to the item</strong>. Then add close-ups of anything that makes this exact item
            unique: a serial number or label if it has one, and any scratches, stickers or wear.
            {mode === "rental" && " Include every accessory."}
          </p>
        </div>

        {verdict && !verdict.verified && (
          <div className="card border-bad-600/30 bg-bad-50 text-sm text-bad-600">
            <p className="font-medium">Not verified yet</p>
            <ul className="mt-1 list-disc pl-5">{verdict.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        )}

        <div className="card">
          <PhotoPicker files={photos} onChange={setPhotos} hint="2–4 photos work best. Good light, no glare." />
        </div>
        {error && <p className="text-sm text-bad-600">{error}</p>}
        <button className="btn-primary" disabled={busy || photos.length === 0} onClick={verify}>
          {busy ? "Checking photos…" : "Verify with AI"}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={create} className="space-y-4 pt-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1">
        {(["sale", "rental"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg py-2 text-sm font-medium ${mode === m ? "bg-white shadow-sm" : "text-ink-500"}`}
          >
            {m === "sale" ? "Sell" : "Rent out"}
          </button>
        ))}
      </div>

      <div className="card space-y-4">
        <div>
          <label className="label" htmlFor="title">What is it?</label>
          <input id="title" className="field" required minLength={3} placeholder="What you're selling or renting" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="desc">Details</label>
          <textarea id="desc" className="field" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="price">{mode === "sale" ? "Price" : "Rental fee"}</label>
            <input id="price" className="field" required inputMode="decimal" placeholder="$450" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          {mode === "rental" && (
            <div>
              <label className="label" htmlFor="deposit">Deposit</label>
              <input id="deposit" className="field" required inputMode="decimal" placeholder="$300" value={deposit} onChange={(e) => setDeposit(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      {mode === "rental" && (
        <div className="card space-y-4">
          <div>
            <p className="label">Accessories and replacement prices</p>
            <RowsEditor rows={accessories} onChange={setAccessories} placeholder="Charger" />
          </div>
          <div>
            <p className="label">Agreed damage prices</p>
            <p className="mb-2 text-xs text-ink-500">
              Only these can ever be charged from the deposit. The AI can flag other damage, but can&apos;t charge for it.
            </p>
            <RowsEditor rows={damage} onChange={setDamage} placeholder="Cracked screen" />
          </div>
        </div>
      )}

      <div className="card space-y-4">
        <div>
          <label className="label" htmlFor="name">Your name</label>
          <input id="name" className="field" required value={sellerName} onChange={(e) => setSellerName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="email">PayPal email to get paid</label>
          <input id="email" className="field" type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="notify">Email for updates <span className="font-normal text-ink-500">(optional)</span></label>
          <input id="notify" className="field" type="email" placeholder="Where to tell you a buyer paid" value={notifyEmail} onChange={(e) => setNotifyEmail(e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-bad-600">{error}</p>}
      <button className="btn-primary" disabled={busy}>
        {busy ? "Creating…" : `Continue${price ? ` · ${(() => { try { return formatMoney(parseDollarsToCents(price)); } catch { return ""; } })()}` : ""}`}
      </button>
    </form>
  );
}
