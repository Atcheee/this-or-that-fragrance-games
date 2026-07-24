import {
  ArrowsLeftRight,
  CalendarDots,
  ClockCounterClockwise,
  CurrencyCircleDollar,
  EyeClosed,
  Fingerprint,
  Flask,
  GridFour,
  HouseLine,
  Lightning,
  LinkSimple,
  ListBullets,
  MagnifyingGlass,
  FlowerLotus,
  PencilSimpleLine,
  PuzzlePiece,
  Question,
  Ranking,
  SelectionAll,
  Shapes,
  Timer,
} from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";

const MODE_ICONS: Record<string, Icon> = {
  scentle: FlowerLotus,
  "higher-rating": Lightning,
  "cost-more": CurrencyCircleDollar,
  "contains-note": Flask,
  "has-accord": ListBullets,
  "which-house": HouseLine,
  "guess-description": PencilSimpleLine,
  "fake-or-real": Question,
  "find-favorite": Ranking,
  "perfect-match": MagnifyingGlass,
  "name-by-house": Timer,
  "name-by-note": ClockCounterClockwise,
  "note-pyramid": PuzzlePiece,
  "fragrance-crime-scene": Fingerprint,
  "fragrance-20-questions": Question,
  "fragrance-grid": GridFour,
  "fragrance-bingo": SelectionAll,
  "odd-one-out": Question,
  "build-an-accord": Shapes,
  "fragrance-timeline": ArrowsLeftRight,
  "price-ladder": CurrencyCircleDollar,
  "bottle-silhouette": EyeClosed,
  "connections-curated": LinkSimple,
  "connections-generated": SelectionAll,
  "connections-daily": CalendarDots,
};

export function GameIcon({
  modeId,
  size = 30,
  weight = "light",
}: {
  modeId: string;
  size?: number;
  weight?: "thin" | "light" | "regular";
}) {
  const IconComponent = MODE_ICONS[modeId] ?? Question;

  return <IconComponent aria-hidden size={size} weight={weight} />;
}
