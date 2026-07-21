/**
 * Scrape The Scent Base brands -> paginated perfume lists -> detail pages,
 * then merge verified records into src/data/fragrances.json.
 *
 * Every cached perfume must pass two bottle checks: once on the brand listing
 * and again on its detail page. Perfumes without a real, loaded bottle image
 * are skipped and never merged.
 *
 * Usage:
 *   npx tsx scripts/scrape-scentbase.ts --designers Afnan --merge
 *   npx tsx scripts/scrape-scentbase.ts --popular --limit-designers 5 --merge
 *   npx tsx scripts/scrape-scentbase.ts --merge
 *   npx tsx scripts/scrape-scentbase.ts --designers Dior --limit-perfumes 5
 *
 * Options:
 *   --delay 750             Delay between detail pages in milliseconds
 *   --refresh               Ignore brand/perfume caches
 *   --refresh-designers     Reload the popular brand index
 *   --headed                Show the scraper Chrome window
 *
 * Resume: houses with a cached perfume list skip any perfume that already has
 * a verified detail cache. Fully-cached houses are skipped entirely.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright";
import { canonicalHouse, dedupeKey, norm, titleCase } from "./dataset-utils";

const ROOT = path.join(__dirname, "..");
const JSON_PATH = path.join(ROOT, "src", "data", "fragrances.json");
const CACHE = path.join(__dirname, "scentbase-cache");
const DESIGNERS_PATH = path.join(CACHE, "popular-designers.json");
const PERFUME_DIR = path.join(CACHE, "perfumes");
const DESIGNER_DIR = path.join(CACHE, "designers");
const BASE_URL = "https://thescentbase.com";
const LOCALE = "se";
const MIN_BOTTLE_EDGE = 80;

interface DesignerRef {
  name: string;
  slug: string;
  url: string;
}

interface PerfumeListItem {
  name: string;
  slug: string;
  brandSlug: string;
  url: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  imageVerifiedAt: string;
}

interface ScrapedPerfume {
  source: "thescentbase";
  sourceId: string;
  url: string;
  name: string;
  house: string;
  year: number;
  rating: number;
  price: number;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  accords: string[];
  description: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  imageVerifiedAt: string;
  longevity?: string;
  sillage?: string;
  scrapedAt: string;
}

interface FragranceOut {
  id: string;
  name: string;
  house: string;
  year: number;
  rating: number;
  price: number;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  accords: string[];
  description: string;
  votes?: number;
  imageUrl?: string;
  longevity?: string;
  sillage?: string;
}

interface BottleAudit {
  url: string;
  width: number;
  height: number;
}

function ensureDirs() {
  for (const dir of [CACHE, PERFUME_DIR, DESIGNER_DIR]) {
    mkdirSync(dir, { recursive: true });
  }
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8").replace(/^\uFEFF/, "")) as T;
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cacheFileFor(item: Pick<PerfumeListItem, "brandSlug" | "slug">): string {
  return path.join(PERFUME_DIR, `${item.brandSlug}--${item.slug}.json`);
}

function isPerfumeCached(item: Pick<PerfumeListItem, "brandSlug" | "slug">): boolean {
  if (hasFlag("--refresh")) return false;
  const cachePath = cacheFileFor(item);
  if (!existsSync(cachePath)) return false;
  try {
    return hasVerifiedBottle(readJsonFile<ScrapedPerfume>(cachePath));
  } catch {
    return false;
  }
}

function hasVerifiedBottle(
  value: Partial<Pick<ScrapedPerfume, "imageUrl" | "imageWidth" | "imageHeight" | "imageVerifiedAt">>,
): boolean {
  return (
    /^https:\/\/media\.thescentbase\.com\/perfumes\/.+\.(?:jpe?g|png|webp)(?:\?.*)?$/i.test(
      value.imageUrl || "",
    ) &&
    (value.imageWidth || 0) >= MIN_BOTTLE_EDGE &&
    (value.imageHeight || 0) >= MIN_BOTTLE_EDGE &&
    Boolean(value.imageVerifiedAt)
  );
}

async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: !hasFlag("--headed"),
    channel: "chrome",
  });
}

async function gotoWithRetry(page: Page, url: string): Promise<number> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 45_000,
      });
      const status = response?.status() || 0;
      if (status === 429) {
        const waitMs = attempt * 15_000;
        console.log(`  429 from The Scent Base; waiting ${waitMs / 1000}s...`);
        await sleep(waitMs);
        continue;
      }
      // Past-last listing pages 404; callers treat this as end of pagination.
      if (status === 404) return 404;
      if (status >= 400) throw new Error(`HTTP ${status} for ${url}`);
      await page.waitForSelector("body", { timeout: 15_000 });
      return status || 200;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await sleep(attempt * 3000);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`Could not load ${url}`);
}

async function harvestPopularDesigners(page: Page): Promise<DesignerRef[]> {
  await gotoWithRetry(page, `${BASE_URL}/${LOCALE}/brands`);
  const designers = (await page.evaluate(`(() => {
    const baseUrl = ${JSON.stringify(BASE_URL)};
    const locale = ${JSON.stringify(LOCALE)};
    const rows = new Map();
    const pattern = new RegExp("^/" + locale + "/perfumes/([^/?#]+)$", "i");
    for (const anchor of document.querySelectorAll("a[href]")) {
      const pathname = new URL(anchor.href, location.href).pathname.replace(/\\/$/, "");
      const match = pathname.match(pattern);
      if (!match) continue;
      const slug = match[1];
      const imageAlt = anchor.querySelector("img")?.alt.replace(/\\s+Logo$/i, "").trim();
      const name = (imageAlt || anchor.textContent || slug)
        .replace(/\\s+/g, " ")
        .trim();
      if (!name || rows.has(slug)) continue;
      rows.set(slug, {
        name,
        slug,
        url: baseUrl + "/" + locale + "/perfumes/" + slug,
      });
    }
    return [...rows.values()];
  })()`)) as DesignerRef[];
  if (!designers.length) throw new Error("No brands found on The Scent Base brand index.");
  writeFileSync(DESIGNERS_PATH, JSON.stringify(designers, null, 2) + "\n");
  return designers;
}

async function waitForListingImages(page: Page, brandSlug: string): Promise<void> {
  // String evaluation avoids tsx/esbuild injecting a private __name helper into
  // nested browser functions during Playwright serialization.
  const slugLiteral = JSON.stringify(brandSlug);
  await page.evaluate(`(async () => {
    const slug = ${slugLiteral};
    const selector = "main a[href*=\\"/perfumes/" + slug + "/\\"] img";
    const images = [...document.querySelectorAll(selector)];
    for (const image of images) image.scrollIntoView({ block: "center" });
    window.scrollTo(0, document.body.scrollHeight);
    await new Promise((resolve) => setTimeout(resolve, 500));
    await Promise.all(
      images.map(
        (image) =>
          new Promise((resolve) => {
            if (image.complete) return resolve();
            const done = () => resolve();
            image.addEventListener("load", done, { once: true });
            image.addEventListener("error", done, { once: true });
            setTimeout(done, 8000);
          }),
      ),
    );
  })()`);
}

async function scrapeDesignerPerfumeList(
  page: Page,
  designer: DesignerRef,
): Promise<PerfumeListItem[]> {
  const cachePath = path.join(DESIGNER_DIR, `${designer.slug}.json`);
  if (existsSync(cachePath) && !hasFlag("--refresh")) {
    const cached = readJsonFile<PerfumeListItem[]>(cachePath).filter(hasVerifiedBottle);
    if (!cached.length) {
      console.log(`  skip: empty listing (cache)`);
      return [];
    }
    console.log(`  listed ${cached.length} perfumes for ${designer.name} (cache)`);
    return cached;
  }

  const items = new Map<string, PerfumeListItem>();
  let pageNumber = 1;
  let expectedTotal = Number.POSITIVE_INFINITY;

  while (items.size < expectedTotal) {
    const url = pageNumber === 1 ? designer.url : `${designer.url}?page=${pageNumber}`;
    const status = await gotoWithRetry(page, url);
    if (status === 404) {
      if (pageNumber === 1) throw new Error(`HTTP 404 for ${url}`);
      console.log(`  page ${pageNumber}: 404, end of listing`);
      break;
    }
    await waitForListingImages(page, designer.slug);

    const result = (await page.evaluate(`(() => {
      const brandSlug = ${JSON.stringify(designer.slug)};
      const minEdge = ${MIN_BOTTLE_EDGE};
      const main = document.querySelector("main");
      if (!main) return { expectedTotal: null, rows: [] };
      const totalMatch = (main.textContent || "").match(/Showing\\s+\\d+\\s+of\\s+([\\d,]+)\\s+results/i);
      const expectedTotal = totalMatch
        ? Number(totalMatch[1].replace(/,/g, ""))
        : null;
      const pattern = new RegExp("/perfumes/" + brandSlug + "/([^/?#]+)$", "i");
      const rows = [];
      for (const anchor of main.querySelectorAll("a[href]")) {
        const pathname = new URL(anchor.href, location.href).pathname.replace(/\\/$/, "");
        const match = pathname.match(pattern);
        if (!match) continue;
        const image = anchor.querySelector("img");
        const imageUrl = (image && (image.currentSrc || image.src)) || "";
        const imageWidth = (image && image.naturalWidth) || 0;
        const imageHeight = (image && image.naturalHeight) || 0;
        if (
          !image ||
          !image.complete ||
          imageWidth < minEdge ||
          imageHeight < minEdge ||
          !/^https:\\/\\/media\\.thescentbase\\.com\\/perfumes\\//i.test(imageUrl)
        ) {
          continue;
        }
        const name = (image.alt || anchor.querySelector("p")?.textContent || match[1])
          .replace(/\\s+/g, " ")
          .trim();
        rows.push({
          name,
          slug: match[1],
          brandSlug,
          url: anchor.href,
          imageUrl,
          imageWidth,
          imageHeight,
          imageVerifiedAt: new Date().toISOString(),
        });
      }
      return { expectedTotal, rows };
    })()`)) as { expectedTotal: number | null; rows: PerfumeListItem[] };

    if (result.expectedTotal != null) {
      expectedTotal = result.expectedTotal;
    }
    if (result.expectedTotal === 0) {
      writeFileSync(cachePath, "[]\n");
      console.log(`  skip: listing has 0 results`);
      return [];
    }
    const before = items.size;
    for (const item of result.rows) items.set(item.slug, item);
    console.log(
      `  page ${pageNumber}: ${result.rows.length} verified bottles (${items.size}/${
        Number.isFinite(expectedTotal) ? expectedTotal : "?"
      })`,
    );

    if (result.rows.length === 0 || items.size === before) break;
    if (!Number.isFinite(expectedTotal) && result.rows.length < 50) break;
    pageNumber += 1;
  }

  const out = [...items.values()];
  if (!out.length) {
    // Empty or unverifiable listing — cache so resume skips this house.
    writeFileSync(cachePath, "[]\n");
    console.log(`  skip: no bottle-verified perfumes found on the listing`);
    return [];
  }
  if (Number.isFinite(expectedTotal) && out.length !== expectedTotal) {
    console.log(
      `  warning: site listed ${expectedTotal} but only ${out.length} bottles passed verification; caching verified ones.`,
    );
  }
  writeFileSync(cachePath, JSON.stringify(out, null, 2) + "\n");
  console.log(`  listed ${out.length} perfumes for ${designer.name}`);
  return out;
}

async function auditDetailBottle(page: Page, fallbackUrl: string): Promise<BottleAudit | null> {
  await page
    .waitForFunction(
      `(() => {
        const minEdge = ${MIN_BOTTLE_EDGE};
        const image = document.querySelector(
          '.middle-column img[src*="media.thescentbase.com/perfumes/"]',
        );
        return Boolean(
          image && image.complete && image.naturalWidth >= minEdge && image.naturalHeight >= minEdge,
        );
      })()`,
      undefined,
      { timeout: 12_000 },
    )
    .catch(() => null);

  return (await page.evaluate(`(() => {
    const fallbackUrl = ${JSON.stringify(fallbackUrl)};
    const minEdge = ${MIN_BOTTLE_EDGE};
    const image = document.querySelector(
      '.middle-column img[src*="media.thescentbase.com/perfumes/"]',
    );
    if (!image || !image.complete) return null;
    const url = image.currentSrc || image.src || fallbackUrl;
    if (
      !/^https:\\/\\/media\\.thescentbase\\.com\\/perfumes\\//i.test(url) ||
      image.naturalWidth < minEdge ||
      image.naturalHeight < minEdge
    ) {
      return null;
    }
    return { url, width: image.naturalWidth, height: image.naturalHeight };
  })()`)) as BottleAudit | null;
}

async function scrapePerfumePage(
  page: Page,
  item: PerfumeListItem,
  houseHint: string,
): Promise<ScrapedPerfume | null> {
  const cachePath = cacheFileFor(item);
  if (existsSync(cachePath) && !hasFlag("--refresh")) {
    try {
      const cached = readJsonFile<ScrapedPerfume>(cachePath);
      if (hasVerifiedBottle(cached)) return cached;
    } catch {
      // Re-fetch corrupt or incomplete cache entries.
    }
  }

  await gotoWithRetry(page, item.url);
  const detailBottle = await auditDetailBottle(page, item.imageUrl);
  if (!detailBottle) {
    console.log("detail bottle failed verification");
    return null;
  }
  if (new URL(detailBottle.url).pathname !== new URL(item.imageUrl).pathname) {
    console.log("listing/detail bottle mismatch");
    return null;
  }

  // String evaluation avoids tsx/esbuild adding its private __name helper to
  // nested browser functions during serialization.
  const raw = (await page.evaluate(`(() => {
    const text = (selector) =>
      (document.querySelector(selector)?.textContent || "").replace(/\\s+/g, " ").trim();
    const unique = (values) => [...new Set(values.filter(Boolean))];
    const notes = (className) => unique(
      [...document.querySelectorAll("." + className + " h4")].map((node) =>
        (node.textContent || "").replace(/\\s+/g, " ").trim()
      )
    );
    const summary = [...document.querySelectorAll(".ratings-summary.top span")].map((node) =>
      (node.textContent || "").replace(/\\s+/g, " ").trim()
    );
    const ratingText = summary.find((value) => /^Rated\\s/i.test(value)) || "";
    const ratingMatch = ratingText.match(/Rated\\s+([\\d.]+)\\s*\\/\\s*10/i);
    return {
      title: text("h1"),
      house: text(".brand-name"),
      year: Number((text(".release").match(/\\b(19\\d{2}|20\\d{2})\\b/) || [])[1] || 0),
      rating: ratingMatch ? Number(ratingMatch[1]) / 2 : 0,
      accords: unique(
        [...document.querySelectorAll('.accords a[href*="/accord/"]')].map((node) =>
          (node.textContent || "").replace(/\\s+/g, " ").trim()
        )
      ).slice(0, 10),
      topNotes: notes("top"),
      heartNotes: notes("heart"),
      baseNotes: notes("base"),
      description: text(".description p"),
      longevity: summary.find((value) => /hours|lasting|fleeting|average/i.test(value)),
      sillage: summary.find((value) => /projection|sillage|intimate|massive|cloud/i.test(value)),
    };
  })()`)) as {
    title: string;
    house: string;
    year: number;
    rating: number;
    accords: string[];
    topNotes: string[];
    heartNotes: string[];
    baseNotes: string[];
    description: string;
    longevity?: string;
    sillage?: string;
  };

  const house = canonicalHouse(raw.house || houseHint);
  const scraped: ScrapedPerfume = {
    source: "thescentbase",
    sourceId: `${item.brandSlug}/${item.slug}`,
    url: item.url,
    name: item.name,
    house,
    year: raw.year,
    rating: Number(raw.rating.toFixed(2)),
    price: 0,
    topNotes: raw.topNotes.map(titleCase),
    heartNotes: raw.heartNotes.map(titleCase),
    baseNotes: raw.baseNotes.map(titleCase),
    accords: raw.accords.map((accord) => accord.toLowerCase()),
    description: raw.description,
    imageUrl: detailBottle.url,
    imageWidth: detailBottle.width,
    imageHeight: detailBottle.height,
    imageVerifiedAt: new Date().toISOString(),
    longevity: raw.longevity,
    sillage: raw.sillage,
    scrapedAt: new Date().toISOString(),
  };
  writeFileSync(cachePath, JSON.stringify(scraped, null, 2) + "\n");
  return scraped;
}

function toCatalogEntry(perfume: ScrapedPerfume): FragranceOut {
  if (!hasVerifiedBottle(perfume)) {
    throw new Error(`Refusing to merge unverified bottle: ${perfume.house} ${perfume.name}`);
  }
  return {
    id: `scentbase-${perfume.sourceId.replace(/\//g, "-")}`,
    name: perfume.name,
    house: perfume.house,
    year: perfume.year,
    rating: perfume.rating,
    price: perfume.price,
    topNotes: perfume.topNotes,
    heartNotes: perfume.heartNotes,
    baseNotes: perfume.baseNotes,
    accords: perfume.accords,
    description: perfume.description,
    imageUrl: perfume.imageUrl,
    longevity: perfume.longevity,
    sillage: perfume.sillage,
  };
}

function mergeIntoCatalog(scraped: ScrapedPerfume[]): { added: number; enriched: number } {
  const verified = scraped.filter(hasVerifiedBottle);
  if (verified.length !== scraped.length) {
    throw new Error(
      `Bottle invariant failed: ${scraped.length - verified.length} cached perfume(s) lack verified images.`,
    );
  }
  const catalog = readJsonFile<FragranceOut[]>(JSON_PATH);
  const byKey = new Map(catalog.map((item) => [dedupeKey(item.name, item.house), item]));
  const byId = new Map(catalog.map((item) => [item.id, item]));
  let added = 0;
  let enriched = 0;

  const fill = <K extends keyof FragranceOut>(
    target: FragranceOut,
    key: K,
    value: FragranceOut[K],
  ) => {
    const current = target[key];
    const empty =
      current == null ||
      current === "" ||
      current === 0 ||
      (Array.isArray(current) && current.length === 0);
    if (empty && value != null && value !== "" && value !== 0) {
      target[key] = value;
      return true;
    }
    return false;
  };

  for (const perfume of verified) {
    const entry = toCatalogEntry(perfume);
    const key = dedupeKey(entry.name, entry.house);
    const existing = byId.get(entry.id) || byKey.get(key);
    if (!existing) {
      catalog.push(entry);
      byKey.set(key, entry);
      byId.set(entry.id, entry);
      added += 1;
      continue;
    }

    let changed = false;
    for (const field of [
      "year",
      "rating",
      "description",
      "imageUrl",
      "longevity",
      "sillage",
    ] as const) {
      changed = fill(existing, field, entry[field]) || changed;
    }
    for (const field of ["topNotes", "heartNotes", "baseNotes", "accords"] as const) {
      if (!existing[field]?.length && entry[field].length) {
        existing[field] = entry[field];
        changed = true;
      }
    }
    if (changed) enriched += 1;
  }

  writeFileSync(JSON_PATH, JSON.stringify(catalog) + "\n");
  return { added, enriched };
}

function loadCachedPerfumes(): ScrapedPerfume[] {
  if (!existsSync(PERFUME_DIR)) return [];
  const perfumes: ScrapedPerfume[] = [];
  for (const fileName of readdirSync(PERFUME_DIR).filter((name) => name.endsWith(".json"))) {
    try {
      const perfume = readJsonFile<ScrapedPerfume>(path.join(PERFUME_DIR, fileName));
      if (hasVerifiedBottle(perfume)) perfumes.push(perfume);
    } catch {
      console.log(`Skipping unreadable cache file: ${fileName}`);
    }
  }
  return perfumes;
}

const HOUSE_PRIORITY = [
  "louis vuitton",
  "chanel",
  "dior",
  "yves saint laurent",
  "tom ford",
  "creed",
  "hermes",
  "gucci",
  "prada",
  "nishane",
  "parfums de marly",
  "maison francis kurkdjian",
  "le labo",
  "byredo",
  "diptyque",
  "amouage",
  "xerjoff",
  "initio",
  "by kilian",
  "jean paul gaultier",
  "giorgio armani",
  "versace",
  "dolce gabbana",
  "burberry",
  "guerlain",
  "afnan",
  "lattafa",
  "armaf",
];

function resolveDesigners(all: DesignerRef[]): DesignerRef[] {
  let selected: DesignerRef[];
  if (hasFlag("--popular")) {
    selected = [...all].sort((left, right) => {
      const leftIndex = HOUSE_PRIORITY.findIndex((name) => norm(left.name).includes(norm(name)));
      const rightIndex = HOUSE_PRIORITY.findIndex((name) => norm(right.name).includes(norm(name)));
      const leftRank = leftIndex < 0 ? 10_000 : leftIndex;
      const rightRank = rightIndex < 0 ? 10_000 : rightIndex;
      return leftRank - rightRank || left.name.localeCompare(right.name);
    });
    const limit = Number(argValue("--limit-designers") || selected.length);
    selected = selected.slice(0, limit);
  } else {
    const requested = (argValue("--designers") || "")
      .split(",")
      .map((value) => norm(value.trim()))
      .filter(Boolean);
    selected = all.filter(
      (designer) => requested.includes(norm(designer.name)) || requested.includes(norm(designer.slug)),
    );
  }

  const skipped = new Set(
    (argValue("--skip-designers") || "")
      .split(",")
      .map((value) => norm(value.trim()))
      .filter(Boolean),
  );
  return selected.filter(
    (designer) => !skipped.has(norm(designer.name)) && !skipped.has(norm(designer.slug)),
  );
}

async function main() {
  ensureDirs();
  const mergeOnly = hasFlag("--merge") && !hasFlag("--popular") && !argValue("--designers");
  if (mergeOnly) {
    const cached = loadCachedPerfumes();
    const result = mergeIntoCatalog(cached);
    console.log(
      `Merged ${cached.length} bottle-verified perfumes: +${result.added} added, ${result.enriched} enriched.`,
    );
    return;
  }

  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, locale: "en-US" });
  try {
    const designers =
      existsSync(DESIGNERS_PATH) && !hasFlag("--refresh-designers")
        ? readJsonFile<DesignerRef[]>(DESIGNERS_PATH)
        : await harvestPopularDesigners(page);
    const selected = resolveDesigners(designers);
    if (!selected.length) {
      throw new Error("No designers matched. Use --popular or --designers Afnan,Dior.");
    }

    const delay = Number(argValue("--delay") || 750);
    const limitPerfumes = Number(argValue("--limit-perfumes") || 0);
    const scrapedThisRun: ScrapedPerfume[] = [];
    const failedImages: string[] = [];

    console.log(`Scraping ${selected.length} designer(s): ${selected.map((d) => d.name).join(", ")}`);
    let skippedHouses = 0;
    let skippedCachedPerfumes = 0;
    for (const designer of selected) {
      console.log(`\n${designer.name}`);
      const list = await scrapeDesignerPerfumeList(page, designer);
      if (list.length === 0) {
        skippedHouses += 1;
        continue;
      }
      const pending = list.filter((item) => !isPerfumeCached(item));
      const cachedCount = list.length - pending.length;
      skippedCachedPerfumes += cachedCount;

      if (pending.length === 0) {
        skippedHouses += 1;
        console.log(`  skip: all ${list.length} perfumes already cached`);
        continue;
      }

      if (cachedCount > 0) {
        console.log(`  ${cachedCount} already cached; scraping ${pending.length} remaining`);
      }

      const queue = limitPerfumes > 0 ? pending.slice(0, limitPerfumes) : pending;
      for (let index = 0; index < queue.length; index++) {
        const item = queue[index];
        process.stdout.write(`  [${index + 1}/${queue.length}] ${item.name}... `);
        try {
          const perfume = await scrapePerfumePage(page, item, designer.name);
          if (perfume) {
            scrapedThisRun.push(perfume);
            console.log(`ok, bottle ${perfume.imageWidth}x${perfume.imageHeight}`);
          } else {
            failedImages.push(`${designer.name} - ${item.name}`);
          }
        } catch (error) {
          console.log(`failed: ${error instanceof Error ? error.message : String(error)}`);
          failedImages.push(`${designer.name} - ${item.name}`);
        }
        if (index < queue.length - 1) await sleep(delay);
      }
    }

    if (skippedHouses || skippedCachedPerfumes) {
      console.log(
        `\nResume: skipped ${skippedHouses} fully-cached house(s), ${skippedCachedPerfumes} already-checked perfume(s).`,
      );
    }

    if (failedImages.length) {
      console.log(`\nSkipped ${failedImages.length} perfume(s) without double-verified bottles:`);
      for (const label of failedImages.slice(0, 20)) console.log(`  - ${label}`);
    }

    if (hasFlag("--merge")) {
      const cached = loadCachedPerfumes();
      const result = mergeIntoCatalog(cached);
      console.log(
        `\nMerged ${cached.length} bottle-verified perfumes: +${result.added} added, ${result.enriched} enriched.`,
      );
    } else {
      console.log(`\nCached ${scrapedThisRun.length} bottle-verified perfumes. Add --merge to update catalog.`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
