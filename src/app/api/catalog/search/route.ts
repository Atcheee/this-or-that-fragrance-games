import { NextResponse } from "next/server";
import { searchCatalog } from "@/lib/catalog";

const MAX_QUERY_LENGTH = 80;

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);

  if (query.length < 2) {
    return NextResponse.json(
      { results: [] },
      { headers: { "Cache-Control": "public, max-age=60" } },
    );
  }

  return NextResponse.json(
    { results: searchCatalog(query, 8) },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      },
    },
  );
}
