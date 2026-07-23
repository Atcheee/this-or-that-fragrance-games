/**
 * Approximate Fragrantica-style rating & occasion bars from catalog fields.
 * The source data only stores overall rating + vote count (+ accords), so
 * these distributions are derived estimates for UI — not scraped vote tallies.
 */

export interface SentimentBucket {
  id: "love" | "like" | "ok" | "dislike" | "hate";
  label: string;
  count: number;
  share: number;
  color: string;
}

export interface WearBucket {
  id: "winter" | "spring" | "summer" | "fall" | "day" | "night";
  label: string;
  count: number;
  share: number;
  color: string;
}

const SENTIMENT_META: Array<{
  id: SentimentBucket["id"];
  label: string;
  center: number;
  color: string;
}> = [
  { id: "love", label: "love", center: 5, color: "#f472b6" },
  { id: "like", label: "like", center: 4, color: "#fb7185" },
  { id: "ok", label: "ok", center: 3, color: "#fdba74" },
  { id: "dislike", label: "dislike", center: 2, color: "#7dd3fc" },
  { id: "hate", label: "hate", center: 1, color: "#38bdf8" },
];

const WEAR_META: Array<{
  id: WearBucket["id"];
  label: string;
  color: string;
  accords: string[];
}> = [
  {
    id: "winter",
    label: "winter",
    color: "#7dd3fc",
    accords: [
      "woody",
      "sweet",
      "vanilla",
      "amber",
      "ambery",
      "spicy",
      "warm spicy",
      "gourmand",
      "leather",
      "oud",
      "tobacco",
      "balsamic",
      "oriental",
      "smoky",
      "resinous",
    ],
  },
  {
    id: "spring",
    label: "spring",
    color: "#4ade80",
    accords: [
      "floral",
      "white floral",
      "yellow floral",
      "fresh",
      "green",
      "fruity",
      "powdery",
      "rose",
      "iris",
      "lavender",
    ],
  },
  {
    id: "summer",
    label: "summer",
    color: "#fb7185",
    accords: [
      "citrus",
      "aquatic",
      "marine",
      "fresh",
      "ozonic",
      "tropical",
      "aromatic",
      "herbal",
      "green",
    ],
  },
  {
    id: "fall",
    label: "fall",
    color: "#fb923c",
    accords: [
      "woody",
      "spicy",
      "warm spicy",
      "earthy",
      "amber",
      "tobacco",
      "patchouli",
      "leather",
      "aromatic",
      "sweet",
    ],
  },
  {
    id: "day",
    label: "day",
    color: "#fbbf24",
    accords: [
      "fresh",
      "citrus",
      "green",
      "floral",
      "aquatic",
      "aromatic",
      "fruity",
      "clean",
      "soapy",
    ],
  },
  {
    id: "night",
    label: "night",
    color: "#93c5fd",
    accords: [
      "woody",
      "sweet",
      "oriental",
      "leather",
      "oud",
      "musky",
      "amber",
      "vanilla",
      "spicy",
      "animalic",
      "smoky",
    ],
  },
];

function softMaxWeights(scores: number[], temperature = 0.55): number[] {
  const scaled = scores.map((s) => s / temperature);
  const max = Math.max(...scaled);
  const exps = scaled.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0) || 1;
  return exps.map((e) => e / sum);
}

function formatCount(n: number): string {
  if (n >= 10_000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

export { formatCount };

/** Map overall rating + votes into love/like/ok/dislike/hate shares. */
export function deriveSentimentBuckets(
  rating: number,
  votes = 0,
): SentimentBucket[] {
  const effectiveVotes = Math.max(votes, rating > 0 ? 24 : 0);
  if (rating <= 0 || effectiveVotes === 0) {
    return SENTIMENT_META.map((meta) => ({
      id: meta.id,
      label: meta.label,
      count: 0,
      share: 0,
      color: meta.color,
    }));
  }

  const scores = SENTIMENT_META.map(
    (meta) => -Math.pow(meta.center - rating, 2),
  );
  const shares = softMaxWeights(scores, 0.65);
  const raw = shares.map((share) => share * effectiveVotes);
  const rounded = allocateIntegers(raw, effectiveVotes);

  return SENTIMENT_META.map((meta, i) => ({
    id: meta.id,
    label: meta.label,
    count: rounded[i]!,
    share: shares[i]!,
    color: meta.color,
  }));
}

/** Season and day/night are independent polls with comparable vote scales. */
const SEASON_IDS: WearBucket["id"][] = ["winter", "spring", "summer", "fall"];
const TIME_IDS: WearBucket["id"][] = ["day", "night"];

/** Score seasons / day-night from accord overlap, scaled by vote count. */
export function deriveWearBuckets(
  accords: string[],
  votes = 0,
  storedWear?: Partial<Record<WearBucket["id"], number>>,
): WearBucket[] {
  const effectiveVotes = Math.max(votes, accords.length > 0 ? 40 : 0);

  if (effectiveVotes === 0 && !hasStoredWear(storedWear)) {
    return WEAR_META.map((meta) => ({
      id: meta.id,
      label: meta.label,
      count: 0,
      share: 0,
      color: meta.color,
    }));
  }

  const voteBase = Math.max(effectiveVotes, 40);
  const shareById = new Map<WearBucket["id"], number>();

  if (hasStoredWear(storedWear)) {
    // Catalog shares are already 0–1 per poll (Fragella) or jointly (Fragrantica).
    // Keep them as-is so season and day/night counts stay on one Fragrantica-like scale.
    for (const meta of WEAR_META) {
      shareById.set(meta.id, Math.max(0, storedWear?.[meta.id] ?? 0));
    }
  } else {
    const seasonShares = accordGroupShares(SEASON_IDS, accords);
    const timeShares = accordGroupShares(TIME_IDS, accords);
    SEASON_IDS.forEach((id, i) => shareById.set(id, seasonShares[i]!));
    TIME_IDS.forEach((id, i) => shareById.set(id, timeShares[i]!));
  }

  return WEAR_META.map((meta) => {
    const share = shareById.get(meta.id) ?? 0;
    return {
      id: meta.id,
      label: meta.label,
      count: Math.round(share * voteBase),
      share,
      color: meta.color,
    };
  });
}

function hasStoredWear(
  wear?: Partial<Record<WearBucket["id"], number>>,
): boolean {
  if (!wear) return false;
  return WEAR_META.some((meta) => (wear[meta.id] ?? 0) > 0);
}

/** Soft-max shares within one poll (seasons or day/night). */
function accordGroupShares(
  ids: WearBucket["id"][],
  accords: string[],
): number[] {
  const keys = accords.map((a) =>
    a
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim(),
  );

  return softMaxWeights(
    ids.map((id) => {
      const meta = WEAR_META.find((item) => item.id === id)!;
      let score = 0.35;
      for (const accord of keys) {
        if (meta.accords.includes(accord)) score += 1.4;
        else if (
          meta.accords.some((a) => accord.includes(a) || a.includes(accord))
        ) {
          score += 0.7;
        }
      }
      return score;
    }),
    1.1,
  );
}

/** Largest-remainder method so bucket counts sum exactly to `total`. */
function allocateIntegers(raw: number[], total: number): number[] {
  const floors = raw.map((n) => Math.floor(n));
  let leftover = total - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((n, i) => ({ i, frac: n - Math.floor(n) }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (const { i } of order) {
    if (leftover <= 0) break;
    out[i]! += 1;
    leftover -= 1;
  }
  return out;
}
