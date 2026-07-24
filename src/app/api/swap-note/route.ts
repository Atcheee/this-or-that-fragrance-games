import { NextResponse } from "next/server";
import {
  getSwapNoteFragrance,
  matchSwapNote,
  searchSwapNotes,
} from "@/lib/swap-note";
import type { NoteTier, SwapNoteEdit } from "@/lib/swap-note-types";

const TIERS = new Set<NoteTier>(["top", "heart", "base"]);
const OPERATIONS = new Set(["remove", "replace", "add"]);
const MAX_TEXT_LENGTH = 100;

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.has("notes")) {
    const query = (searchParams.get("notes") ?? "")
      .trim()
      .slice(0, MAX_TEXT_LENGTH);
    return NextResponse.json(
      { notes: searchSwapNotes(query) },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  }

  const id = (searchParams.get("id") ?? "").trim().slice(0, 200);
  const fragrance = id ? getSwapNoteFragrance(id) : null;
  if (!fragrance) {
    return NextResponse.json({ error: "Fragrance not found." }, { status: 404 });
  }
  return NextResponse.json(
    { fragrance },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const fragranceId =
    typeof input.fragranceId === "string"
      ? input.fragranceId.trim().slice(0, 200)
      : "";
  const operation =
    typeof input.operation === "string" ? input.operation : "";
  const tier = typeof input.tier === "string" ? input.tier : "";
  const note =
    typeof input.note === "string"
      ? input.note.trim().slice(0, MAX_TEXT_LENGTH)
      : "";
  const replacementNote =
    typeof input.replacementNote === "string"
      ? input.replacementNote.trim().slice(0, MAX_TEXT_LENGTH)
      : "";

  if (
    !fragranceId ||
    !OPERATIONS.has(operation) ||
    !TIERS.has(tier as NoteTier) ||
    !note ||
    (operation === "replace" && !replacementNote)
  ) {
    return NextResponse.json(
      { error: "Choose a fragrance and complete one note edit." },
      { status: 400 },
    );
  }

  const edit = {
    operation,
    tier,
    note,
    ...(operation === "replace" ? { replacementNote } : {}),
  } as SwapNoteEdit;

  try {
    return NextResponse.json(matchSwapNote(fragranceId, edit), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not match profile.",
      },
      { status: 400 },
    );
  }
}
