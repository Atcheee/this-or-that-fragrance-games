import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { LazyFragranceSearch } from "@/components/LazyFragranceSearch";
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

        <nav
          aria-label="Primary navigation"
          className="col-span-3 row-start-3 flex items-center gap-5 text-sm md:col-span-1 md:col-start-2 md:row-start-1 md:gap-4 lg:flex"
        >
          <Link
            href="/fragrances"
            className="font-medium text-muted transition-colors hover:text-foreground md:text-sm"
          >
            <span className="md:hidden">Browse fragrances</span>
            <span className="hidden md:inline">Fragrances</span>
          </Link>
          <Link
            href="/houses"
            className="font-medium text-muted transition-colors hover:text-foreground md:text-sm"
          >
            <span className="md:hidden">Designer houses</span>
            <span className="hidden md:inline">Houses</span>
          </Link>
        </nav>

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
