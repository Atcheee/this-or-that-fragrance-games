import type { Metadata } from "next";
import Link from "next/link";
import {
  GoogleAnalytics,
  GoogleTagManager,
} from "@next/third-parties/google";
import "./globals.css";
import { JsonLd } from "@/components/JsonLd";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SiteHeader } from "@/components/SiteHeader";
import { fraunces, ibmPlexMono, plusJakarta } from "@/lib/fonts";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { AccountSyncProvider } from "@/components/auth/AccountSyncProvider";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
} from "@/lib/site";

const title = "Scenthub — Fragrance Catalog, Comparisons & Games";
const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
const googleTagManagerId =
  process.env.NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID?.trim();
const googleAnalyticsId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "fragrance",
    "perfume",
    "scenthub",
    "fragrance catalog",
    "perfume comparison",
    "scent quiz",
    "perfume game",
    "fragrance notes",
    "accords",
    "perfume houses",
    "fragrance clones",
    "find your fragrance",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "Fragrance",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
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
    siteName: SITE_NAME,
    title,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: SITE_DESCRIPTION,
  },
  verification: googleSiteVerification
    ? { google: googleSiteVerification }
    : undefined,
};

const siteSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": absoluteUrl("/#organization"),
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      knowsAbout: [
        "Fragrances",
        "Perfume notes",
        "Perfume accords",
        "Fragrance houses",
        "Fragrance comparisons",
      ],
    },
    {
      "@type": "WebSite",
      "@id": absoluteUrl("/#website"),
      url: SITE_URL,
      name: SITE_NAME,
      alternateName: "scenthub.se",
      description: SITE_DESCRIPTION,
      inLanguage: "en",
      publisher: { "@id": absoluteUrl("/#organization") },
    },
  ],
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
      className={`${plusJakarta.variable} ${fraunces.variable} ${ibmPlexMono.variable} dark h-full antialiased`}
    >
      {googleTagManagerId ? (
        <GoogleTagManager gtmId={googleTagManagerId} />
      ) : null}
      <body className="flex min-h-full flex-col font-sans font-medium">
        <a
          href="#main-content"
          className="sr-only z-50 rounded-lg bg-accent px-4 py-3 font-semibold text-[#17120a] focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to main content
        </a>
        <JsonLd data={siteSchema} />
        <ThemeProvider>
          <AuthProvider>
            <AccountSyncProvider>
              <SiteHeader />
              <main
                id="main-content"
                className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 py-10 sm:px-8 sm:py-12"
              >
                {children}
              </main>
            </AccountSyncProvider>
          </AuthProvider>
        </ThemeProvider>
        <footer className="border-t border-border px-5 py-6 text-center text-xs text-muted">
          <p>Fragrance data is approximate and for entertainment only.</p>
          <nav
            aria-label="Footer navigation"
            className="mt-2 flex justify-center gap-4"
          >
            <Link
              href="/about"
              className="inline-flex min-h-6 items-center hover:text-foreground"
            >
              About & methodology
            </Link>
            <a
              href="/sitemap.xml"
              className="inline-flex min-h-6 items-center hover:text-foreground"
            >
              Sitemap
            </a>
          </nav>
        </footer>
      </body>
      {!googleTagManagerId && googleAnalyticsId ? (
        <GoogleAnalytics gaId={googleAnalyticsId} />
      ) : null}
    </html>
  );
}
