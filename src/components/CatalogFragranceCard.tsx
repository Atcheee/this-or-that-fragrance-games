import Link from "next/link";
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
          className="max-h-full w-auto max-w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
          placeholderClassName="h-24 w-auto text-stone-400 opacity-40"
          stage={false}
        />
      </div>
      <div className="flex flex-1 flex-col p-4 pt-3">
        {showHouse ? (
          <span className="truncate text-xs font-medium uppercase tracking-wider text-accent">
            {fragrance.house}
          </span>
        ) : null}
        <span className="mt-1 line-clamp-2 font-semibold leading-snug">
          {fragrance.name}
        </span>
        <span className="mt-auto pt-2 text-xs text-muted">
          {fragrance.year > 0 ? fragrance.year : "Year unknown"}
          {fragrance.rating > 0 ? ` · ${fragrance.rating.toFixed(1)} / 5` : ""}
        </span>
      </div>
    </Link>
  );
}
