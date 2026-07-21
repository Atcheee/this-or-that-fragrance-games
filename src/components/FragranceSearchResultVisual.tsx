import { FragranceBottleImage } from "@/components/FragranceBottleImage";
import { HouseMark } from "@/components/game/HouseMark";

export interface FragranceSearchVisualItem {
  id: string;
  name: string;
  house: string;
  year: number;
  imageUrl?: string;
}

export function FragranceSearchResultVisual({
  fragrance,
  showBottle = true,
}: {
  fragrance: FragranceSearchVisualItem;
  showBottle?: boolean;
}) {
  return (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-3">
        {showBottle ? (
          <span className="flex h-12 w-11 shrink-0 items-center justify-center rounded-lg bg-white p-1 ring-1 ring-border">
            <FragranceBottleImage
              key={`${fragrance.id}:${fragrance.imageUrl ?? ""}`}
              imageUrl={fragrance.imageUrl}
              alt=""
              well={false}
              stage={false}
              className="max-h-full w-auto max-w-full object-contain"
              placeholderClassName="h-9 w-auto text-stone-400 opacity-45"
            />
          </span>
        ) : null}
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">
            {fragrance.name}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-muted">
            <HouseMark name={fragrance.house} size="xs" />
            <span className="truncate">{fragrance.house}</span>
          </span>
        </span>
      </span>
      {fragrance.year > 0 ? (
        <span className="shrink-0 text-xs tabular-nums text-muted">
          {fragrance.year}
        </span>
      ) : null}
    </>
  );
}
