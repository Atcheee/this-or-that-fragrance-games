import { NextResponse } from "next/server";
import {
  getScentleAnswerSummary,
  SCENTLE_MAX_GUESSES,
  scoreScentleGuess,
} from "@/lib/scentle";
import { utcDateKey } from "@/lib/daily";
import type { ScentleGuessResponse } from "@/lib/scentle-types";

interface ScentleRequest {
  action?: "guess" | "give-up";
  guessId?: string;
  guessNumber?: number;
}

export async function POST(request: Request) {
  let body: ScentleRequest;
  try {
    body = (await request.json()) as ScentleRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const dateKey = utcDateKey();
  if (body.action === "give-up") {
    const response: ScentleGuessResponse = {
      dateKey,
      maxGuesses: SCENTLE_MAX_GUESSES,
      outcome: "lost",
      answer: getScentleAnswerSummary(),
    };
    return NextResponse.json(response, {
      headers: { "Cache-Control": "no-store" },
    });
  }

  if (
    body.action !== "guess" ||
    typeof body.guessId !== "string" ||
    !Number.isInteger(body.guessNumber) ||
    body.guessNumber! < 1 ||
    body.guessNumber! > SCENTLE_MAX_GUESSES
  ) {
    return NextResponse.json(
      { error: "Valid guessId and guessNumber are required" },
      { status: 400 },
    );
  }

  const feedback = scoreScentleGuess(body.guessId);
  if (!feedback) {
    return NextResponse.json({ error: "Fragrance not found" }, { status: 404 });
  }

  const outcome = feedback.isCorrect
    ? "won"
    : body.guessNumber === SCENTLE_MAX_GUESSES
      ? "lost"
      : null;
  const response: ScentleGuessResponse = {
    dateKey,
    maxGuesses: SCENTLE_MAX_GUESSES,
    feedback,
    outcome,
    ...(outcome ? { answer: getScentleAnswerSummary() } : {}),
  };

  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
