"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders a server page on an interval while it's visible, so status changes show up live. */
export function AutoRefresh({ everyMs = 5000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everyMs);
    return () => clearInterval(t);
  }, [router, everyMs]);
  return null;
}
