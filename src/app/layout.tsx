import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SiteHeader } from "@/components/SiteHeader";

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
    "find your fragrance",
    "perfume recommendation",
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
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">
        <ThemeProvider>
          <SiteHeader />
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
