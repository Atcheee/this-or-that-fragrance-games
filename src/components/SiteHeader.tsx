import Link from "next/link";
import { FragranceSearch } from "@/components/FragranceSearch";
import { ThemeToggle } from "@/components/ThemeToggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center gap-3 px-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold tracking-tight"
        >
          <span aria-hidden className="text-accent">
            <BottleIcon />
          </span>
          <span>This or That</span>
        </Link>

        <div className="hidden min-w-0 flex-1 justify-center px-3 md:flex">
          <FragranceSearch />
        </div>

        <nav aria-label="Utility navigation" className="ml-auto flex shrink-0 items-center gap-3">
          <Link
            href="/settings"
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            Settings
          </Link>
          <ThemeToggle />
        </nav>
      </div>

      <div className="mx-auto w-full max-w-5xl px-4 pb-3 md:hidden">
        <FragranceSearch mobile />
      </div>
    </header>
  );
}

function BottleIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 2h4m-3 2h2v3l3 2.5a4 4 0 0 1 1.5 3.1V19a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3v-6.4A4 4 0 0 1 8 9.5L11 7V4Z" />
    </svg>
  );
}
