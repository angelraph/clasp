import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { MobileMenu } from "@/components/MobileMenu";
import { env } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], weight: ["400", "500", "600"], style: ["normal", "italic"] });

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl()),
  title: "Clasp: pay strangers like you trust them",
  description:
    "PayPal holds the money. AI checks the item at the handoff. Money moves only when the thing does.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f4f1ea" };

const footer = [
  {
    title: "Product",
    links: [
      ["Sell an item", "/new?mode=sale"],
      ["Rent something out", "/new?mode=rental"],
      ["Browse listings", "/browse"],
      ["For AI agents", "/agents"],
    ],
  },
  {
    title: "Trust",
    links: [
      ["How it works", "/#how"],
      ["Trust & safety", "/trust"],
      ["Help center", "/support"],
      ["FAQ", "/faq"],
    ],
  },
  {
    title: "Company",
    links: [
      ["About", "/about"],
      ["Docs", "/docs"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Source code", "https://github.com/angelraph/clasp"],
    ],
  },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} font-sans antialiased`}>
        <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/80 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/" aria-label="Clasp home">
              <Logo size={26} />
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              <Link href="/browse" className="hidden rounded-md px-2.5 py-1.5 text-ink-700 hover:text-ink-900 sm:inline">Browse</Link>
              <Link href="/support" className="hidden rounded-md px-2.5 py-1.5 text-ink-700 hover:text-ink-900 sm:inline">Help</Link>
              <Link href="/docs" className="hidden rounded-md px-2.5 py-1.5 text-ink-700 hover:text-ink-900 md:inline">Docs</Link>
              <Link href="/agents" className="hidden rounded-md px-2.5 py-1.5 text-ink-700 hover:text-ink-900 sm:inline">Agents</Link>
              <Link href="/new" className="ml-1 rounded-[10px] bg-ink-900 px-3 py-1.5 font-medium text-paper hover:bg-ink-700">
                Sell or rent
              </Link>
              <MobileMenu />
            </nav>
          </div>
        </header>

        <main>{children}</main>

        <footer className="mt-20 border-t border-line">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div className="space-y-3">
              <Logo size={26} />
              <p className="max-w-xs text-sm text-ink-500">Real items. Real payments. Money moves only when the thing does.</p>
            </div>
            {footer.map((col) => (
              <div key={col.title}>
                <p className="status text-ink-500">{col.title}</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {col.links.map(([label, href]) => (
                    <li key={href}>
                      <Link href={href} className="text-ink-700 hover:text-ink-900">{label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="mx-auto max-w-6xl px-4 pb-10 text-xs text-ink-500">
            Clasp is a hackathon prototype running on the PayPal sandbox. No real money moves. PayPal is a trademark of PayPal, Inc.; Clasp is not
            affiliated with or endorsed by PayPal.
          </div>
        </footer>
      </body>
    </html>
  );
}
