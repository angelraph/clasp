"use client";

import { useEffect, useRef, useState } from "react";

export type CountFormat = "usd-cents" | "int" | "percent" | "billions";

const FORMATS: Record<CountFormat, (n: number) => string> = {
  "usd-cents": (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n / 100),
  int: (n) => `${Math.round(n)}`,
  percent: (n) => `${Math.round(n)}%`,
  billions: (n) => `$${n.toFixed(1)}B`,
};

/** Counts from 0 to a real value when it first becomes visible. */
export function CountUp({ value, format, duration = 1400 }: { value: number; format: CountFormat; duration?: number }) {
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(value);
      return;
    }
    let raf = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setShown(value * eased);
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);
  return (
    <span ref={ref} style={{ fontVariantNumeric: "tabular-nums" }}>
      {FORMATS[format](shown)}
    </span>
  );
}
