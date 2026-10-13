import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { env } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(env.appUrl()),
  title: "Clasp: pay strangers like you trust them",
  description:
    "PayPal holds the money. AI checks the item at the handoff. Money moves only when the thing does.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#11141b" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}>
        <header className="mx-auto flex max-w-xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-ink-900 text-sm text-white">C</span>
            Clasp
          </Link>
          <Link href="/new" className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium ring-1 ring-ink-200 hover:bg-ink-100">
            Create a Clasp
          </Link>
        </header>
        <main className="mx-auto max-w-xl px-4 pb-16">{children}</main>
      </body>
    </html>
  );
}
