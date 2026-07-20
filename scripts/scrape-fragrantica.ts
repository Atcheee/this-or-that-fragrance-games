/**
 * Scrape Fragrantica designers → fragrance lists → perfume detail pages,
 * then merge into src/data/fragrances.json.
 *
 * Usage:
 *   npx tsx scripts/scrape-fragrantica.ts --designers Afnan
 *   npx tsx scripts/scrape-fragrantica.ts --popular --limit-designers 5
 *   npx tsx scripts/scrape-fragrantica.ts --designers Afnan,Dior --merge
 *   npx tsx scripts/scrape-fragrantica.ts --merge   # merge cache only
 *   npx tsx scripts/scrape-fragrantica.ts --popular --delay 3000 --merge
 *   npx tsx scripts/scrape-fragrantica.ts --merge   # merge cache only
 *   npx tsx scripts/scrape-fragrantica.ts --popular --cdp 9222 --merge  # optional: your Chrome
 *
 * By default each run (and each relaunch) uses a fresh throwaway Chrome profile.
 * If you get 429/blocked, Ctrl+C and re-run — you get a new session automatically.
 * Optional: --reuse-profile keeps the old persistent profile; --cdp uses your real Chrome.
 * --popular scrapes well-known houses first (LV, Chanel, Dior, YSL…), mass-market last.
 *
 * Caches HTML-derived JSON under scripts/fragrantica-cache/ so re-runs are free.
 * Be polite: default delay is 2.5s between perfume pages.
 * --popular skips designers whose perfume caches already look complete.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  readdirSync,
} from "node:fs";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { canonicalHouse, dedupeKey, norm, titleCase } from "./dataset-utils";

const ROOT = path.join(__dirname, "..");
const JSON_PATH = path.join(ROOT, "src", "data", "fragrances.json");
const CACHE = path.join(__dirname, "fragrantica-cache");
const DESIGNERS_PATH = path.join(CACHE, "popular-designers.json");
const PERFUME_DIR = path.join(CACHE, "perfumes");
const DESIGNER_DIR = path.join(CACHE, "designers");
const BROWSER_PROFILE = path.join(CACHE, "chrome-profile"); // legacy / --reuse-profile
const BROWSER_SESSIONS = path.join(CACHE, "chrome-sessions");
const EXTRACT_PERFUME_JS = readFileSync(
  path.join(__dirname, "fragrantica-extract-perfume.js"),
  "utf8",
);

type WearKey = "winter" | "spring" | "summer" | "fall" | "day" | "night";

interface DesignerRef {
  name: string;
  slug: string;
  url: string;
  count?: number | null;
}

interface PerfumeListItem {
  name: string;
  url: string;
  fragranticaId: number;
  year?: number | null;
}

interface ScrapedPerfume {
  fragranticaId: number;
  url: string;
  name: string;
  house: string;
  year: number;
  rating: number;
  votes: number;
  price: number;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  accords: string[];
  description: string;
  imageUrl?: string;
  longevity?: string;
  sillage?: string;
  wear?: Partial<Record<WearKey, number>>;
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
  wear?: Partial<Record<WearKey, number>>;
}

function ensureDirs() {
  for (const dir of [CACHE, PERFUME_DIR, DESIGNER_DIR]) {
    mkdirSync(dir, { recursive: true });
  }
}

function readJsonFile<T>(filePath: string): T {
  const raw = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw) as T;
}

function argValue(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0) return undefined;
  return process.argv[i + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseCount(raw: string): number {
  const s = raw.trim().toLowerCase().replace(/,/g, "");
  if (s.endsWith("k")) return Math.round(parseFloat(s) * 1000);
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function splitNotes(raw?: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(/,| and /i)
    .map((s) => titleCase(s.trim()))
    .filter(Boolean);
}

function normalizeWear(
  votes: Partial<Record<WearKey, number>>,
): Partial<Record<WearKey, number>> | undefined {
  const keys: WearKey[] = ["winter", "spring", "summer", "fall", "day", "night"];
  const present = keys.filter((k) => (votes[k] ?? 0) > 0);
  if (present.length === 0) return undefined;
  const total = present.reduce((a, k) => a + (votes[k] ?? 0), 0) || 1;
  const out: Partial<Record<WearKey, number>> = {};
  for (const k of present) out[k] = Number(((votes[k] ?? 0) / total).toFixed(3));
  return out;
}

type BrowserSession = {
  page: Page;
  /** Disconnect / close; deletes throwaway profile dirs. */
  close: () => Promise<void>;
  mode: "ephemeral" | "reuse" | "cdp";
  profileDir?: string;
};

function cleanupOldSessions() {
  if (!existsSync(BROWSER_SESSIONS)) return;
  const cutoff = Date.now() - 24 * 60 * 60_000;
  for (const name of readdirSync(BROWSER_SESSIONS)) {
    const dir = path.join(BROWSER_SESSIONS, name);
    try {
      const stamp = Number(name.split("-")[0]);
      if (!Number.isFinite(stamp) || stamp < cutoff) {
        rmSync(dir, { recursive: true, force: true });
      }
    } catch {
      /* ignore */
    }
  }
}

async function launchBrowser(): Promise<BrowserSession> {
  const cdpPort = argValue("--cdp");
  if (cdpPort) {
    const endpoint = cdpPort.includes("://")
      ? cdpPort
      : `http://127.0.0.1:${cdpPort}`;
    console.log(`Connecting to your Chrome via CDP at ${endpoint}…`);
    let browser: Browser;
    try {
      browser = await chromium.connectOverCDP(endpoint);
    } catch (err) {
      throw new Error(
        `Could not connect to Chrome at ${endpoint}.\n` +
          `Fully quit Chrome, then start it with:\n` +
          `  & "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=${cdpPort.replace(/\D/g, "") || "9222"}\n` +
          `Open fragrantica.com there, then re-run with --cdp ${cdpPort}.\n` +
          `Details: ${(err as Error).message}`,
      );
    }
    const context: BrowserContext =
      browser.contexts()[0] || (await browser.newContext());
    const page = context.pages()[0] || (await context.newPage());
    return {
      page,
      mode: "cdp",
      close: async () => {
        await browser.close().catch(() => null);
      },
    };
  }

  cleanupOldSessions();

  let profileDir: string;
  let mode: "ephemeral" | "reuse";
  if (hasFlag("--reuse-profile")) {
    profileDir = BROWSER_PROFILE;
    mode = "reuse";
    if (hasFlag("--reset-profile") && existsSync(profileDir)) {
      console.log("Resetting reusable Chrome profile…");
      rmSync(profileDir, { recursive: true, force: true });
    }
    console.log(`Using reusable Chrome profile → ${profileDir}`);
  } else {
    mkdirSync(BROWSER_SESSIONS, { recursive: true });
    profileDir = path.join(
      BROWSER_SESSIONS,
      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    );
    mode = "ephemeral";
    console.log(`Fresh Chrome session → ${path.basename(profileDir)}`);
  }

  mkdirSync(profileDir, { recursive: true });
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: "chrome",
    args: ["--disable-blink-features=AutomationControlled"],
    locale: "en-US",
    viewport: { width: 1280, height: 900 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  const page = context.pages()[0] || (await context.newPage());
  return {
    page,
    mode,
    profileDir,
    close: async () => {
      await context.close().catch(() => null);
      if (mode === "ephemeral" && profileDir && existsSync(profileDir)) {
        rmSync(profileDir, { recursive: true, force: true });
      }
    },
  };
}

async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const session = await launchBrowser();
  try {
    return await fn(session.page);
  } finally {
    await session.close();
  }
}

function isBrowserClosedError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /has been closed|Target closed|Browser closed|context\.close/i.test(msg);
}

async function pageGate(page: Page): Promise<{
  rateLimited: boolean;
  challenge: boolean;
  hasContent: boolean;
}> {
  return (await page.evaluate(`(() => {
    const title = (document.title || "").trim();
    const body = document.body ? document.body.innerText : "";
    const html = document.body ? document.body.innerHTML : "";
    const head = (title + "\\n" + body.slice(0, 600)).trim();
    // Do NOT match bare "429" in the full page — perfume IDs/URLs often contain those digits.
    const rateLimited =
      /too many requests/i.test(head) ||
      /^429\\b/.test(title) ||
      /^429\\b/.test(body.trim()) ||
      (/\\b429\\b/.test(title) && !/perfume|fragrantica|cologne|fragrance/i.test(title));
    const hasContent =
      /Perfume rating|main accords|USER RATINGS|\\/perfume\\/|\\/designers\\//i.test(
        body + " " + html,
      );
    const challenge =
      /just a moment|verifying you are human|security verification|attention required|enable javascript and cookies/i.test(
        title + " " + body.slice(0, 800),
      );
    return {
      rateLimited: rateLimited && !hasContent,
      challenge: challenge && !hasContent,
      hasContent,
    };
  })()`)) as {
    rateLimited: boolean;
    challenge: boolean;
    hasContent: boolean;
  };
}

/** Thrown when Fragrantica 429s an ephemeral session — caller should relaunch fresh. */
class SessionBlockedError extends Error {
  constructor(reason: string) {
    super(`SESSION_BLOCKED_429: ${reason}`);
    this.name = "SessionBlockedError";
  }
}

function isSessionBlockedError(err: unknown): boolean {
  return err instanceof SessionBlockedError ||
    /SESSION_BLOCKED_429/i.test(err instanceof Error ? err.message : String(err));
}

/** Long polite pause when Fragrantica returns 429 (reuse-profile / cdp only). */
async function waitOutRateLimit(attempt: number, reason: string) {
  const minutes = Math.min(180, 30 * attempt);
  console.log(
    `\n⛔ 429 Too Many Requests (${reason}).`,
    `\n  Pausing ${minutes} min (attempt ${attempt}). Ctrl+C to abort.\n`,
  );
  await sleep(minutes * 60_000);
}

function preferFreshSessionOn429(): boolean {
  // Mid-run profile rotation does NOT clear perfume-page 429s.
  return false;
}

/** Wait out Cloudflare interstitial; pause for manual solve if needed. */
async function waitForRealPage(page: Page) {
  await page.waitForSelector("body", { timeout: 15_000 }).catch(() => null);
  let warned = false;
  let rateAttempt = 0;
  const deadline = Date.now() + 15 * 60_000; // CF solve window
  while (true) {
    if (page.isClosed()) {
      throw new Error(
        "Chrome window was closed during wait. Leave the scraper Chrome window open, then re-run.",
      );
    }
    let gate: Awaited<ReturnType<typeof pageGate>>;
    try {
      gate = await pageGate(page);
    } catch (err) {
      if (isBrowserClosedError(err)) {
        throw new Error(
          "Chrome window was closed during wait. Leave the scraper Chrome window open, then re-run.",
        );
      }
      throw err;
    }

    if (gate.rateLimited) {
      // Always surface 429 to the caller — do not sit here for hours or rotate blindly.
      throw new SessionBlockedError("page load");
    }

    if (!gate.challenge && gate.hasContent) return;

    if (gate.challenge && !warned) {
      warned = true;
      console.log(
        "\n⚠ Cloudflare challenge detected — waiting does NOT clear this by itself.",
        "\n  1. Turn VPN OFF (or switch to a residential/home IP)",
        "\n  2. In the open Chrome window, click the human-check / checkbox",
        "\n  3. Do NOT close that Chrome window",
        "\n  4. Scraper resumes automatically once Fragrantica loads (up to 15 min)\n",
      );
    }

    if (!gate.challenge && !gate.hasContent && Date.now() > deadline) {
      throw new Error(
        "Page never loaded Fragrantica content. Check the Chrome window and re-run.",
      );
    }
    if (gate.challenge && Date.now() > deadline) {
      throw new Error(
        "Still on Cloudflare after 15 minutes. Turn VPN off, solve the check in the scraper Chrome window, then re-run.",
      );
    }
    await page.waitForTimeout(2000);
  }
}

/** Open Fragrantica and verify perfume pages aren't 429'd. */
async function warmupFragrantica(page: Page) {
  console.log("Warming up Fragrantica session…");
  await page.goto("https://www.fragrantica.com/", {
    waitUntil: "commit",
    timeout: 45_000,
  });
  await waitForRealPage(page);

  // Homepage often works while /perfume/ is still blocked — probe a real page.
  const probeUrl =
    pickWarmupPerfumeUrl() ||
    "https://www.fragrantica.com/perfume/Marc-Antoine-Barrois/Ganymede-52001.html";
  console.log(`Probing perfume access → ${probeUrl}`);
  await page.goto(probeUrl, { waitUntil: "commit", timeout: 45_000 });
  await page.waitForTimeout(1200);
  const gate = await pageGate(page);
  if (gate.rateLimited) {
    throw new Error(
      "Homepage loads, but perfume pages return 429.\n" +
        "Fresh Chrome profiles will NOT fix this — Fragrantica is throttling perfume URLs for this scraper.\n\n" +
        "Options:\n" +
        "  1. Wait several hours, then re-run with --delay 6000\n" +
        "  2. Use your normal Chrome (it already works):\n" +
        "       .\\scripts\\start-chrome-debug.ps1\n" +
        "       npx tsx scripts/scrape-fragrantica.ts --popular --delay 4000 --merge --cdp 9222\n",
    );
  }
  if (gate.challenge) {
    await waitForRealPage(page);
  }
  console.log("Session OK (perfume pages reachable) — starting scrape.\n");
}

function pickWarmupPerfumeUrl(): string | null {
  try {
    if (!existsSync(PERFUME_DIR)) return null;
    const files = readdirSync(PERFUME_DIR).filter((f) => f.endsWith(".json"));
    if (!files.length) return null;
    const sample = JSON.parse(
      readFileSync(
        path.join(PERFUME_DIR, files[0]),
        "utf8",
      ).replace(/^\uFEFF/, ""),
    ) as { url?: string };
    return sample.url || null;
  } catch {
    return null;
  }
}

async function harvestPopularDesigners(page: Page): Promise<DesignerRef[]> {
  await page.goto("https://www.fragrantica.com/designers/", {
    waitUntil: "commit",
    timeout: 30_000,
  });
  await waitForRealPage(page);
  await page.waitForTimeout(1000);
  const designers = (await page.evaluate(`(() => {
    const map = new Map();
    for (const a of document.querySelectorAll('a[href*="/designers/"]')) {
      const href = a.getAttribute("href") || "";
      const m = href.match(/\\/designers\\/([^/?#]+)\\.html$/i);
      if (!m) continue;
      const name = (a.textContent || "").replace(/\\s+/g, " ").trim();
      if (!name || name.length > 80) continue;
      let count = null;
      const card = a.closest("div") && a.closest("div").parentElement
        ? a.closest("div").parentElement
        : a.parentElement;
      const nums = (card && card.innerText ? card.innerText : "").match(/\\b(\\d{1,5})\\b/g);
      if (nums) {
        const candidates = nums
          .map(Number)
          .filter((n) => n > 0 && n < 50000)
          .sort((x, y) => y - x);
        count = candidates[0] || null;
      }
      const row = {
        name,
        slug: m[1],
        url: new URL(href, location.href).href,
        count,
      };
      if (!map.has(row.slug) || (row.count && !(map.get(row.slug) || {}).count)) {
        map.set(row.slug, row);
      }
    }
    return [...map.values()].sort((a, b) => (b.count || 0) - (a.count || 0));
  })()`)) as DesignerRef[];
  writeFileSync(DESIGNERS_PATH, JSON.stringify(designers, null, 2) + "\n");
  return designers;
}

async function scrapeDesignerPerfumeList(
  page: Page,
  designer: DesignerRef,
): Promise<PerfumeListItem[]> {
  const cachePath = path.join(DESIGNER_DIR, `${designer.slug}.json`);
  const houseSlug = designer.slug.toLowerCase();

  const keepOwnHouse = (items: PerfumeListItem[]) =>
    items.filter((item) => {
      const m = item.url.match(/\/perfume\/([^/]+)\//i);
      return !!m && m[1].toLowerCase() === houseSlug;
    });

  if (existsSync(cachePath) && !hasFlag("--refresh")) {
    const cached = keepOwnHouse(
      readJsonFile<PerfumeListItem[]>(cachePath),
    );
    // Rewrite if older caches mixed in "also liked" perfumes
    writeFileSync(cachePath, JSON.stringify(cached, null, 2) + "\n");
    console.log(`  listed ${cached.length} perfumes for ${designer.name} (cache)`);
    return cached;
  }

  await page.goto(designer.url, {
    waitUntil: "commit",
    timeout: 45_000,
  });
  await waitForRealPage(page);
  await page.waitForTimeout(1500);

  // Click "All Fragrances" / popularity filters if present
  const allBtn = page
    .locator("text=/^All Fragrances$/i")
    .or(page.locator('a:has-text("All Fragrances")'))
    .first();
  if (await allBtn.count()) {
    await allBtn.click({ timeout: 5_000 }).catch(() => null);
    await page.waitForTimeout(1500);
  }

  // Scroll to trigger lazy-loaded list rows
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => window.scrollBy(0, 1800));
    await page.waitForTimeout(350);
  }

  const items = keepOwnHouse(
    (await page.evaluate(`(() => {
    const houseSlug = ${JSON.stringify(designer.slug)};
    const out = [];
    const seen = new Set();

    function consider(href, nameHint, yearHint) {
      const m = href.match(/\\/perfume\\/([^/]+)\\/([^/]+)-(\\d+)\\.html/i);
      if (!m) return;
      if (String(m[1]).toLowerCase() !== String(houseSlug).toLowerCase()) return;
      const id = Number(m[3]);
      if (!Number.isFinite(id) || seen.has(id)) return;
      seen.add(id);
      let name = String(nameHint || "").replace(/\\s+/g, " ").trim();
      if (!name || name.length > 80) {
        name = decodeURIComponent(m[2]).replace(/-/g, " ").replace(/\\s+/g, " ").trim();
      }
      name = name
        .replace(/\\s+for (men|women|unisex)\\s*$/i, "")
        .replace(/\\s+\\d{4}\\s*$/, "")
        .trim();
      if (!name || name.length > 120) return;
      const yearMatch = String(yearHint || "").match(/\\b(19\\d{2}|20\\d{2})\\b/);
      out.push({
        name,
        url: new URL(href, location.href).href,
        fragranticaId: id,
        year: yearMatch ? Number(yearMatch[1]) : null,
      });
    }

    for (const a of document.querySelectorAll("a[href]")) {
      const href = a.href || a.getAttribute("href") || "";
      if (!/\\/perfume\\//i.test(href)) continue;
      // Prefer the link's own text — card text often includes forum spam
      const linkText = (a.textContent || "").replace(/\\s+/g, " ").trim();
      const card = a.closest("div,li,article,tr");
      const cardText = card && card.textContent ? card.textContent : "";
      consider(href, linkText, cardText);
    }

    const html = document.documentElement.innerHTML;
    const re = /\\/perfume\\/[^"'\\\\\\s]+\\/[^"'\\\\\\s]+-(\\d+)\\.html/gi;
    let m;
    while ((m = re.exec(html))) {
      consider(m[0], "", "");
    }

    return out;
  })()`)) as PerfumeListItem[],
  );

  writeFileSync(cachePath, JSON.stringify(items, null, 2) + "\n");
  console.log(`  listed ${items.length} perfumes for ${designer.name}`);
  return items;
}

function perfumeCacheLooksGood(p: ScrapedPerfume): boolean {
  const notes =
    (p.topNotes?.length || 0) +
    (p.heartNotes?.length || 0) +
    (p.baseNotes?.length || 0);
  return (
    p.rating > 0 ||
    notes > 0 ||
    (p.accords?.length || 0) > 0 ||
    (p.votes || 0) > 0 ||
    (!!p.description && p.description.length > 40)
  );
}

function isDesignerComplete(designer: DesignerRef): boolean {
  const cachePath = path.join(DESIGNER_DIR, `${designer.slug}.json`);
  if (!existsSync(cachePath)) return false;
  const list = readJsonFile<PerfumeListItem[]>(cachePath);
  if (list.length === 0) return false;
  // Presence-based: every listed perfume has a cache file. Thin/empty
  // files are re-fetched individually by perfumeCacheLooksGood.
  return list.every((item) =>
    existsSync(path.join(PERFUME_DIR, `${item.fragranticaId}.json`)),
  );
}

async function scrapePerfumePage(
  page: Page,
  item: PerfumeListItem,
  houseHint: string,
): Promise<ScrapedPerfume | null> {
  const cachePath = path.join(PERFUME_DIR, `${item.fragranticaId}.json`);
  if (existsSync(cachePath) && !hasFlag("--refresh")) {
    const cached = JSON.parse(
      readFileSync(cachePath, "utf8"),
    ) as ScrapedPerfume;
    // Re-fetch empties caused by 429 / Cloudflare
    if (perfumeCacheLooksGood(cached)) return cached;
  }

  for (let attempt = 1; attempt <= 4; attempt++) {
    await page.goto(item.url, {
      waitUntil: "commit",
      timeout: 30_000,
    });
    try {
      await waitForRealPage(page);
    } catch (err) {
      if (!isSessionBlockedError(err)) throw err;
      const minutes = Math.min(45, 5 * attempt);
      console.log(
        `\n    ⛔ 429 on perfume — pausing ${minutes} min (attempt ${attempt}/4), same session…`,
      );
      if (attempt === 4) {
        throw new Error(
          "Perfume pages still return 429 after cool-downs. Stop for several hours, or use --cdp 9222 with your normal Chrome (.\\scripts\\start-chrome-debug.ps1).",
        );
      }
      await sleep(minutes * 60_000);
      continue;
    }
    await page
      .waitForFunction(
        `() => /Perfume rating|main accords|USER RATINGS|Too Many Requests/i.test(document.body && document.body.innerText || "")`,
        { timeout: 20_000 },
      )
      .catch(() => null);
    await page.waitForTimeout(500);

    const gate = await pageGate(page);

    if (gate.rateLimited) {
      const minutes = Math.min(45, 5 * attempt);
      console.log(
        `\n    ⛔ 429 on perfume — pausing ${minutes} min (attempt ${attempt}/4), same session…`,
      );
      if (attempt === 4) {
        throw new Error(
          "Perfume pages still return 429 after cool-downs. Stop for several hours, or use --cdp 9222 with your normal Chrome (.\\scripts\\start-chrome-debug.ps1).",
        );
      }
      await sleep(minutes * 60_000);
      continue;
    }
    if (gate.challenge) {
      console.log("\n    Cloudflare challenge — waiting for manual pass…");
      await waitForRealPage(page);
    }

    const raw = (await page.evaluate(`(() => {
    ${EXTRACT_PERFUME_JS}
    return extractPerfumePage();
  })()`)) as {
      h1: string;
      house: string;
      year: string | null;
      description: string;
      accords: string[];
      wearRaw: Record<string, string>;
      rating: string | null;
      votes: string | null;
      top: string | null;
      middle: string | null;
      base: string | null;
      flatNotes: string[];
      bottle: string | null;
      longevity: string | null;
      sillage: string | null;
    };

    // Many obscure pages have accords/notes but no "Perfume rating X out of 5" line.
    const pageLoaded =
      !!raw &&
      (!!raw.rating ||
        (raw.accords && raw.accords.length > 0) ||
        !!raw.description ||
        (raw.flatNotes && raw.flatNotes.length > 0) ||
        !!raw.h1);

    if (!pageLoaded) {
      const debug = await page.evaluate(`(() => ({
      title: document.title,
      len: document.body ? document.body.innerText.length : 0,
      hasRating: /Perfume rating/i.test(document.body ? document.body.innerText : ""),
      snippet: document.body ? document.body.innerText.slice(0, 400) : ""
    }))()`);
      console.log(`\n    debug extract miss: ${JSON.stringify(debug)}`);
      if (attempt < 4) {
        await sleep(15_000 * attempt);
        continue;
      }
      return null;
    }

    if (!raw) return null;

    const house = canonicalHouse(raw.house || houseHint);
    let name = "";
    if (raw.h1 && !/fragrantica\.com/i.test(raw.h1)) {
      name = raw.h1;
    } else {
      name = item.name;
    }
    name = name.replace(/\s+/g, " ").trim();
    name = name.replace(
      /\s+for (women and men|men and women|women|men|unisex)\s*$/i,
      "",
    );
    name = name
      .replace(
        new RegExp(
          `\\s*${house.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}\\s*$`,
          "i",
        ),
        "",
      )
      .trim();
    name = name
      .replace(/\s+(19\d{2}|20\d{2})\s*(male|female|unisex)?\s*\d*\s*$/i, "")
      .replace(/\s+(male|female|unisex)\s*\d*\s*$/i, "")
      .trim();

    const wearVotes: Partial<Record<WearKey, number>> = {};
    for (const k of [
      "winter",
      "spring",
      "summer",
      "fall",
      "day",
      "night",
    ] as WearKey[]) {
      if (raw.wearRaw?.[k]) wearVotes[k] = parseCount(raw.wearRaw[k]!);
    }

    let topNotes = splitNotes(raw.top);
    let heartNotes = splitNotes(raw.middle);
    let baseNotes = splitNotes(raw.base);
    if (
      topNotes.length + heartNotes.length + baseNotes.length === 0 &&
      raw.flatNotes?.length
    ) {
      // No pyramid — keep flat notes in heartNotes so games still see them
      heartNotes = raw.flatNotes.map((n) => titleCase(n));
    }

    const fragranticaId = item.fragranticaId;
    const scraped: ScrapedPerfume = {
      fragranticaId,
      url: item.url,
      name: name || item.name,
      house,
      year: Number(raw.year || item.year || 0) || 0,
      rating: Number(raw.rating || 0) || 0,
      votes: parseCount(String(raw.votes || "0")),
      price: 0,
      topNotes,
      heartNotes,
      baseNotes,
      accords: (raw.accords || []).slice(0, 10),
      description: raw.description || "",
      imageUrl:
        raw.bottle ||
        `https://fimgs.net/mdimg/perfume/375x500.${fragranticaId}.jpg`,
      longevity: raw.longevity
        ? titleCase(raw.longevity.replace(/ lasting/i, " Lasting"))
        : undefined,
      sillage: raw.sillage ? titleCase(raw.sillage) : undefined,
      wear: normalizeWear(wearVotes),
      scrapedAt: new Date().toISOString(),
    };

    writeFileSync(cachePath, JSON.stringify(scraped, null, 2) + "\n");
    return scraped;
  }

  return null;
}

function toCatalogEntry(p: ScrapedPerfume): FragranceOut {
  return {
    id: `fragrantica-${p.fragranticaId}`,
    name: p.name,
    house: p.house,
    year: p.year,
    rating: p.rating,
    price: p.price,
    topNotes: p.topNotes,
    heartNotes: p.heartNotes,
    baseNotes: p.baseNotes,
    accords: p.accords,
    description: p.description,
    votes: p.votes || undefined,
    imageUrl: p.imageUrl,
    longevity: p.longevity,
    sillage: p.sillage,
    wear: p.wear,
  };
}

function mergeIntoCatalog(scraped: ScrapedPerfume[]): {
  added: number;
  enriched: number;
} {
  const catalog = JSON.parse(readFileSync(JSON_PATH, "utf8")) as FragranceOut[];
  const byKey = new Map(catalog.map((f) => [dedupeKey(f.name, f.house), f]));
  const byId = new Map(catalog.map((f) => [f.id, f]));

  let added = 0;
  let enriched = 0;

  const fill = <K extends keyof FragranceOut>(
    target: FragranceOut,
    key: K,
    value: FragranceOut[K],
  ) => {
    const cur = target[key];
    const empty =
      cur == null ||
      cur === "" ||
      cur === 0 ||
      (Array.isArray(cur) && cur.length === 0);
    if (empty && value != null && value !== "" && value !== 0) {
      target[key] = value;
      return true;
    }
    return false;
  };

  for (const p of scraped) {
    const entry = toCatalogEntry(p);
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
    changed = fill(existing, "year", entry.year) || changed;
    changed = fill(existing, "rating", entry.rating) || changed;
    changed = fill(existing, "votes", entry.votes) || changed;
    changed = fill(existing, "description", entry.description) || changed;
    changed = fill(existing, "imageUrl", entry.imageUrl) || changed;
    changed = fill(existing, "longevity", entry.longevity) || changed;
    changed = fill(existing, "sillage", entry.sillage) || changed;
    changed = fill(existing, "wear", entry.wear) || changed;
    if (!existing.topNotes?.length && entry.topNotes.length) {
      existing.topNotes = entry.topNotes;
      changed = true;
    }
    if (!existing.heartNotes?.length && entry.heartNotes.length) {
      existing.heartNotes = entry.heartNotes;
      changed = true;
    }
    if (!existing.baseNotes?.length && entry.baseNotes.length) {
      existing.baseNotes = entry.baseNotes;
      changed = true;
    }
    if (!existing.accords?.length && entry.accords.length) {
      existing.accords = entry.accords;
      changed = true;
    }
    if (changed) enriched += 1;
  }

  writeFileSync(JSON_PATH, JSON.stringify(catalog) + "\n");
  return { added, enriched };
}

function loadCachedPerfumes(): ScrapedPerfume[] {
  if (!existsSync(PERFUME_DIR)) return [];
  const { readdirSync } = require("node:fs") as typeof import("node:fs");
  return readdirSync(PERFUME_DIR)
    .filter((f) => f.endsWith(".json"))
    .map(
      (f) =>
        JSON.parse(
          readFileSync(path.join(PERFUME_DIR, f), "utf8"),
        ) as ScrapedPerfume,
    );
}

function designerPerfumeEstimate(d: DesignerRef): number {
  const cachePath = path.join(DESIGNER_DIR, `${d.slug}.json`);
  if (existsSync(cachePath)) {
    try {
      return readJsonFile<PerfumeListItem[]>(cachePath).length;
    } catch {
      /* fall through */
    }
  }
  return d.count && d.count > 0 ? d.count : Number.MAX_SAFE_INTEGER;
}

/** Well-known / high-interest houses first (scrape order). Matched via substring on name/slug. */
const HOUSE_PRIORITY: string[] = [
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
  "kilian",
  "jean paul gaultier",
  "giorgio armani",
  "versace",
  "dolce",
  "burberry",
  "jo malone",
  "guerlain",
  "bvlgari",
  "valentino",
  "mugler",
  "lancome",
  "carolina herrera",
  "acqua di parma",
  "serge lutens",
  "frederic malle",
  "penhaligon",
  "maison martin margiela",
  "montale",
  "mancera",
  "ex nihilo",
  "memo paris",
  "chloe",
  "narciso rodriguez",
  "etat libre",
  "zoologist",
  "nasomatto",
  "orto parisi",
  "bdk",
  "juliette has a gun",
  "kayali",
  "afnan",
  "lattafa",
  "armaf",
  "rasasi",
  "al haramain",
  "maison alhambra",
  "swiss arabian",
  "french avenue",
  "roja",
  "bond no",
  "clive christian",
  "boadicea",
  "tiziana terenzi",
  "sospiro",
  "casamorati",
  "marc antoine barrois",
  "givenchy",
  "hugo boss",
  "rabanne",
  "calvin klein",
  "issey miyake",
  "kenzo",
  "montblanc",
  "loewe",
  "marc jacobs",
  "van cleef",
  "ralph lauren",
  "azzaro",
  "lalique",
  "viktor",
  "comme des garcons",
  "l artisan",
];

/** Mass-market / huge catalogs last. */
const HOUSE_LAST: string[] = [
  "avon",
  "zara",
  "victoria s secret",
  "bath body works",
  "o boticario",
  "natura",
  "demeter",
  "fragrance world",
  "lush",
  "gulf orchid",
  "paris corner",
  "britney spears",
  "ariana grande",
  "elizabeth arden",
  "sol de janeiro",
  "phlur",
  "granado",
];

function houseMatchNeedle(d: DesignerRef, needle: string): boolean {
  const n = norm(needle);
  const name = norm(d.name);
  const slug = norm(d.slug.replace(/-/g, " "));
  return name === n || slug === n || name.includes(n) || slug.includes(n);
}

function popularitySortIndex(d: DesignerRef): number {
  const pri = HOUSE_PRIORITY.findIndex((p) => houseMatchNeedle(d, p));
  if (pri >= 0) return pri;
  const last = HOUSE_LAST.findIndex((p) => houseMatchNeedle(d, p));
  if (last >= 0) return 10_000 + last;
  // Unknown / lesser-known: after priority, before mass-market
  return 5_000 + designerPerfumeEstimate(d);
}

function resolveDesigners(all: DesignerRef[]): DesignerRef[] {
  let selected: DesignerRef[] = [];
  if (hasFlag("--popular")) {
    const limit = Number(argValue("--limit-designers") || all.length);
    selected = all.slice(0, limit);
  } else {
    const raw = argValue("--designers");
    if (!raw) return [];
    const wanted = raw.split(",").map((s) => norm(s.trim())).filter(Boolean);
    selected = all.filter(
      (d) =>
        wanted.includes(norm(d.name)) ||
        wanted.includes(norm(d.slug)) ||
        wanted.includes(norm(d.slug.replace(/-/g, " "))),
    );
  }

  const skipRaw = argValue("--skip-designers");
  if (skipRaw) {
    const skip = new Set(
      skipRaw.split(",").map((s) => norm(s.trim())).filter(Boolean),
    );
    selected = selected.filter(
      (d) =>
        !skip.has(norm(d.name)) &&
        !skip.has(norm(d.slug)) &&
        !skip.has(norm(d.slug.replace(/-/g, " "))),
    );
  }

  // Well-known / popular houses first; mass-market catalogs last.
  if (hasFlag("--popular")) {
    selected = [...selected].sort((a, b) => {
      const diff = popularitySortIndex(a) - popularitySortIndex(b);
      if (diff !== 0) return diff;
      return norm(a.name).localeCompare(norm(b.name));
    });
    console.log(
      `Order: well-known first. Next up: ${selected
        .slice(0, 8)
        .map((d) => d.name)
        .join(", ")}${selected.length > 8 ? "…" : ""}`,
    );
  }

  // On --popular, skip houses whose perfume caches already look complete
  if (hasFlag("--popular") && !hasFlag("--refresh")) {
    const pending: DesignerRef[] = [];
    const done: string[] = [];
    for (const d of selected) {
      if (isDesignerComplete(d)) done.push(d.name);
      else pending.push(d);
    }
    if (done.length) {
      console.log(
        `Skipping ${done.length} already-complete designer(s): ${done.slice(0, 8).join(", ")}${done.length > 8 ? "…" : ""}`,
      );
    }
    selected = pending;
  }

  return selected;
}

async function main() {
  ensureDirs();
  const delay = Number(argValue("--delay") || 2500);
  const limitPerfumes = Number(argValue("--limit-perfumes") || 0);
  const mergeOnly = hasFlag("--merge") && !argValue("--designers") && !hasFlag("--popular");

  if (mergeOnly) {
    const cached = loadCachedPerfumes();
    const { added, enriched } = mergeIntoCatalog(cached);
    console.log(
      `Merged ${cached.length} cached perfumes → +${added} added, ${enriched} enriched.`,
    );
    return;
  }

  let session = await launchBrowser();

  const rotateSession = async (why: string) => {
    console.log(`\n🔄 ${why} — opening a fresh Chrome session…`);
    await session.close();
    await sleep(2000);
    session = await launchBrowser();
    await warmupFragrantica(session.page);
  };

  try {
    await warmupFragrantica(session.page);

    let designers: DesignerRef[] = [];
    if (existsSync(DESIGNERS_PATH) && !hasFlag("--refresh-designers")) {
      designers = JSON.parse(
        readFileSync(DESIGNERS_PATH, "utf8").replace(/^\uFEFF/, ""),
      ) as DesignerRef[];
      console.log(`Loaded ${designers.length} cached popular designers.`);
    } else {
      console.log("Harvesting popular designers…");
      designers = await harvestPopularDesigners(session.page);
      console.log(`Saved ${designers.length} designers → ${DESIGNERS_PATH}`);
    }

    const selected = resolveDesigners(designers);
    if (selected.length === 0) {
      console.error(
        "No designers selected. Use --popular or --designers Afnan,Dior",
      );
      process.exit(1);
    }

    console.log(
      `Scraping ${selected.length} designer(s): ${selected.map((d) => d.name).join(", ")}`,
    );

    const scraped: ScrapedPerfume[] = [];
    let perfumeCount = 0;
    let consecutive429 = 0;

    for (const designer of selected) {
      console.log(`\n→ ${designer.name}`);
      let list: PerfumeListItem[];
      try {
        list = await scrapeDesignerPerfumeList(session.page, designer);
      } catch (err) {
        if (isBrowserClosedError(err)) {
          await rotateSession("Browser closed");
          list = await scrapeDesignerPerfumeList(session.page, designer);
        } else {
          throw err;
        }
      }
      const queue = limitPerfumes > 0 ? list.slice(0, limitPerfumes) : list;

      for (const item of queue) {
        perfumeCount += 1;
        process.stdout.write(
          `  [${perfumeCount}] ${item.name.slice(0, 60)}… `,
        );
        try {
          const p = await scrapePerfumePage(session.page, item, designer.name);
          if (p) {
            scraped.push(p);
            consecutive429 = 0;
            console.log(`ok (${p.rating}/5, ${p.topNotes.length} top)`);
          } else {
            console.log("empty");
          }
        } catch (err) {
          if (isBrowserClosedError(err)) {
            console.log("browser closed — relaunching…");
            try {
              await rotateSession("Browser closed");
              const p = await scrapePerfumePage(
                session.page,
                item,
                designer.name,
              );
              if (p) {
                scraped.push(p);
                consecutive429 = 0;
                console.log(`ok (${p.rating}/5, ${p.topNotes.length} top)`);
              } else {
                console.log("empty");
              }
            } catch (err2) {
              console.log(`fail: ${(err2 as Error).message}`);
            }
          } else if (
            isSessionBlockedError(err) ||
            /Perfume pages still return 429/i.test(
              err instanceof Error ? err.message : String(err),
            )
          ) {
            consecutive429 += 1;
            console.log(`fail: ${(err as Error).message}`);
            if (consecutive429 >= 2) {
              throw new Error(
                "Repeated 429 on perfume pages. Fresh sessions won't help.\n" +
                  "Stop for several hours, OR use your normal Chrome:\n" +
                  "  .\\scripts\\start-chrome-debug.ps1\n" +
                  "  npx tsx scripts/scrape-fragrantica.ts --popular --delay 4000 --merge --cdp 9222",
              );
            }
          } else {
            console.log(`fail: ${(err as Error).message}`);
          }
        }
        await sleep(delay);
      }
    }

    if (hasFlag("--merge") || hasFlag("--popular") || argValue("--designers")) {
      const all = [...loadCachedPerfumes()];
      const byId = new Map(all.map((p) => [p.fragranticaId, p]));
      for (const p of scraped) byId.set(p.fragranticaId, p);
      const { added, enriched } = mergeIntoCatalog([...byId.values()]);
      console.log(
        `\nDone. Scraped ${scraped.length} this run. Catalog: +${added} added, ${enriched} enriched.`,
      );
    } else {
      console.log(
        `\nCached ${scraped.length} perfumes. Re-run with --merge to write fragrances.json.`,
      );
    }
  } finally {
    await session.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
