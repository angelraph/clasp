import Link from "next/link";

export type TocItem = { id: string; label: string };

/**
 * Shared layout for long-form pages: eyebrow, title, lead, a sticky table of contents on
 * desktop (a compact jump list on phones), and readable prose.
 */
export function DocPage({
  eyebrow,
  title,
  lead,
  toc = [],
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: React.ReactNode;
  toc?: TocItem[];
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-10 pt-10 sm:pt-14">
      <header className="max-w-3xl">
        <p className="status text-brass-ink">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold leading-[1.08] tracking-[-0.03em] sm:text-5xl">{title}</h1>
        {lead && <div className="mt-4 text-lg leading-relaxed text-ink-500 sm:text-xl">{lead}</div>}
        {updated && <p className="mt-4 text-xs text-ink-500">Last updated {updated}</p>}
      </header>

      {toc.length > 0 && (
        <nav aria-label="On this page" className="mt-8 flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {toc.map((t) => (
            <a key={t.id} href={`#${t.id}`} className="shrink-0 rounded-full border border-line bg-card px-3 py-1.5 text-sm text-ink-700">
              {t.label}
            </a>
          ))}
        </nav>
      )}

      <div className={`mt-10 grid gap-12 ${toc.length ? "lg:grid-cols-[220px_1fr]" : ""}`}>
        {toc.length > 0 && (
          <aside className="hidden lg:block">
            <nav aria-label="On this page" className="sticky top-20 space-y-1 border-l border-line">
              {toc.map((t) => (
                <a key={t.id} href={`#${t.id}`} className="-ml-px block border-l border-transparent py-1 pl-4 text-sm text-ink-500 hover:border-ink-900 hover:text-ink-900">
                  {t.label}
                </a>
              ))}
            </nav>
          </aside>
        )}
        <div className="min-w-0 max-w-3xl">{children}</div>
      </div>
    </div>
  );
}

/** A small "still stuck?" footer for help-type pages. */
export function StillStuck() {
  return (
    <div className="mt-14 rounded-[10px] border border-line bg-card p-6">
      <p className="font-semibold">Still stuck?</p>
      <p className="mt-1 text-sm text-ink-500">Tell us what happened and include your deal link if you have one.</p>
      <Link href="/support#contact" className="mt-4 inline-block rounded-[10px] bg-ink-900 px-4 py-2.5 text-sm font-medium text-paper">
        Contact support
      </Link>
    </div>
  );
}
