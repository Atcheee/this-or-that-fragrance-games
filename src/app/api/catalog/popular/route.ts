import { NextResponse } from "next/server";
import { getPopularCatalogFragrances } from "@/lib/catalog";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawLimit = Number(searchParams.get("limit") ?? "9");
  const limit = Number.isFinite(rawLimit) ? rawLimit : 9;

  return NextResponse.json(
    { results: getPopularCatalogFragrances(limit) },
    {
      headers: {
        "Cache-Control": "public, max-age=600, stale-while-revalidate=86400",
      },
    },
  );
}
