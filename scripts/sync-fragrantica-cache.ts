/**
 * Merge Fragrantica scrape progress from another PC — ADD ONLY.
 *
 * Never overwrites existing values. Only:
 *   - copies files that are missing locally
 *   - appends missing houses / perfumes to lists
 *   - fills empty/null/0/[] fields on records that already exist
 *
 * Usage:
 *   1. Copy the other PC's cache into scripts/fragrantica-sync-inbox/
 *      Accepted layouts (any mix):
 *        fragrantica-sync-inbox/
 *          designers/   perfumes/
 *          alphabet-designers.json
 *          popular-designers.json
 *          fragrances.json          (optional catalog merge)
 *        OR nested: fragrantica-cache/{designers,perfumes,...}
 *        OR one/more .zip containing the above
 *   2. npx tsx scripts/sync-fragrantica-cache.ts
 *   3. Optional: --clean  (delete inbox contents after a successful sync)
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  copyFileSync,
  rmSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { canonicalHouse, dedupeKey } from "./dataset-utils";

const ROOT = path.join(__dirname, "..");
const CACHE = path.join(__dirname, "fragrantica-cache");
const INBOX = path.join(__dirname, "fragrantica-sync-inbox");
const DESIGNER_DIR = path.join(CACHE, "designers");
const PERFUME_DIR = path.join(CACHE, "perfumes");
const CATALOG_PATH = path.join(ROOT, "src", "data", "fragrances.json");

const INDEX_FILES = [
  "alphabet-designers.json",
  "popular-designers.json",
] as const;

interface Stats {
  perfumeFilesAdded: number;
  perfumeFilesEnriched: number;
  perfumeFilesSkipped: number;
  designerFilesAdded: number;
  designerFilesEnriched: number;
  designerItemsAdded: number;
  indexItemsAdded: number;
  indexFieldsFilled: number;
  catalogAdded: number;
  catalogEnriched: number;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function ensureDirs() {
  for (const dir of [CACHE, DESIGNER_DIR, PERFUME_DIR, INBOX]) {
    mkdirSync(dir, { recursive: true });
  }
}

function readJsonFile<T>(filePath: string): T {
  const raw = readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  return JSON.parse(raw) as T;
}

function writeJson(filePath: string, data: unknown) {
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n");
}

function isEmptyValue(v: unknown): boolean {
  return (
    v == null ||
    v === "" ||
    v === 0 ||
    (Array.isArray(v) && v.length === 0) ||
    (typeof v === "object" &&
      !Array.isArray(v) &&
      Object.keys(v as object).length === 0)
  );
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Fill empty fields on `target` from `source`. Never overwrites non-empty. */
function fillMissingFields(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): number {
  let filled = 0;
  for (const [key, value] of Object.entries(source)) {
    if (value == null) continue;
    if (!(key in target) || isEmptyValue(target[key])) {
      if (!isEmptyValue(value)) {
        target[key] = value;
        filled += 1;
      }
      continue;
    }
    // Nested plain objects: recurse (e.g. wear votes)
    if (isPlainObject(target[key]) && isPlainObject(value)) {
      filled += fillMissingFields(
        target[key] as Record<string, unknown>,
        value,
      );
    }
  }
  return filled;
}

function listJsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith(".json"));
}

function isDir(p: string): boolean {
  try {
    return existsSync(p) && statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function isFile(p: string): boolean {
  try {
    return existsSync(p) && statSync(p).isFile();
  } catch {
    return false;
  }
}

function findIncomingRoots(...starts: string[]): string[] {
  const roots: string[] = [];
  const queue = [...starts];
  const seen = new Set<string>();

  while (queue.length) {
    const dir = queue.shift()!;
    if (seen.has(dir)) continue;
    seen.add(dir);

    const hasDesigners = isDir(path.join(dir, "designers"));
    const hasPerfumes = isDir(path.join(dir, "perfumes"));
    const hasIndex = INDEX_FILES.some((f) => isFile(path.join(dir, f)));
    const hasCatalog = isFile(path.join(dir, "fragrances.json"));

    if (hasDesigners || hasPerfumes || hasIndex || hasCatalog) {
      roots.push(dir);
    }

    // Walk nested folders (including .extracted from zips)
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (name === "node_modules" || name === "__MACOSX") continue;
      // Skip hidden junk except our zip extract dir
      if (name.startsWith(".") && name !== ".extracted") continue;
      const full = path.join(dir, name);
      try {
        if (statSync(full).isDirectory()) queue.push(full);
      } catch {
        /* ignore */
      }
    }
  }

  // Prefer deepest roots (drop parents when a child root exists)
  return roots.filter(
    (r) => !roots.some((other) => other !== r && other.startsWith(r + path.sep)),
  );
}

function expandZips(inbox: string): string[] {
  const zips = readdirSync(inbox).filter((f) => f.toLowerCase().endsWith(".zip"));
  const extracted: string[] = [];
  for (const zipName of zips) {
    const zipPath = path.join(inbox, zipName);
    // fragrances.json.zip → fragrances-json (avoid a folder named like the file)
    const stem = path
      .basename(zipName, path.extname(zipName))
      .replace(/\.+/g, "-")
      .replace(/[^a-zA-Z0-9_-]+/g, "-");
    const outDir = path.join(inbox, ".extracted", stem || "zip");
    mkdirSync(outDir, { recursive: true });
    console.log(`Extracting ${zipName} → ${path.relative(inbox, outDir)}`);
    // Prefer tar (Windows 10+); fall back to PowerShell Expand-Archive
    try {
      execFileSync("tar", ["-xf", zipPath, "-C", outDir], { stdio: "pipe" });
    } catch {
      execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${outDir.replace(/'/g, "''")}' -Force`,
        ],
        { stdio: "pipe" },
      );
    }
    extracted.push(outDir);
  }
  return extracted;
}

function mergePerfumeFile(
  srcPath: string,
  destPath: string,
  stats: Stats,
): void {
  if (!existsSync(destPath)) {
    copyFileSync(srcPath, destPath);
    stats.perfumeFilesAdded += 1;
    return;
  }

  let local: Record<string, unknown>;
  let incoming: Record<string, unknown>;
  try {
    local = readJsonFile(destPath);
    incoming = readJsonFile(srcPath);
  } catch {
    stats.perfumeFilesSkipped += 1;
    return;
  }

  const filled = fillMissingFields(local, incoming);
  if (filled > 0) {
    writeJson(destPath, local);
    stats.perfumeFilesEnriched += 1;
  } else {
    stats.perfumeFilesSkipped += 1;
  }
}

function mergeDesignerListFile(
  srcPath: string,
  destPath: string,
  stats: Stats,
): void {
  let incoming: Record<string, unknown>[];
  try {
    incoming = readJsonFile(srcPath);
    if (!Array.isArray(incoming)) return;
  } catch {
    return;
  }

  if (!existsSync(destPath)) {
    writeJson(destPath, incoming);
    stats.designerFilesAdded += 1;
    stats.designerItemsAdded += incoming.length;
    return;
  }

  let local: Record<string, unknown>[];
  try {
    local = readJsonFile(destPath);
    if (!Array.isArray(local)) local = [];
  } catch {
    local = [];
  }

  const byId = new Map<number, Record<string, unknown>>();
  const byUrl = new Map<string, Record<string, unknown>>();
  for (const item of local) {
    const id = Number(item.fragranticaId);
    if (Number.isFinite(id)) byId.set(id, item);
    if (typeof item.url === "string" && item.url) byUrl.set(item.url, item);
  }

  let fileChanged = false;
  let itemsAdded = 0;
  let fieldsFilled = 0;

  for (const item of incoming) {
    const id = Number(item.fragranticaId);
    const existing =
      (Number.isFinite(id) ? byId.get(id) : undefined) ||
      (typeof item.url === "string" ? byUrl.get(item.url) : undefined);

    if (!existing) {
      local.push(item);
      if (Number.isFinite(id)) byId.set(id, item);
      if (typeof item.url === "string" && item.url) byUrl.set(item.url, item);
      itemsAdded += 1;
      fileChanged = true;
      continue;
    }

    const filled = fillMissingFields(existing, item);
    if (filled > 0) {
      fieldsFilled += filled;
      fileChanged = true;
    }
  }

  if (fileChanged) {
    writeJson(destPath, local);
    stats.designerFilesEnriched += 1;
    stats.designerItemsAdded += itemsAdded;
    // fieldsFilled counted into enriched file; items are the important signal
    void fieldsFilled;
  }
}

function mergeDesignerIndex(
  srcPath: string,
  destPath: string,
  stats: Stats,
): void {
  let incoming: Record<string, unknown>[];
  try {
    incoming = readJsonFile(srcPath);
    if (!Array.isArray(incoming)) return;
  } catch {
    return;
  }

  if (!existsSync(destPath)) {
    writeJson(destPath, incoming);
    stats.indexItemsAdded += incoming.length;
    return;
  }

  let local: Record<string, unknown>[];
  try {
    local = readJsonFile(destPath);
    if (!Array.isArray(local)) local = [];
  } catch {
    local = [];
  }

  const bySlug = new Map<string, Record<string, unknown>>();
  for (const item of local) {
    const slug = String(item.slug || "").toLowerCase();
    if (slug) bySlug.set(slug, item);
  }

  let changed = false;
  for (const item of incoming) {
    const slug = String(item.slug || "").toLowerCase();
    if (!slug) continue;
    const existing = bySlug.get(slug);
    if (!existing) {
      local.push(item);
      bySlug.set(slug, item);
      stats.indexItemsAdded += 1;
      changed = true;
      continue;
    }
    const filled = fillMissingFields(existing, item);
    if (filled > 0) {
      stats.indexFieldsFilled += filled;
      changed = true;
    }
  }

  if (changed) writeJson(destPath, local);
}

function mergeCatalog(srcPath: string, stats: Stats): void {
  let incoming: Record<string, unknown>[];
  try {
    incoming = readJsonFile(srcPath);
    if (!Array.isArray(incoming)) {
      console.warn(`  skip catalog: not an array (${srcPath})`);
      return;
    }
  } catch (err) {
    console.warn(`  skip catalog: ${err}`);
    return;
  }

  if (!existsSync(CATALOG_PATH)) {
    writeFileSync(CATALOG_PATH, JSON.stringify(incoming) + "\n");
    stats.catalogAdded = incoming.length;
    return;
  }

  const catalog = readJsonFile<Record<string, unknown>[]>(CATALOG_PATH);
  const byId = new Map<string, Record<string, unknown>>();
  const byKey = new Map<string, Record<string, unknown>>();
  for (const f of catalog) {
    if (typeof f.id === "string") byId.set(f.id, f);
    const name = String(f.name || "");
    const house = String(f.house || "");
    if (name && house) byKey.set(dedupeKey(name, house), f);
  }

  for (const entry of incoming) {
    const id = typeof entry.id === "string" ? entry.id : "";
    const name = String(entry.name || "");
    const house = String(entry.house || "");
    const key =
      name && house
        ? dedupeKey(name, canonicalHouse(house) || house)
        : "";
    const existing =
      (id ? byId.get(id) : undefined) || (key ? byKey.get(key) : undefined);

    if (!existing) {
      catalog.push(entry);
      if (id) byId.set(id, entry);
      if (key) byKey.set(key, entry);
      stats.catalogAdded += 1;
      continue;
    }

    const filled = fillMissingFields(existing, entry);
    if (filled > 0) stats.catalogEnriched += 1;
  }

  if (stats.catalogAdded > 0 || stats.catalogEnriched > 0) {
    writeFileSync(CATALOG_PATH, JSON.stringify(catalog) + "\n");
  }
}

function mergeRoot(root: string, stats: Stats): void {
  console.log(`\nMerging from: ${root}`);

  const designersSrc = path.join(root, "designers");
  if (existsSync(designersSrc)) {
    const files = listJsonFiles(designersSrc);
    console.log(`  designers: ${files.length} file(s)`);
    for (const file of files) {
      mergeDesignerListFile(
        path.join(designersSrc, file),
        path.join(DESIGNER_DIR, file),
        stats,
      );
    }
  }

  const perfumesSrc = path.join(root, "perfumes");
  if (existsSync(perfumesSrc)) {
    const files = listJsonFiles(perfumesSrc);
    console.log(`  perfumes: ${files.length} file(s)`);
    for (const file of files) {
      mergePerfumeFile(
        path.join(perfumesSrc, file),
        path.join(PERFUME_DIR, file),
        stats,
      );
    }
  }

  for (const name of INDEX_FILES) {
    const src = path.join(root, name);
    if (!existsSync(src)) continue;
    console.log(`  index: ${name}`);
    mergeDesignerIndex(src, path.join(CACHE, name), stats);
  }

  const catalogSrc = path.join(root, "fragrances.json");
  if (existsSync(catalogSrc)) {
    console.log(`  catalog: fragrances.json`);
    mergeCatalog(catalogSrc, stats);
  }
}

function printInboxHelp() {
  console.log(`
Inbox is empty: ${INBOX}

Place the other PC's progress here, then re-run:
  npx tsx scripts/sync-fragrantica-cache.ts

Accepted contents (any mix):
  designers/                  house perfume lists
  perfumes/                   scraped perfume JSON
  alphabet-designers.json
  popular-designers.json
  fragrances.json             optional — add-only catalog merge
  *.zip                       containing any of the above

Nested fragrantica-cache/ folders are fine.
Merge is ADD-ONLY: existing local values are never overwritten.
`);
}

function cleanInbox() {
  const extracted = path.join(INBOX, ".extracted");
  if (existsSync(extracted)) {
    rmSync(extracted, { recursive: true, force: true });
  }
  for (const name of readdirSync(INBOX)) {
    if (name === "README.md" || name === ".gitkeep") continue;
    const full = path.join(INBOX, name);
    rmSync(full, { recursive: true, force: true });
  }
  console.log("Inbox cleaned.");
}

function main() {
  ensureDirs();

  // Seed a tiny readme if missing (ignored by git via /scripts/*)
  const readmePath = path.join(INBOX, "README.md");
  if (!existsSync(readmePath)) {
    writeFileSync(
      readmePath,
      `# Fragrantica sync inbox

Drop the other PC's cache here, then run:

\`\`\`
npx tsx scripts/sync-fragrantica-cache.ts
\`\`\`

Copy these from the other machine:

- \`designers/\`
- \`perfumes/\`
- \`alphabet-designers.json\`
- \`popular-designers.json\`
- \`fragrances.json\` (optional)

A single \`.zip\` of those paths also works.

**Add-only:** existing local data is never overwritten — only missing
files/entries/fields are filled in.
`,
    );
  }

  const inboxEntries = readdirSync(INBOX).filter(
    (n) => n !== "README.md" && n !== ".gitkeep" && n !== ".extracted",
  );
  if (inboxEntries.length === 0) {
    printInboxHelp();
    process.exit(0);
  }

  const extractedRoots = expandZips(INBOX);

  const roots = findIncomingRoots(INBOX, ...extractedRoots).filter(
    (r) => path.normalize(r) !== path.normalize(CACHE),
  );

  if (roots.length === 0) {
    console.error(
      "No designers/, perfumes/, index JSON, or fragrances.json found in the inbox.",
    );
    printInboxHelp();
    process.exit(1);
  }

  const stats: Stats = {
    perfumeFilesAdded: 0,
    perfumeFilesEnriched: 0,
    perfumeFilesSkipped: 0,
    designerFilesAdded: 0,
    designerFilesEnriched: 0,
    designerItemsAdded: 0,
    indexItemsAdded: 0,
    indexFieldsFilled: 0,
    catalogAdded: 0,
    catalogEnriched: 0,
  };

  for (const root of roots) mergeRoot(root, stats);

  console.log(`
Done (add-only merge into ${CACHE}):
  perfume files:  +${stats.perfumeFilesAdded} new, ${stats.perfumeFilesEnriched} enriched, ${stats.perfumeFilesSkipped} unchanged
  designer files: +${stats.designerFilesAdded} new, ${stats.designerFilesEnriched} updated (+${stats.designerItemsAdded} list items)
  indexes:        +${stats.indexItemsAdded} houses, ${stats.indexFieldsFilled} fields filled
  catalog:        +${stats.catalogAdded} fragrances, ${stats.catalogEnriched} enriched
`);

  if (hasFlag("--clean")) {
    cleanInbox();
  } else {
    console.log(
      "Inbox left as-is. Re-run with --clean to delete inbox contents after sync.",
    );
  }
}

main();
