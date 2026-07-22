import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { LazyFragranceSearch } from "@/components/LazyFragranceSearch";
import { PrimaryNav } from "@/components/PrimaryNav";
import { ThemeToggle } from "@/components/ThemeToggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background md:bg-background/95 md:backdrop-blur-md">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-3 px-5 py-3 sm:px-8 md:grid-cols-[auto_auto_minmax(0,1fr)_auto] md:py-0 md:min-h-16">
        <Link
          href="/"
          className="col-start-1 row-start-1 flex shrink-0 items-center gap-2.5 font-display text-lg font-semibold tracking-tight transition-colors hover:text-accent"
        >
          <BrandMark className="text-accent" size={26} />
          <span>This or That</span>
        </Link>

        <PrimaryNav />

        <div
          data-search-slot="primary"
          className="col-span-3 row-start-2 min-w-0 md:col-span-1 md:col-start-3 md:row-start-1 md:flex md:justify-center md:px-5"
        >
          <LazyFragranceSearch />
        </div>

        <nav
          aria-label="Utility navigation"
          className="col-start-3 row-start-1 flex shrink-0 items-center gap-4 justify-self-end md:col-start-4"
        >
          <Link
            href="/settings"
            className="text-sm text-muted transition-colors hover:text-foreground sm:text-base"
          >
            Settings
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
