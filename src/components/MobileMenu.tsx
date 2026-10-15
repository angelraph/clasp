"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const LINKS: [string, string][] = [
  ["Browse listings", "/browse"],
  ["Sell an item", "/new?mode=sale"],
  ["Rent something out", "/new?mode=rental"],
  ["Help center", "/support"],
  ["FAQ", "/faq"],
  ["Trust & safety", "/trust"],
  ["For AI agents", "/agents"],
  ["Docs", "/docs"],
  ["About", "/about"],
];

/** Phone-width navigation: a full-width sheet under the header. */
export function MobileMenu() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="sm:hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        className="grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-card"
      >
        <span className="relative block h-3 w-4">
          <span className={`absolute left-0 h-px w-4 bg-ink-900 transition-all ${open ? "top-1.5 rotate-45" : "top-0"}`} />
          <span className={`absolute left-0 top-1.5 h-px w-4 bg-ink-900 transition-opacity ${open ? "opacity-0" : ""}`} />
          <span className={`absolute left-0 h-px w-4 bg-ink-900 transition-all ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
        </span>
      </button>
      {/* Portaled to <body>: the header's backdrop blur would otherwise trap a fixed sheet inside it. */}
      {open && createPortal(
        <nav className="fixed inset-x-0 bottom-0 top-14 z-40 overflow-y-auto border-t border-line bg-paper px-4 py-4 sm:hidden">
          <ul className="divide-y divide-line">
            {LINKS.map(([label, href]) => (
              <li key={href}>
                <Link href={href} className="flex items-center justify-between py-4 text-lg">
                  {label}
                  <span className="text-ink-300">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>,
        document.body,
      )}
    </div>
  );
}
