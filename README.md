# This or That — Fragrance Games

A fragrance knowledge and discovery app with twelve game modes, built with Next.js (App Router), TypeScript and Tailwind CSS.

## Game modes

| Mode | Type | Description |
| --- | --- | --- |
| Higher Rating | This or that | Pick the fragrance the community rates higher |
| Does It Cost More? | This or that | Pick the more expensive bottle |
| Contains This Note? | Yes / no | Is the note in the fragrance's pyramid? |
| Has This Main Accord? | Yes / no | Is it one of the main accords? |
| Which House? | Multiple choice | Match the fragrance to its house |
| Guess From Description | Multiple choice | Name and house redacted — identify the fragrance |
| Find Your Favorite | Bracket | Knockout tournament decided by your taste (8/16/32) |
| Find Your Perfect Fragrance | Discovery | Narrow the catalog through a preference quiz |
| Name That House's Fragrances | Timed naming | Type as many fragrances from a house as you can |
| Name Fragrances With a Note | Timed naming | Type as many fragrances containing a note as you can |
| Fragrance Connections | Connections | Choose a hand-crafted puzzle or a fresh puzzle generated from catalog metadata |
| Daily Connections | Connections | One shared, resumable attempt per UTC day |

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Data

- **Built-in catalog** (default): ~8,700 fragrances across ~840 houses in `src/data/fragrances.json`:
  - ~150 hand-curated entries with approximate prices and descriptions (these power the price and description game modes).
  - ~8,500 entries built from the public [TidyTuesday Parfumo dataset](https://github.com/rfordatascience/tidytuesday/blob/main/data/2024/2024-12-10/readme.md) (community ratings, note pyramids, main accords, release years, vote counts). Only entries with ≥30 community votes, ≥3 notes and ≥2 accords are included. Ratings are converted from Parfumo's 0–10 scale to 0–5.
  - Regenerate/refresh with `npx tsx scripts/build-dataset.ts` (downloads the CSV on first run).
- **Commercial API enrichment** (optional): `npx tsx scripts/import-api-data.ts` merges data from [Fragella](https://api.fragella.com) (includes real prices) and the [FragranceFinder API on RapidAPI](https://rapidapi.com/remote-skills-remote-skills-default/api/fragrancefinder-api) (descriptions + notes via `GET /perfumes/search?q=`). Put keys in `.env.local`:

  ```bash
  FRAGELLA_API_KEY=your-key        # https://api.fragella.com — free tier: 20 requests/month
  RAPIDAPI_KEY=your-key            # subscribe to FragranceFinder API — free tier: 20 requests/month
  ```

  Free tiers are tiny, so the script caches every response in `scripts/api-cache/`, spends a configurable request budget per source (`FRAGELLA_BUDGET`/`RAPIDAPI_BUDGET`, default 15), queries curated houses first, and can be scoped with `--houses "Dior,Chanel"`. Existing entries are never overwritten — API data only fills gaps (price, description, rating, year, notes) and appends new fragrances. Re-run `npx tsx scripts/rebuild-from-cache.ts` any time to rematerialize Fragella rows from the cache at zero API cost.
  - Game pools are biased toward the most-voted fragrances so rounds stay recognizable; naming challenges and house decoys draw from a popular subset (≥100 votes).
  - Values are approximate and for entertainment only.
- **The Scent Base scraper**: `npx tsx scripts/scrape-scentbase.ts --designers Afnan,Dior --merge` imports brand and perfume pages without using Fragrantica. `--popular --limit-designers 5 --merge` processes well-known houses first. Every perfume must load a real bottle image on both its brand listing and detail page before it can enter the cache or catalog; failed bottles are reported and skipped. Re-runs reuse `scripts/scentbase-cache/`. Add `--refresh` to recheck pages and images.
- **Fraganty API** (optional): request a free key at api@fraganty.ai (docs: [fraganty.ai/api-docs](https://fraganty.ai/api-docs)) and paste it on the Settings page. Compatible modes (Higher Rating, Contains This Note, Has This Main Accord, Find Your Favorite) then draw random pools from Fraganty's 100k+ perfume database via a server-side proxy (`src/app/api/fraganty/pool/route.ts`), falling back to the built-in catalog on any error. Modes that need prices, descriptions or the full local catalog (naming games, house decoys) always use the built-in data.

No database: game history, personal bests and the API key are persisted in `localStorage` (zustand `persist`).

## Security

- The Fraganty proxy route is rate limited to 10 requests/minute per IP (in-memory fixed window, `src/lib/rate-limit.ts`) and answers 429 with `Retry-After` when exceeded. On multi-instance/serverless deployments the limit is per instance; swap in a shared store (e.g. Upstash Redis) if you need strict global limits.
- Upstream calls have 8s timeouts, the fan-out is capped at 31 requests, API keys are format-validated before forwarding, and perfume slugs from upstream responses are pattern-checked and URL-encoded before being used in URLs.
- Standard security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and a CSP covering `object-src`, `base-uri`, `frame-ancestors`) are set globally in `next.config.ts`.
- The API key is stored in `localStorage` by design (no backend accounts); it is only ever sent to this app's own proxy route.

## Theming

Light / dark / system (default: system) via `next-themes`, toggle in the header.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS v4
- zustand (persisted store)
- next-themes

## Project layout

- `src/lib/types.ts` — domain types
- `src/lib/modes.ts` — game mode metadata
- `src/lib/data-source.ts` — seed + Fraganty pool providers
- `src/lib/engines/` — pure round-generation logic per game family
- `src/components/game/` — one component per game family + controller
- `src/app/play/[mode]/` — setup and play screen for every mode
- `src/app/settings/` — API key, personal bests, history
