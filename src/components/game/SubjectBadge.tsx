import { NoteImage } from "@/components/NoteImage";
import {
  accordColor,
  accordSoftBackground,
} from "@/lib/visuals/accord-colors";

interface NoteBadgeProps {
  name: string;
}

/** Note name + Wikimedia thumbnail for the contains-note question. */
export function NoteBadge({ name }: NoteBadgeProps) {
  return (
    <span className="inline-flex items-center gap-2 rounded-xl bg-accent-soft py-1 pl-1 pr-3 align-middle text-accent">
      <NoteImage name={name} className="h-9 w-9 rounded-lg" />
      <span className="font-semibold">{name}</span>
    </span>
  );
}

interface AccordBadgeProps {
  name: string;
  /** Smaller chip for accord lists after reveal. */
  compact?: boolean;
}

/** Accord name + Fragrantica-style color chip for the has-accord question. */
export function AccordBadge({ name, compact = false }: AccordBadgeProps) {
  const color = accordColor(name);
  const soft = accordSoftBackground(color);

  return (
    <span
      className={`inline-flex items-center align-middle font-semibold capitalize ${
        compact
          ? "gap-1.5 rounded-lg px-2 py-0.5 text-xs"
          : "gap-2 rounded-xl py-1.5 pl-2 pr-3"
      }`}
      style={{ backgroundColor: soft, color }}
    >
      <span
        className={`shrink-0 rounded-full shadow-sm ring-1 ring-black/10 ${
          compact ? "h-2.5 w-5" : "h-3.5 w-8"
        }`}
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {name}
    </span>
  );
}
