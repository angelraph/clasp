"use client";

import { useEffect, useRef } from "react";

/**
 * A slowly flowing band of fine brass lines, like a latch spring. Stripe's ribbon,
 * drawn with hairlines instead of gradients. Static when reduced motion is on.
 */
export function Ribbon({ lines = 28, className = "" }: { lines?: number; className?: string }) {
  const group = useRef<SVGGElement>(null);

  useEffect(() => {
    const g = group.current;
    if (!g) return;
    const paths = Array.from(g.querySelectorAll("path"));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const draw = (time: number) => {
      const t = time / 1000;
      paths.forEach((p, i) => {
        const k = i / paths.length;
        const pts: string[] = [];
        for (let x = -50; x <= 1250; x += 50) {
          const y =
            300 +
            Math.sin(x / 260 + t * 0.35 + k * 2.2) * (120 - k * 40) +
            Math.sin(x / 140 - t * 0.22 + k * 5) * 26 +
            (k - 0.5) * 180;
          pts.push(`${x},${y.toFixed(1)}`);
        }
        p.setAttribute("d", `M${pts.join(" L")}`);
      });
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <svg className={className} viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <g ref={group} fill="none" strokeLinecap="round">
        {Array.from({ length: lines }, (_, i) => (
          <path key={i} stroke="#A67C52" strokeOpacity={0.12 + (i / lines) * 0.4} strokeWidth={i % 7 === 0 ? 1.4 : 0.8} />
        ))}
      </g>
    </svg>
  );
}
