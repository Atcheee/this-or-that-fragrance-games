import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  "https://this-or-that-fragrance-games.vercel.app";

const title = "This or That — Fragrance Games";
const description =
  "Test your fragrance knowledge: ratings, prices, notes, accords, houses and more.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  applicationName: "This or That",
  keywords: [
    "fragrance",
    "perfume",
    "this or that",
    "scent quiz",
    "perfume game",
    "fragrance notes",
    "accords",
    "perfume houses",
  ],
  authors: [{ name: "This or That" }],
  creator: "This or That",
  publisher: "This or That",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "This or That",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <ThemeProvider>
          <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
            <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
              <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
                <span aria-hidden className="text-accent">
                  <BottleIcon />
                </span>
                This or That
              </Link>
              <div className="flex items-center gap-3">
                <Link
                  href="/settings"
                  className="text-sm text-muted transition-colors hover:text-foreground"
                >
                  Settings
                </Link>
                <ThemeToggle />
              </div>
            </div>
          </header>
          <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">
            {children}
          </main>
          <footer className="border-t border-border py-4 text-center text-xs text-muted">
            Fragrance data is approximate and for entertainment only.
          </footer>
        </ThemeProvider>
      </body>
    </html>
  );
}

function BottleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2h4m-3 2h2v3l3 2.5a4 4 0 0 1 1.5 3.1V19a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3v-6.4A4 4 0 0 1 8 9.5L11 7V4Z" />
    </svg>
  );
}
