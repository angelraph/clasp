"use client";

import { useEffect, useState } from "react";

type State = "unsupported" | "idle" | "working" | "on" | "denied" | "ios-install";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Turns on phone/desktop notifications for a listing (seller) or a deal (buyer).
 * iPhones only allow web push from an app added to the Home Screen, so we say so.
 */
export function NotifyButton({ subscriptionKey, listingId, dealId, label }: { subscriptionKey: string; listingId?: string; dealId?: string; label: string }) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const storageKey = `clasp:push:${dealId ?? listingId}`;

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState(isIos && !standalone ? "ios-install" : "unsupported");
      return;
    }
    if (Notification.permission === "denied") setState("denied");
    else {
      try {
        if (Notification.permission === "granted" && localStorage.getItem(storageKey)) setState("on");
      } catch {}
    }
  }, [storageKey]);

  async function enable() {
    setError(null);
    setState("working");
    try {
      const { publicKey } = await (await fetch("/api/push")).json();
      if (!publicKey) throw new Error("Notifications aren't configured on this server");
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "idle");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
      const res = await fetch("/api/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: subscriptionKey, listingId, dealId, subscription: sub.toJSON() }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Couldn't turn on notifications");
      try {
        localStorage.setItem(storageKey, "1");
      } catch {}
      setState("on");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("idle");
    }
  }

  if (state === "on") return <p className="text-sm text-ok-600">🔔 Notifications on for this {dealId ? "deal" : "listing"}.</p>;
  if (state === "denied") return <p className="text-sm text-ink-500">Notifications are blocked for this site in your browser settings.</p>;
  if (state === "unsupported") return null;
  if (state === "ios-install")
    return <p className="text-sm text-ink-500">To get alerts on iPhone: tap Share → Add to Home Screen, then open Clasp from there.</p>;
  return (
    <div>
      <button className="btn-secondary" disabled={state === "working"} onClick={enable}>
        {state === "working" ? "Turning on…" : `🔔 ${label}`}
      </button>
      {error && <p className="mt-1 text-sm text-bad-600">{error}</p>}
    </div>
  );
}
