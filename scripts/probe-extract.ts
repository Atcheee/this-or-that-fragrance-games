/**
 * Test perfume extract script on a live page.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import path from "node:path";

async function main() {
  const extract = readFileSync(
    path.join(__dirname, "fragrantica-extract-perfume.js"),
    "utf8",
  );
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  await page.goto(
    "https://www.fragrantica.com/perfume/Afnan/Adwaa-Al-Sharq-66850.html",
    { waitUntil: "commit", timeout: 30_000 },
  );
  await page.waitForSelector("body", { timeout: 15_000 });
  await page
    .waitForFunction(
      () => /Perfume rating/i.test(document.body?.innerText || ""),
      { timeout: 15_000 },
    )
    .catch(() => null);
  await page.waitForTimeout(500);

  const raw = await page.evaluate(`(() => {
    ${extract}
    return extractPerfumePage();
  })()`);
  console.log(JSON.stringify(raw, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
