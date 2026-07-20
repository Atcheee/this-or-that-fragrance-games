/**
 * Probe a single perfume detail page extraction.
 */
import { chromium } from "playwright";

async function main() {
  const url =
    process.argv[2] ||
    "https://www.fragrantica.com/perfume/Afnan/Adwaa-Al-Sharq-66850.html";
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  page.setDefaultTimeout(20_000);
  console.log("goto", url);
  await page.goto(url, { waitUntil: "commit", timeout: 30_000 });
  await page.waitForSelector("body", { timeout: 15_000 });
  await page.waitForTimeout(2000);

  const info = await page.evaluate(`(() => {
    const body = document.body.innerText;
    return {
      len: body.length,
      hasRating: /Perfume rating/i.test(body),
      hasTop: /top notes are/i.test(body),
      hasAccords: /main accords/i.test(body),
      ratingLine: (body.match(/Perfume rating[\\s\\S]{0,80}/i) || [null])[0],
      topLine: (body.match(/Top notes are [^.;]+/i) || [null])[0],
      snippet: body.slice(0, 1000),
    };
  })()`);

  console.log(JSON.stringify(info, null, 2));
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
