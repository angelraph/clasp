"use client";

import { useState } from "react";
import { ItemSketch } from "./landing/ItemSketch";

// Grid shape and per-photo spans for 1–5+ photos, so no layout leaves a hole.
const GRID: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3 grid-rows-2",
  4: "grid-cols-4 grid-rows-2",
  5: "grid-cols-4 grid-rows-2",
};
const CELL: Record<number, string[]> = {
  1: [""],
  2: ["", ""],
  3: ["col-span-2 row-span-2", "", ""],
  4: ["col-span-2 row-span-2", "col-span-2", "", ""],
  5: ["col-span-2 row-span-2", "", "", "", ""],
};

/**
 * Listing photos as evidence: square, edge to edge on phones (swipe), a mosaic on desktop,
 * and a full-screen viewer. Shows a clear note when the only photos are private.
 */
export function PhotoMosaic({ srcs }: { srcs: string[] }) {
  const [open, setOpen] = useState<number | null>(null);

  if (srcs.length === 0) {
    return (
      <div className="relative -mx-4 sm:mx-0">
        <ItemSketch className="aspect-square w-full sm:aspect-[16/9] sm:rounded-[10px]" />
        <p className="absolute inset-x-4 bottom-4 rounded-[10px] bg-card/90 px-3 py-2 text-center text-xs text-ink-700 backdrop-blur">
          Verification photos are private: they show serial numbers. The buyer checks the item itself at the handoff.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* phones: swipeable, square, edge to edge */}
      <div className="-mx-4 flex snap-x snap-mandatory overflow-x-auto sm:hidden">
        {srcs.map((src, i) => (
          <button key={src} onClick={() => setOpen(i)} className="relative w-full shrink-0 snap-center" aria-label={`Photo ${i + 1} of ${srcs.length}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="aspect-square w-full object-cover" />
            <span className="absolute bottom-3 right-3 rounded-full bg-ink-900/70 px-2.5 py-1 text-xs text-paper">
              {i + 1} / {srcs.length}
            </span>
          </button>
        ))}
      </div>

      {/* desktop: a mosaic that fills cleanly for any count */}
      <div className={`hidden aspect-[2/1] gap-2 overflow-hidden rounded-[10px] sm:grid ${GRID[Math.min(srcs.length, 5)]}`}>
        {srcs.slice(0, 5).map((src, i) => (
          <button key={src} onClick={() => setOpen(i)} className={`relative overflow-hidden bg-ink-100 ${CELL[Math.min(srcs.length, 5)][i] ?? ""}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.03]" />
            {i === 4 && srcs.length > 5 && (
              <span className="absolute inset-0 grid place-items-center bg-ink-900/50 text-sm font-medium text-paper">+{srcs.length - 5}</span>
            )}
          </button>
        ))}
      </div>

      {open !== null && (
        <div className="fixed inset-0 z-50 flex flex-col bg-ink-900/95" role="dialog" aria-modal>
          <div className="flex items-center justify-between p-4 text-paper">
            <span className="text-sm">{open + 1} / {srcs.length}</span>
            <button onClick={() => setOpen(null)} className="rounded-md px-3 py-1.5 text-sm hover:bg-paper/10">Close</button>
          </div>
          <div className="flex flex-1 items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={srcs[open]} alt="" className="max-h-full max-w-full rounded-[10px] object-contain" />
          </div>
          {srcs.length > 1 && (
            <div className="flex justify-center gap-3 p-4">
              <button onClick={() => setOpen((open - 1 + srcs.length) % srcs.length)} className="rounded-[10px] border border-paper/30 px-4 py-2 text-paper">Previous</button>
              <button onClick={() => setOpen((open + 1) % srcs.length)} className="rounded-[10px] border border-paper/30 px-4 py-2 text-paper">Next</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
