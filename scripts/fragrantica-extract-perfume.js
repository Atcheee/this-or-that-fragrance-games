/** Browser-side Fragrantica perfume page extractor (plain JS, no TSX transforms). */
function extractPerfumePage() {
  const text = (el) =>
    (el && el.textContent ? el.textContent : "").replace(/\s+/g, " ").trim();
  const body = document.body.innerText;

  const accordsMatch = body.match(/main accords\n([\s\S]*?)Search by accords/i);
  const accords = accordsMatch
    ? accordsMatch[1]
        .split(/\n+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s && s.length < 28 && !/search|vote|accord/i.test(s))
    : [];

  const wearRaw = {};
  for (const k of ["winter", "spring", "summer", "fall", "day", "night"]) {
    const m = body.match(new RegExp(k + "\\n([\\d.,]+k?)", "i"));
    if (m) wearRaw[k] = m[1];
  }

  const ratingLine = body.match(
    /Perfume rating\s*([\d.]+)\s*out of\s*5\s*with\s*([\d,]+)\s*votes/i,
  );

  // Prefer the editorial paragraph that mentions launch / notes
  const paragraphs = [...document.querySelectorAll("p")].map(text);
  const description =
    paragraphs.find((p) => /was launched in|top notes are|fragrance for/i.test(p)) ||
    text(document.querySelector("[itemprop=description]")) ||
    "";

  const top = (description.match(/Top notes? are ([^.;]+)/i) || [])[1] || null;
  const middle =
    (description.match(/middle notes? are ([^.;]+)/i) || [])[1] || null;
  const base = (description.match(/base notes? are ([^.;]+)/i) || [])[1] || null;

  // Flat "features X and Y" / FRAGRANCE NOTES fallback
  let flatNotes = [];
  const features = description.match(/features (.+?)\.?$/i);
  if (features) {
    flatNotes = features[1]
      .split(/,| and /i)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (flatNotes.length === 0) {
    const noteImgs = [...document.querySelectorAll('img[src*="sastojci"]')]
      .map((img) => img.alt || "")
      .map((s) => s.trim())
      .filter(Boolean);
    flatNotes = [...new Set(noteImgs)];
  }

  const h1 = text(document.querySelector("h1"));
  const year =
    (description.match(/launched in (\d{4})/i) || [])[1] ||
    (body.match(/\b(20\d{2}|19\d{2})\b/) || [])[1] ||
    null;

  const bottleEl =
    document.querySelector(
      'img[src*="perfume/"][src*="375x500"], img[src*="perfume-thumbs"]',
    ) ||
    [...document.querySelectorAll("img")].find((img) =>
      /mdimg\/perfume/i.test(img.src),
    );
  const bottle = bottleEl ? bottleEl.src : null;

  const designerLink = [
    ...document.querySelectorAll('a[href*="/designers/"]'),
  ].find((a) => /\/designers\/[^/]+\.html$/i.test(a.href));
  const house = text(designerLink);

  const longevity =
    (body.match(
      /longevity[\s\S]{0,80}?(poor|weak|moderate|long lasting|eternal)/i,
    ) || [])[1] || null;
  const sillage =
    (body.match(
      /sillage[\s\S]{0,80}?(soft|moderate|strong|enormous)/i,
    ) || [])[1] || null;

  return {
    h1,
    house,
    year,
    description,
    accords,
    wearRaw,
    rating: ratingLine ? ratingLine[1] : null,
    votes: ratingLine ? ratingLine[2] : null,
    top,
    middle,
    base,
    flatNotes,
    bottle,
    longevity,
    sillage,
  };
}
