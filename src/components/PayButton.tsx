"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    paypal?: any;
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace React.JSX {
    interface IntrinsicElements {
      "paypal-button": React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { type?: string };
    }
  }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load PayPal"));
    document.head.appendChild(s);
  });
}

/**
 * PayPal JS SDK v6, following PayPal's v6 sample: create the order promise inside the
 * click handler without awaiting it, so the popup keeps the user's click activation.
 */
export function PayButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const button = useRef<HTMLElement>(null);
  const deal = useRef<{ dealId: string; buyerKey: string } | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};

    async function createOrder() {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't start payment");
      deal.current = { dealId: data.dealId, buyerKey: data.buyerKey };
      try {
        localStorage.setItem(`clasp:deal:${data.dealId}`, data.buyerKey);
      } catch {}
      return { orderId: data.orderId };
    }

    async function init() {
      const cfg = await (await fetch("/api/config")).json();
      if (cfg.error) throw new Error(cfg.error);
      await loadScript(cfg.sdkUrl);
      const sdk = await window.paypal.createInstance({
        clientId: cfg.clientId,
        components: ["paypal-payments"],
        pageType: "checkout",
      });
      const session = sdk.createPayPalOneTimePaymentSession({
        async onApprove(data: { orderId: string }) {
          const d = deal.current!;
          setStatus("Placing the hold…");
          const res = await fetch(`/api/deals/${d.dealId}/authorize`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: d.buyerKey, orderId: data.orderId }),
          });
          const body = await res.json();
          if (!res.ok) {
            setStatus(null);
            setError(body.error ?? "Couldn't place the hold");
            return;
          }
          router.push(`/d/${d.dealId}?k=${d.buyerKey}`);
        },
        onCancel() {
          setStatus(null);
        },
        onError(err: Error) {
          setStatus(null);
          setError(err.message);
        },
      });
      if (cancelled) return;
      const el = button.current!;
      const onClick = async () => {
        setError(null);
        try {
          const orderPromise = createOrder();
          await session.start({ presentationMode: "auto" }, orderPromise);
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
      };
      el.addEventListener("click", onClick);
      cleanup = () => el.removeEventListener("click", onClick);
      setReady(true);
    }

    init().catch((err) => setError(err instanceof Error ? err.message : String(err)));
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [listingId, router]);

  return (
    <div>
      <paypal-button ref={button} type="pay" hidden={!ready || !!status} />
      {!ready && !error && <p className="text-center text-sm text-ink-500">Loading PayPal…</p>}
      {status && <p className="text-center text-sm text-ink-700">{status}</p>}
      {error && <p className="mt-2 text-sm text-bad-600">{error}</p>}
    </div>
  );
}
