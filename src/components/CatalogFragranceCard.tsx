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
      className="catalog-card group flex min-w-0 flex-col rounded-2xl border border-border bg-card p-4 transition-[border-color,background-color,box-shadow] hover:border-accent hover:bg-card-hover hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="mb-3 flex h-36 items-end justify-center">
        <FragranceBottleImage
          key={`${fragrance.id}:${fragrance.imageUrl ?? ""}`}
          imageUrl={fragrance.imageUrl}
          alt={`${fragrance.name} by ${fragrance.house} bottle`}
          className="max-h-full w-auto max-w-[75%] object-contain drop-shadow-md transition-transform duration-200 group-hover:scale-[1.03]"
          placeholderClassName="h-24 w-auto text-muted opacity-25"
        />
      </div>
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
    </Link>
  );
}
