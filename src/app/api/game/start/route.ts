import { NextResponse } from "next/server";
import { prepareGameStart, type GameStartRequest } from "@/lib/game-pool";
import type { GameKind, GameModeId } from "@/lib/types";

const KINDS = new Set<GameKind>([
  "this-or-that",
  "yes-no",
  "multiple-choice",
  "bracket",
  "discovery",
  "naming",
  "connections",
  "note-pyramid",
  "fragrance-grid",
  "odd-one-out",
  "build-an-accord",
  "fragrance-timeline",
  "bottle-silhouette",
]);

export async function POST(request: Request) {
  let body: Partial<GameStartRequest>;
  try {
    body = (await request.json()) as Partial<GameStartRequest>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const modeId = body.modeId;
  const kind = body.kind;
  if (!modeId || !kind || !KINDS.has(kind)) {
    return NextResponse.json(
      { error: "modeId and kind are required" },
      { status: 400 },
    );
  }

  try {
    const result = await prepareGameStart({
      modeId: modeId as GameModeId,
      kind,
      rounds: body.rounds,
      bracketSize: body.bracketSize,
      challengeVariant: body.challengeVariant,
      connectionsVariant: body.connectionsVariant,
      dateKey: body.dateKey,
      poolCount: body.poolCount,
    });
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to prepare game";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
