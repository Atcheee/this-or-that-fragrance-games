import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { TemplateBuilder } from "@/components/rankings/TemplateBuilder";

export const metadata: Metadata = {
  title: "Create a ranking template — Scenthub",
  description:
    "Build a reusable fragrance ranking template with custom images and tiers.",
  alternates: { canonical: "/rankings/create" },
  robots: { index: false, follow: true },
};

export default function CreateRankingTemplatePage() {
  return (
    <div className="pb-8">
      <Link
        href="/rankings"
        className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-muted hover:text-foreground"
      >
        <ArrowLeft size={17} aria-hidden />
        Ranking templates
      </Link>
      <div className="mt-6 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Template studio
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
          Build once. Rank many ways.
        </h1>
        <p className="mt-4 max-w-2xl leading-7 text-muted">
          Template stores source items and default tiers. Every ranking gets its
          own editable board state and keeps exact version used.
        </p>
      </div>
      <div className="mt-9">
        <TemplateBuilder />
      </div>
    </div>
  );
}
