import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { FragranceSearch } from "@/components/FragranceSearch";
import { ThemeToggle } from "@/components/ThemeToggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-4 px-5 sm:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2.5 font-semibold tracking-tight transition-colors hover:text-accent"
        >
          <BrandMark className="text-accent" size={26} />
          <span>This or That</span>
        </Link>

        <nav aria-label="Primary navigation" className="hidden shrink-0 items-center gap-4 lg:flex">
          <Link
            href="/fragrances"
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            Fragrances
          </Link>
          <Link
            href="/houses"
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            Houses
          </Link>
        </nav>

        <div className="hidden min-w-0 flex-1 justify-center px-5 md:flex">
          <FragranceSearch />
        </div>

        <nav aria-label="Utility navigation" className="ml-auto flex shrink-0 items-center gap-4">
          <Link
            href="/settings"
            className="text-sm text-muted transition-colors hover:text-foreground sm:text-base"
          >
            Settings
          </Link>
          <ThemeToggle />
        </nav>
      </div>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-5 pb-3 md:hidden">
        <FragranceSearch mobile />
        <nav aria-label="Primary navigation" className="flex items-center gap-5 pt-1 text-sm">
          <Link href="/fragrances" className="font-medium text-muted hover:text-foreground">
            Browse fragrances
          </Link>
          <Link href="/houses" className="font-medium text-muted hover:text-foreground">
            Designer houses
          </Link>
        </nav>
      </div>
    </header>
  );
}
