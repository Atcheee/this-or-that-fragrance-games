/**
 * Quick non-hanging probe of a Fragrantica designer page.
 * Uses commit + hard timeouts — never networkidle.
 */
import { chromium } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const OUT = path.join(__dirname, "fragrantica-cache");
mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  page.setDefaultTimeout(20_000);

  const url = process.argv[2] || "https://www.fragrantica.com/designers/Afnan.html";
  console.log("goto", url);
  await page.goto(url, { waitUntil: "commit", timeout: 30_000 });
  await page.waitForSelector("body", { timeout: 15_000 });
  await page.waitForTimeout(2000);

  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy(0, 1600));
    await page.waitForTimeout(250);
  }

  const info = await page.evaluate(() => {
    const hrefs = [...document.querySelectorAll("a[href]")]
      .map((a) => (a as HTMLAnchorElement).href)
      .filter((h) => /\/perfume\/.+-\d+\.html/i.test(h));
    const uniq = [...new Set(hrefs)];
    const htmlHits = [
      ...document.documentElement.innerHTML.matchAll(
        /\/perfume\/[^"'\\\s]+\/[^"'\\\s]+-\d+\.html/gi,
      ),
    ].map((m) => m[0]);
    return {
      title: document.title,
      textLen: document.body.innerText.length,
      linkCount: uniq.length,
      htmlHitCount: new Set(htmlHits).size,
      sample: uniq.slice(0, 8),
      snippet: document.body.innerText.slice(0, 500),
    };
  });

  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: path.join(OUT, "afnan-debug.png") });
  writeFileSync(path.join(OUT, "afnan-debug.json"), JSON.stringify(info, null, 2));
  await browser.close();
  console.log("done");
}

main().catch((err) => {
  console.error("FAIL", err);
  process.exit(1);
});
