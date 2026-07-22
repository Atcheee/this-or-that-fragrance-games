import Link from "next/link";
import { Star } from "@phosphor-icons/react/dist/ssr";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";

export interface CatalogCardFragrance {
  id: string;
  name: string;
  house: string;
  year: number;
  rating: number;
  votes?: number;
  imageUrl?: string;
  slug: string;
}

export function CatalogFragranceCard({
  fragrance,
  showHouse = true,
}: {
  fragrance: CatalogCardFragrance;
  showHouse?: boolean;
}) {
  const yearLabel = fragrance.year > 0 ? String(fragrance.year) : "Year unknown";
  const hasRating = fragrance.rating > 0;

  return (
    <Link
      href={`/fragrance/${fragrance.slug}`}
      className="catalog-card group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[border-color,background-color,box-shadow] hover:border-accent hover:bg-card-hover hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="bottle-studio flex h-40 items-end justify-center px-3 pb-2 pt-4">
        <FragranceBottleImage
          key={`${fragrance.id}:${fragrance.imageUrl ?? ""}`}
          imageUrl={fragrance.imageUrl}
          alt={`${fragrance.name} by ${fragrance.house} bottle`}
          width={180}
          height={240}
          sizes="(max-width: 640px) 42vw, (max-width: 1024px) 20vw, 140px"
          className="max-h-full w-auto max-w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
          placeholderClassName="h-24 w-auto text-stone-400 opacity-40"
          stage={false}
        />
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          {showHouse ? (
            <span className="block truncate text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-accent">
              {fragrance.house}
            </span>
          ) : null}
          <span
            className={`block line-clamp-2 font-display text-[0.95rem] font-semibold leading-snug tracking-tight ${
              showHouse ? "mt-1.5" : ""
            }`}
          >
            {fragrance.name}
          </span>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border/70 pt-3 text-xs">
          <time
            className="tabular-nums text-muted"
            dateTime={fragrance.year > 0 ? String(fragrance.year) : undefined}
          >
            {yearLabel}
          </time>
          {hasRating ? (
            <span
              className="inline-flex items-center gap-1 font-medium tabular-nums text-foreground"
              aria-label={`Rated ${fragrance.rating.toFixed(1)} out of 5`}
            >
              <Star
                weight="fill"
                className="size-3.5 text-accent"
                aria-hidden
              />
              {fragrance.rating.toFixed(1)}
            </span>
          ) : (
            <span className="text-muted">Unrated</span>
          )}
        </div>
      </div>
    </Link>
  );
}
