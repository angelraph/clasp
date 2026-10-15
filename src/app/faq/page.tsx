import type { Metadata } from "next";
import { DocPage, StillStuck } from "@/components/DocPage";
import { FAQ } from "@/lib/faq";

export const metadata: Metadata = {
  title: "FAQ · Clasp",
  description: "How Clasp holds money with PayPal and releases it only when the item checks out: buying, selling, renting, AI and privacy.",
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ.flatMap((g) => g.items).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
  return (
    <DocPage
      eyebrow="FAQ"
      title="Questions, answered plainly."
      lead="Everything about holds, handoffs, deposits and what the AI can and can't do. If something isn't here, ask us."
      toc={FAQ.map((g) => ({ id: slug(g.title), label: g.title }))}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="space-y-14">
        {FAQ.map((group) => (
          <section key={group.title} id={slug(group.title)} className="scroll-mt-20">
            <h2 className="text-2xl font-semibold tracking-tight">{group.title}</h2>
            <div className="mt-4 divide-y divide-line border-y border-line">
              {group.items.map((f) => (
                <details key={f.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-lg font-medium">
                    {f.q}
                    <span className="mt-0.5 text-xl leading-none text-ink-500 transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 leading-relaxed text-ink-700">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}
      </div>
      <StillStuck />
    </DocPage>
  );
}
