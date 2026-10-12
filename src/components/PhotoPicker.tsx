"use client";

import { useEffect, useRef, useState } from "react";

/** Downscales on the phone so uploads are fast and the model gets a sharp, bounded image. */
async function shrink(file: File, maxSide = 1600): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't process photo"))), "image/jpeg", 0.85),
  );
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

export function PhotoPicker({
  files,
  onChange,
  max = 6,
  hint,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  max?: number;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  async function add(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    try {
      const shrunk = await Promise.all([...list].map((f) => shrink(f)));
      onChange([...files, ...shrunk].slice(0, max));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {previews.map((src, i) => (
          <div key={src} className="relative aspect-square overflow-hidden rounded-xl bg-ink-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" />
            <span className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 text-xs text-white">{i}</span>
            <button
              type="button"
              onClick={() => onChange(files.filter((_, j) => j !== i))}
              className="absolute right-1.5 top-1.5 h-6 w-6 rounded-full bg-black/60 text-sm text-white"
              aria-label={`Remove photo ${i + 1}`}
            >
              ×
            </button>
          </div>
        ))}
        {files.length < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="flex aspect-square flex-col items-center justify-center rounded-xl border-2 border-dashed border-ink-300 text-sm text-ink-500 hover:border-ink-500"
          >
            <span className="text-2xl leading-none">+</span>
            <span>{busy ? "Processing…" : "Take photo"}</span>
          </button>
        )}
      </div>
      {hint && <p className="mt-2 text-sm text-ink-500">{hint}</p>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        hidden
        onChange={(e) => add(e.target.files)}
      />
    </div>
  );
}
