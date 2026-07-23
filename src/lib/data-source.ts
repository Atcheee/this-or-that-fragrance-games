import type {
  PreparedConnectionPuzzle,
} from "@/lib/engines/connections";
import type { PreparedFragranceGrid } from "@/lib/engines/fragrance-grid";
import type { OddOneOutRound } from "@/lib/engines/odd-one-out";
import type { NamingChallenge } from "@/lib/engines/naming";
import type { Fragrance, GameKind, GameModeId } from "./types";
import { allNotes } from "./types";

/** Fragella CDN hotlinks 403 in the browser — treat as missing. */
export function hasUsableImage(f: Fragrance): boolean {
  const url = f.imageUrl;
  if (!url) return false;
  return !url.includes("cdn.fragella.com");
}

export function allHouses(data: Fragrance[]): string[] {
  return [...new Set(data.map((f) => f.house))];
}

export function noteVocabulary(data: Fragrance[]): string[] {
  return [...new Set(data.flatMap(allNotes))];
}

export function accordVocabulary(data: Fragrance[]): string[] {
  return [...new Set(data.flatMap((f) => f.accords))];
}

export type GameStartResponse = {
  source: "seed" | "fraganty";
  pool: Fragrance[];
  connectionsPuzzle?: PreparedConnectionPuzzle;
  fragranceGridPuzzle?: PreparedFragranceGrid;
  oddOneOutRounds?: OddOneOutRound[];
  oddOneOutSeed?: string;
  namingChallenge?: NamingChallenge;
};

export type StartGameOptions = {
  modeId: GameModeId;
  kind: GameKind;
  rounds?: number;
  bracketSize?: number;
  challengeVariant?: "daily" | "practice";
  connectionsVariant?: "daily" | "curated" | "generated";
  dateKey?: string;
  apiKey?: string;
  poolCount?: number;
};

const FRAGANTY_CAPABLE = new Set<GameModeId>([
  "higher-rating",
  "contains-note",
  "has-accord",
  "find-favorite",
]);

/** Fetch a prepared game session from the server (catalog stays server-only). */
export async function startGameSession(
  options: StartGameOptions,
): Promise<GameStartResponse> {
  const poolCount = options.poolCount;
  if (
    options.apiKey &&
    poolCount &&
    FRAGANTY_CAPABLE.has(options.modeId)
  ) {
    try {
      const res = await fetch(`/api/fraganty/pool?count=${poolCount}`, {
        headers: { "x-api-key": options.apiKey },
      });
      if (res.ok) {
        const data = (await res.json()) as { fragrances: Fragrance[] };
        if (
          Array.isArray(data.fragrances) &&
          data.fragrances.length >= poolCount
        ) {
          return {
            source: "fraganty",
            pool: data.fragrances.slice(0, poolCount),
          };
        }
      }
    } catch {
      // fall through to seed catalog
    }
  }

  const res = await fetch("/api/game/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      modeId: options.modeId,
      kind: options.kind,
      rounds: options.rounds,
      bracketSize: options.bracketSize,
      challengeVariant: options.challengeVariant,
      connectionsVariant: options.connectionsVariant,
      dateKey: options.dateKey,
      poolCount: options.poolCount,
    }),
  });

  if (!res.ok) {
    const message = await res.text().catch(() => "");
    throw new Error(message || `Failed to start game (${res.status})`);
  }

  return (await res.json()) as GameStartResponse;
}
