import "server-only";

import {
  getCatalogSimilarity,
  getFragranceById,
  getRecommendationCandidates,
  type CatalogFragrance,
} from "@/lib/catalog";
import type {
  CollectionAnalysis,
  CollectionCoverage,
  CollectionEntry,
  CollectionFragrance,
  CollectionGap,
  CollectionRecommendation,
  CollectionStat,
  SimilarityBreakdown,
} from "@/lib/fragrance-collection";
import { allNotes, type WearOccasion } from "@/lib/types";

const CATEGORY_RULES = [
  {
    name: "Fresh & clean",
    accords: ["fresh", "citrus", "aquatic", "green", "aromatic"],
    explanation: "Easy daytime scents with lift and freshness.",
  },
  {
    name: "Warm & ambery",
    accords: ["amber", "warm spicy", "vanilla", "balsamic"],
    explanation: "Comforting depth for cold weather and evenings.",
  },
  {
    name: "Woody",
    accords: ["woody", "oud", "earthy", "sandalwood"],
    explanation: "Dry structure and versatile grounding.",
  },
  {
    name: "Floral",
    accords: ["floral", "white floral", "rose", "powdery"],
    explanation: "Petal-led scents from sheer to opulent.",
  },
  {
    name: "Sweet & gourmand",
    accords: ["sweet", "gourmand", "caramel", "chocolate", "coffee"],
    explanation: "Edible sweetness and playful richness.",
  },
  {
    name: "Dark & smoky",
    accords: ["smoky", "leather", "tobacco", "animalic"],
    explanation: "Bold texture for nights and statement wear.",
  },
  {
    name: "Fruity",
    accords: ["fruity", "tropical"],
    explanation: "Juicy brightness outside classic citrus.",
  },
] as const;

const SEASONS: WearOccasion[] = ["spring", "summer", "fall", "winter"];
const DAY_NIGHT: WearOccasion[] = ["day", "night"];

function summarizeCounts(
  values: string[],
  total: number,
  limit = 8,
): CollectionStat[] {
  const counts = new Map<string, { name: string; count: number }>();
  for (const value of values) {
    const key = value.trim().toLowerCase();
    if (!key) continue;
    const current = counts.get(key);
    counts.set(key, {
      name: current?.name ?? value,
      count: (current?.count ?? 0) + 1,
    });
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ name, count }) => ({
      name,
      count,
      share: total > 0 ? Math.round((count / total) * 100) : 0,
    }));
}

function normalizeCoverage(
  fragrances: CatalogFragrance[],
  occasions: WearOccasion[],
): CollectionCoverage[] {
  const totals = occasions.map((occasion) =>
    fragrances.reduce(
      (sum, fragrance) => sum + (fragrance.wear?.[occasion] ?? 0),
      0,
    ),
  );
  const total = totals.reduce((sum, value) => sum + value, 0);
  return occasions.map((occasion, index) => ({
    name: occasion[0]!.toUpperCase() + occasion.slice(1),
    score: total > 0 ? Math.round((totals[index]! / total) * 100) : 0,
  }));
}

function toCollectionFragrance(
  fragrance: CatalogFragrance,
): CollectionFragrance {
  return {
    id: fragrance.id,
    name: fragrance.name,
    house: fragrance.house,
    year: fragrance.year,
    slug: fragrance.slug,
    imageUrl: fragrance.imageUrl,
  };
}

function categoryMatches(fragrance: CatalogFragrance, accords: readonly string[]) {
  const fragranceAccords = new Set(
    fragrance.accords.map((accord) => accord.toLowerCase()),
  );
  return accords.some((accord) => fragranceAccords.has(accord));
}

function getCategoryGaps(fragrances: CatalogFragrance[]): CollectionGap[] {
  return CATEGORY_RULES.map((category) => ({
    name: category.name,
    count: fragrances.filter((fragrance) =>
      categoryMatches(fragrance, category.accords),
    ).length,
    explanation: category.explanation,
  })).sort((a, b) => a.count - b.count || a.name.localeCompare(b.name));
}

function getRedundantPairs(
  fragrances: CatalogFragrance[],
): SimilarityBreakdown[] {
  const pairs: SimilarityBreakdown[] = [];
  for (let firstIndex = 0; firstIndex < fragrances.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < fragrances.length;
      secondIndex += 1
    ) {
      const first = fragrances[firstIndex]!;
      const second = fragrances[secondIndex]!;
      const similarity = getCatalogSimilarity(first, second);
      if (similarity.score < 22) continue;
      pairs.push({
        score: similarity.score,
        first: toCollectionFragrance(first),
        second: toCollectionFragrance(second),
        sharedAccords: similarity.sharedAccords,
        sharedNotes: similarity.sharedNotes,
        sameHouse: similarity.sameHouse,
      });
    }
  }
  return pairs
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function recommendationFor(
  title: string,
  fragrance: CatalogFragrance,
  explanation: string,
  score?: number,
): CollectionRecommendation {
  return {
    title,
    fragrance: toCollectionFragrance(fragrance),
    explanation,
    score,
  };
}

function getRecommendations(
  owned: CatalogFragrance[],
  excludedIds: Set<string>,
  seasons: CollectionCoverage[],
  gaps: CollectionGap[],
  redundantPairs: SimilarityBreakdown[],
): CollectionAnalysis["recommendations"] {
  const weakestSeason =
    [...seasons].sort((a, b) => a.score - b.score)[0]?.name ?? "Season";
  const weakestSeasonKey = weakestSeason.toLowerCase() as WearOccasion;
  const missingNames = new Set(
    gaps.filter((gap) => gap.count === 0).map((gap) => gap.name),
  );

  const candidates = getRecommendationCandidates()
    .filter((candidate) => !excludedIds.has(candidate.id))
    .map((candidate) => {
      const similarities = owned.map((fragrance) =>
        getCatalogSimilarity(fragrance, candidate),
      );
      const maxSimilarity = Math.max(
        0,
        ...similarities.map((similarity) => similarity.score),
      );
      const novelty = 1 - maxSimilarity / 100;
      const quality = Math.min(candidate.rating / 5, 1);
      const popularity = Math.min(
        Math.log10((candidate.votes ?? 0) + 1) / 5,
        1,
      );
      const seasonalFit = Math.min(
        (candidate.wear?.[weakestSeasonKey] ?? 0) * 4,
        1,
      );
      const fillsMissingCategory = CATEGORY_RULES.some(
        (category) =>
          missingNames.has(category.name) &&
          categoryMatches(candidate, category.accords),
      );
      const gapBoost = fillsMissingCategory ? 1 : 0;
      return {
        candidate,
        maxSimilarity,
        seasonalFit,
        fillsMissingCategory,
        bestScore:
          quality * 0.27 +
          popularity * 0.16 +
          novelty * 0.25 +
          seasonalFit * 0.2 +
          gapBoost * 0.12,
        unusualScore:
          novelty * 0.5 +
          seasonalFit * 0.22 +
          quality * 0.2 +
          (1 - popularity) * 0.08,
      };
    });

  const best = [...candidates].sort((a, b) => b.bestScore - a.bestScore)[0];
  const unusual = [...candidates]
    .filter((candidate) => candidate.candidate.id !== best?.candidate.id)
    .sort((a, b) => b.unusualScore - a.unusualScore)[0];

  const redundantCounts = new Map<string, { fragrance: CatalogFragrance; score: number }>();
  for (const pair of redundantPairs) {
    for (const fragrance of [pair.first, pair.second]) {
      const catalogFragrance = getFragranceById(fragrance.id);
      if (!catalogFragrance) continue;
      const current = redundantCounts.get(fragrance.id);
      redundantCounts.set(fragrance.id, {
        fragrance: catalogFragrance,
        score: (current?.score ?? 0) + pair.score,
      });
    }
  }
  const doNotNeed = [...redundantCounts.values()].sort(
    (a, b) => b.score - a.score,
  )[0];

  return {
    bestNextAddition: best
      ? recommendationFor(
          "Best next addition",
          best.candidate,
          `${weakestSeason} support, ${best.maxSimilarity}% max similarity to anything owned${best.fillsMissingCategory ? ", and fills a missing scent family" : ""}.`,
          Math.round(best.bestScore * 100),
        )
      : undefined,
    unusualUsefulAddition: unusual
      ? recommendationFor(
          "Most unusual useful addition",
          unusual.candidate,
          `High novelty with ${unusual.maxSimilarity}% max similarity, while still helping ${weakestSeason.toLowerCase()} coverage.`,
          Math.round(unusual.unusualScore * 100),
        )
      : undefined,
    probablyDoNotNeed: doNotNeed
      ? recommendationFor(
          "Fragrance you probably do not need",
          doNotNeed.fragrance,
          "This bottle appears in the strongest overlap pairs. It adds the least distinct territory in your current collection.",
        )
      : undefined,
    weakestSeasonalCoverage: {
      title: "Weakest seasonal coverage",
      explanation: `${weakestSeason} is only ${seasons.find((season) => season.name === weakestSeason)?.score ?? 0}% of your seasonal wear profile.`,
    },
  };
}

export function analyzeCollection(
  entries: Pick<CollectionEntry, "id" | "status">[],
): CollectionAnalysis {
  const catalogEntries = entries
    .map((entry) => ({ ...entry, fragrance: getFragranceById(entry.id) }))
    .filter(
      (
        entry,
      ): entry is Pick<CollectionEntry, "id" | "status"> & {
        fragrance: CatalogFragrance;
      } => Boolean(entry.fragrance),
    );
  const owned = catalogEntries
    .filter((entry) => entry.status === "owned")
    .map((entry) => entry.fragrance);
  const seasons = normalizeCoverage(owned, SEASONS);
  const dayNight = normalizeCoverage(owned, DAY_NIGHT);
  const categories = getCategoryGaps(owned);
  const redundantPairs = getRedundantPairs(owned);

  return {
    ownedCount: owned.length,
    dominantNotes: summarizeCounts(
      owned.flatMap((fragrance) => [...new Set(allNotes(fragrance))]),
      owned.length,
      10,
    ),
    dominantAccords: summarizeCounts(
      owned.flatMap((fragrance) => [...new Set(fragrance.accords)]),
      owned.length,
      8,
    ),
    seasons,
    dayNight,
    houses: summarizeCounts(
      owned.map((fragrance) => fragrance.house),
      owned.length,
      8,
    ),
    decades: summarizeCounts(
      owned.map((fragrance) =>
        fragrance.year > 0
          ? `${Math.floor(fragrance.year / 10) * 10}s`
          : "Unknown",
      ),
      owned.length,
      8,
    ),
    categories,
    redundantPairs,
    recommendations:
      owned.length > 0
        ? getRecommendations(
            owned,
            new Set(catalogEntries.map((entry) => entry.id)),
            seasons,
            categories,
            redundantPairs,
          )
        : {},
  };
}
