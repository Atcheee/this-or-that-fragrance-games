import type { Fragrance, GameModeId, WearOccasion } from "./types";

export const TASTE_EVENT_SCHEMA_VERSION = 1;
export const TASTE_ALGORITHM_VERSION = 1;

export type TasteEventType =
  | "fragrance_selected"
  | "fragrance_liked"
  | "fragrance_unliked"
  | "fragrance_disliked"
  | "fragrance_skipped"
  | "guess"
  | "profile_answer"
  | "game_completed";

export interface TasteFragrance {
  id: string;
  name: string;
  house: string;
  year: number;
  rating: number;
  votes?: number;
  imageUrl?: string;
  slug?: string;
  notes: string[];
  accords: string[];
  wear?: Partial<Record<WearOccasion, number>>;
}

export interface TasteSignals {
  likedNotes?: string[];
  avoidedNotes?: string[];
  likedAccords?: string[];
  avoidedAccords?: string[];
  seasons?: WearOccasion[];
}

export interface TasteEvent {
  id: string;
  schemaVersion: typeof TASTE_EVENT_SCHEMA_VERSION;
  anonymousId: string;
  occurredAt: string;
  type: TasteEventType;
  gameMode?: GameModeId;
  primary?: TasteFragrance;
  secondary?: TasteFragrance;
  correct?: boolean;
  feature?: { kind: "note" | "accord" | "house"; value: string };
  signals?: TasteSignals;
  result?: { score: number; total: number };
}

export type TasteEventInput = Omit<
  TasteEvent,
  "id" | "schemaVersion" | "anonymousId" | "occurredAt"
> & {
  id?: string;
  occurredAt?: string;
};

export interface PreferenceScore {
  name: string;
  score: number;
  evidence: number;
}

export interface TasteProfile {
  algorithmVersion: typeof TASTE_ALGORITHM_VERSION;
  generatedAt: string;
  interactionCount: number;
  confidence: number;
  notes: PreferenceScore[];
  accords: PreferenceScore[];
  houses: PreferenceScore[];
  decades: PreferenceScore[];
  seasons: PreferenceScore[];
  times: PreferenceScore[];
  markets: PreferenceScore[];
  summary: string;
}

export interface TasteRecommendation {
  fragrance: TasteFragrance;
  score: number;
  reasons: string[];
}

export function fragranceToTasteFragrance(
  fragrance: Fragrance & { slug?: string },
): TasteFragrance {
  return {
    id: fragrance.id,
    name: fragrance.name,
    house: fragrance.house,
    year: fragrance.year,
    rating: fragrance.rating,
    votes: fragrance.votes,
    imageUrl: fragrance.imageUrl,
    slug: fragrance.slug,
    notes: [
      ...new Set([
        ...fragrance.topNotes,
        ...fragrance.heartNotes,
        ...fragrance.baseNotes,
      ]),
    ],
    accords: [...new Set(fragrance.accords)],
    wear: fragrance.wear,
  };
}

export function createTasteEvent(
  anonymousId: string,
  input: TasteEventInput,
): TasteEvent {
  return {
    ...input,
    id: input.id ?? makeId("evt"),
    schemaVersion: TASTE_EVENT_SCHEMA_VERSION,
    anonymousId,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
  };
}

export function createAnonymousTasteId(): string {
  return makeId("anon");
}

export function buildTasteProfile(events: TasteEvent[]): TasteProfile {
  const notes = new ScoreBucket();
  const accords = new ScoreBucket();
  const houses = new ScoreBucket();
  const decades = new ScoreBucket();
  const seasons = new ScoreBucket();
  const times = new ScoreBucket();
  const markets = new ScoreBucket();

  const scoreFragrance = (fragrance: TasteFragrance | undefined, weight: number) => {
    if (!fragrance || weight === 0) return;
    fragrance.notes.forEach((note) => notes.add(note, weight));
    fragrance.accords.forEach((accord) => accords.add(accord, weight * 1.15));
    houses.add(fragrance.house, weight * 1.25);
    if (fragrance.year > 0) {
      decades.add(`${Math.floor(fragrance.year / 10) * 10}s`, weight);
    }

    const wear = normalizedWear(fragrance);
    seasons.add("Winter", weight * wear.winter);
    seasons.add("Spring", weight * wear.spring);
    seasons.add("Summer", weight * wear.summer);
    seasons.add("Fall", weight * wear.fall);
    times.add("Day", weight * wear.day);
    times.add("Night", weight * wear.night);
    markets.add(marketLabel(fragrance), weight);
  };

  for (const event of events) {
    if (event.type === "fragrance_selected") {
      scoreFragrance(event.primary, 3);
      scoreFragrance(event.secondary, -1.25);
    } else if (event.type === "fragrance_liked") {
      scoreFragrance(event.primary, 4);
    } else if (event.type === "fragrance_unliked") {
      scoreFragrance(event.primary, -4);
    } else if (event.type === "fragrance_disliked") {
      scoreFragrance(event.primary, -4);
    } else if (event.type === "fragrance_skipped") {
      scoreFragrance(event.primary, -0.5);
    } else if (event.type === "profile_answer" && event.signals) {
      event.signals.likedNotes?.forEach((item) => notes.add(item, 5));
      event.signals.avoidedNotes?.forEach((item) => notes.add(item, -5));
      event.signals.likedAccords?.forEach((item) => accords.add(item, 5));
      event.signals.avoidedAccords?.forEach((item) => accords.add(item, -5));
      event.signals.seasons?.forEach((item) => {
        const label = titleCase(item);
        if (item === "day" || item === "night") times.add(label, 4);
        else seasons.add(label, 4);
      });
    }
  }

  const profile = {
    algorithmVersion: TASTE_ALGORITHM_VERSION,
    generatedAt: new Date().toISOString(),
    interactionCount: events.length,
    confidence: Math.min(100, Math.round((events.length / 30) * 100)),
    notes: notes.values(),
    accords: accords.values(),
    houses: houses.values(),
    decades: decades.values(),
    seasons: seasons.values(),
    times: times.values(),
    markets: markets.values(),
    summary: "",
  } satisfies TasteProfile;

  profile.summary = makeSummary(profile);
  return profile;
}

export function emptyTasteProfile(): TasteProfile {
  return buildTasteProfile([]);
}

export function rankTasteRecommendations(
  profile: TasteProfile,
  candidates: TasteFragrance[],
  events: TasteEvent[],
  limit = 6,
): TasteRecommendation[] {
  const alreadySeen = new Set(
    events.flatMap((event) =>
      [event.primary?.id, event.secondary?.id].filter(
        (id): id is string => Boolean(id),
      ),
    ),
  );
  const noteScores = scoreLookup(profile.notes);
  const accordScores = scoreLookup(profile.accords);
  const houseScores = scoreLookup(profile.houses);
  const decadeScores = scoreLookup(profile.decades);
  const seasonScores = scoreLookup(profile.seasons);
  const timeScores = scoreLookup(profile.times);
  const marketScores = scoreLookup(profile.markets);

  return candidates
    .filter((candidate) => !alreadySeen.has(candidate.id))
    .map((candidate) => {
      const matches: Array<{ label: string; value: number }> = [];
      let score = 0;

      for (const accord of candidate.accords) {
        const value = accordScores.get(normalize(accord)) ?? 0;
        score += value * 1.4;
        if (value > 0) matches.push({ label: accord, value });
      }
      for (const note of candidate.notes) {
        const value = noteScores.get(normalize(note)) ?? 0;
        score += value;
        if (value > 0) matches.push({ label: note, value });
      }

      const house = houseScores.get(normalize(candidate.house)) ?? 0;
      score += house * 1.25;
      if (house > 0) matches.push({ label: candidate.house, value: house });

      if (candidate.year > 0) {
        const decade = `${Math.floor(candidate.year / 10) * 10}s`;
        score += decadeScores.get(normalize(decade)) ?? 0;
      }

      const wear = normalizedWear(candidate);
      score +=
        (seasonScores.get("winter") ?? 0) * wear.winter +
        (seasonScores.get("spring") ?? 0) * wear.spring +
        (seasonScores.get("summer") ?? 0) * wear.summer +
        (seasonScores.get("fall") ?? 0) * wear.fall +
        (timeScores.get("day") ?? 0) * wear.day +
        (timeScores.get("night") ?? 0) * wear.night;
      score += marketScores.get(normalize(marketLabel(candidate))) ?? 0;
      score += Math.max(0, candidate.rating - 3.5) * 0.75;

      return {
        fragrance: candidate,
        score,
        reasons: dedupe(
          matches
            .sort((a, b) => b.value - a.value)
            .map((match) => match.label),
        ).slice(0, 3),
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.fragrance.votes ?? 0) - (a.fragrance.votes ?? 0),
    )
    .slice(0, limit);
}

export function serializeSharedTasteProfile(profile: TasteProfile): string {
  const shared = {
    v: 1,
    n: sharePreferenceScores(profile.notes),
    a: sharePreferenceScores(profile.accords),
    h: profile.houses.slice(0, 3),
    d: profile.decades.slice(0, 2),
    s: profile.seasons.slice(0, 2),
    t: profile.times.slice(0, 2),
    m: profile.markets.slice(0, 2),
    x: profile.summary,
    c: profile.confidence,
    i: profile.interactionCount,
  };
  return toBase64Url(JSON.stringify(shared));
}

export function parseSharedTasteProfile(value: string): TasteProfile | null {
  try {
    const shared = JSON.parse(fromBase64Url(value)) as {
      v: number;
      n: PreferenceScore[];
      a: PreferenceScore[];
      h: PreferenceScore[];
      d: PreferenceScore[];
      s: PreferenceScore[];
      t: PreferenceScore[];
      m: PreferenceScore[];
      x: string;
      c: number;
      i: number;
    };
    if (shared.v !== 1 || !Array.isArray(shared.a) || !shared.x) return null;
    return {
      algorithmVersion: TASTE_ALGORITHM_VERSION,
      generatedAt: new Date().toISOString(),
      interactionCount: shared.i,
      confidence: shared.c,
      notes: shared.n,
      accords: shared.a,
      houses: shared.h,
      decades: shared.d,
      seasons: shared.s,
      times: shared.t,
      markets: shared.m,
      summary: shared.x,
    };
  } catch {
    return null;
  }
}

class ScoreBucket {
  private scores = new Map<string, PreferenceScore>();

  add(name: string, score: number) {
    const cleanName = name.trim();
    if (!cleanName || !Number.isFinite(score)) return;
    const key = normalize(cleanName);
    const current = this.scores.get(key);
    this.scores.set(key, {
      name: current?.name ?? cleanName,
      score: (current?.score ?? 0) + score,
      evidence: (current?.evidence ?? 0) + 1,
    });
  }

  values(): PreferenceScore[] {
    return [...this.scores.values()]
      .map((item) => ({ ...item, score: round(item.score) }))
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.evidence - a.evidence ||
          a.name.localeCompare(b.name),
      );
  }
}

function makeSummary(profile: TasteProfile): string {
  if (profile.interactionCount === 0) {
    return "Play a few games to reveal your fragrance personality.";
  }
  const accord = profile.accords.find((item) => item.score > 0)?.name;
  const note = profile.notes.find((item) => item.score > 0)?.name;
  const season = profile.seasons.find((item) => item.score > 0)?.name;
  const market = profile.markets.find((item) => item.score > 0)?.name;
  const scent = [accord, note].filter(Boolean).join(" and ");
  const opening = scent
    ? `You gravitate toward ${scent} scents`
    : "Your taste is still taking shape";
  const setting = season ? `, especially for ${season.toLowerCase()} wear` : "";
  const ending = market
    ? `. Your choices lean ${market.toLowerCase()}.`
    : ".";
  return `${opening}${setting}${ending}`;
}

function normalizedWear(
  fragrance: TasteFragrance,
): Record<WearOccasion, number> {
  const fallback = inferWear(fragrance.accords);
  return {
    winter: fragrance.wear?.winter ?? fallback.winter,
    spring: fragrance.wear?.spring ?? fallback.spring,
    summer: fragrance.wear?.summer ?? fallback.summer,
    fall: fragrance.wear?.fall ?? fallback.fall,
    day: fragrance.wear?.day ?? fallback.day,
    night: fragrance.wear?.night ?? fallback.night,
  };
}

function inferWear(accords: string[]): Record<WearOccasion, number> {
  const values = accords.map(normalize);
  const warm = hasAny(values, ["amber", "warm spicy", "vanilla", "oud", "woody"]);
  const fresh = hasAny(values, ["citrus", "fresh", "aquatic", "green", "aromatic"]);
  const floral = hasAny(values, ["floral", "rose", "white floral", "fruity"]);
  return {
    winter: warm ? 0.9 : 0.45,
    spring: fresh || floral ? 0.8 : 0.5,
    summer: fresh ? 0.9 : 0.35,
    fall: warm ? 0.85 : 0.5,
    day: fresh || floral ? 0.8 : 0.5,
    night: warm ? 0.85 : 0.5,
  };
}

function marketLabel(fragrance: TasteFragrance): "Mainstream" | "Niche" {
  return (fragrance.votes ?? 0) >= 5_000 ? "Mainstream" : "Niche";
}

function scoreLookup(items: PreferenceScore[]): Map<string, number> {
  return new Map(items.map((item) => [normalize(item.name), item.score]));
}

function sharePreferenceScores(items: PreferenceScore[]): PreferenceScore[] {
  const liked = items.filter((item) => item.score > 0).slice(0, 4);
  const avoided = items
    .filter((item) => item.score < 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, 4);
  return [...liked, ...avoided];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function hasAny(values: string[], options: string[]): boolean {
  return options.some((option) => values.some((value) => value.includes(option)));
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function makeId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
