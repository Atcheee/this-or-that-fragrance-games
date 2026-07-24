import { NextResponse } from "next/server";
import { analyzeCollection } from "@/lib/collection-analysis";
import {
  COLLECTION_STATUSES,
  type CollectionStatus,
} from "@/lib/fragrance-collection";

const MAX_ENTRIES = 500;

function isStatus(value: unknown): value is CollectionStatus {
  return COLLECTION_STATUSES.includes(value as CollectionStatus);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rawEntries =
    body && typeof body === "object" && "entries" in body
      ? (body as { entries?: unknown }).entries
      : undefined;
  if (!Array.isArray(rawEntries)) {
    return NextResponse.json(
      { error: "Expected an entries array." },
      { status: 400 },
    );
  }

  const entries = [
    ...new Map(
      rawEntries
        .slice(0, MAX_ENTRIES)
        .filter(
          (entry): entry is { id: string; status: CollectionStatus } =>
            Boolean(
              entry &&
                typeof entry === "object" &&
                "id" in entry &&
                typeof entry.id === "string" &&
                entry.id.length <= 200 &&
                "status" in entry &&
                isStatus(entry.status),
            ),
        )
        .map((entry) => [entry.id, entry] as const),
    ).values(),
  ];

  return NextResponse.json(analyzeCollection(entries), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
