/**
 * Resolve a fragrance-note name to a Wikimedia Commons thumbnail via the
 * Wikipedia REST summary API (CORS-enabled). Overrides fix perfume-jargon
 * that would otherwise land on the wrong article (or none).
 */

const NOTE_WIKI: Record<string, string> = {
  bergamot: "Bergamot_orange",
  "black currant": "Blackcurrant",
  "blackcurrant": "Blackcurrant",
  "pink pepper": "Schinus_molle",
  "sichuan pepper": "Sichuan_pepper",
  "tonka bean": "Dipteryx_odorata",
  oakmoss: "Oakmoss",
  ambergris: "Ambergris",
  ambroxan: "Ambroxide",
  ambrette: "Abelmoschus_moschatus",
  cedar: "Cedar_wood",
  "virginia cedar": "Juniperus_virginiana",
  "cedarwood": "Cedar_wood",
  vetiver: "Chrysopogon_zizanioides",
  patchouli: "Patchouli",
  labdanum: "Labdanum",
  oud: "Agarwood",
  agarwood: "Agarwood",
  musk: "Musk",
  leather: "Leather",
  vanilla: "Vanilla",
  jasmine: "Jasmine",
  rose: "Rose",
  iris: "Iris_(plant)",
  lavender: "Lavender",
  sandalwood: "Sandalwood",
  lemon: "Lemon",
  "orange blossom": "Orange_blossom",
  neroli: "Neroli",
  "ylang-ylang": "Cananga_odorata",
  "ylang ylang": "Cananga_odorata",
  frankincense: "Frankincense",
  myrrh: "Myrrh",
  benzoin: "Benzoin_(resin)",
  cardamom: "Cardamom",
  cinnamon: "Cinnamon",
  ginger: "Ginger",
  pepper: "Black_pepper",
  nutmeg: "Nutmeg",
  clove: "Clove",
  tobacco: "Tobacco",
  coffee: "Coffee",
  cacao: "Cocoa_bean",
  cocoa: "Cocoa_bean",
  almond: "Almond",
  coconut: "Coconut",
  pineapple: "Pineapple",
  apple: "Apple",
  pear: "Pear",
  peach: "Peach",
  apricot: "Apricot",
  cherry: "Cherry",
  fig: "Common_fig",
  honey: "Honey",
  beeswax: "Beeswax",
  amber: "Amber_(fossil_resin)",
  galbanum: "Galbanum",
  petitgrain: "Petitgrain",
  "mandarin orange": "Mandarin_orange",
  grapefruit: "Grapefruit",
  lime: "Lime_(fruit)",
  orange: "Orange_(fruit)",
  "blood orange": "Blood_orange",
  "bitter orange": "Bitter_orange",
  "green tea": "Green_tea",
  "black tea": "Tea",
  peppermint: "Peppermint",
  spearmint: "Spearmint",
  mint: "Mentha",
  basil: "Basil",
  thyme: "Thyme",
  rosemary: "Rosemary",
  sage: "Salvia_officinalis",
  geranium: "Geranium",
  peony: "Peony",
  tuberose: "Polianthes_tuberosa",
  gardenia: "Gardenia",
  "lily of the valley": "Lily_of_the_valley",
  magnolia: "Magnolia",
  orchid: "Orchid",
  violet: "Viola_(plant)",
  "violet leaf": "Viola_(plant)",
  carnation: "Dianthus_caryophyllus",
  freesia: "Freesia",
  hyacinth: "Hyacinth_(plant)",
  lilac: "Syringa_vulgaris",
  mimosa: "Acacia_dealbata",
  osmanthus: "Osmanthus_fragrans",
  heliotrope: "Heliotropium",
  incense: "Incense",
  "guaiac wood": "Guaiacum",
  bamboo: "Bamboo",
  hay: "Hay",
  rum: "Rum",
  whiskey: "Whisky",
  whisky: "Whisky",
  cognac: "Cognac",
  champagne: "Champagne",
  caramel: "Caramel",
  chocolate: "Chocolate",
  praline: "Praline",
  marshmallow: "Marshmallow",
  "cotton candy": "Cotton_candy",
  "lemon verbena": "Aloysia_citrodora",
  "pink peppercorn": "Schinus_molle",
  "sea notes": "Sea",
  "water notes": "Water",
  "woody notes": "Lumber",
  "woodsy notes": "Lumber",
  "aromatic notes": "Herb",
  "herbal notes": "Herb",
  "spicy notes": "Spice",
  "ozonic notes": "Ozone",
  "iso e super": "Iso_E_Super",
  hedione: "Methyl_dihydrojasmonate",
  cashmeran: "Cashmeran",
  birch: "Birch",
  pine: "Pine",
  "fir": "Fir",
  moss: "Moss",
  soil: "Soil",
  dirt: "Soil",
};

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

function normKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Candidate Wikipedia titles for a perfume-note label, most specific first. */
function wikiTitleCandidates(name: string): string[] {
  const key = normKey(name);
  const titles: string[] = [];
  if (NOTE_WIKI[key]) titles.push(NOTE_WIKI[key]!);

  const words = key.split(/\s+/).filter(Boolean);
  // "Provençal Lavender" / "Haitian Vetiver" → try the head note alone
  if (words.length > 1) {
    const last = words[words.length - 1]!;
    if (NOTE_WIKI[last]) titles.push(NOTE_WIKI[last]!);
    titles.push(last.replace(/\b\w/g, (c) => c.toUpperCase()));
  }

  titles.push(name.trim().replace(/\s+/g, "_"));
  return [...new Set(titles)];
}

async function fetchSummaryThumbnail(
  title: string,
): Promise<string | null> {
  const res = await fetch(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(6_000),
    },
  );
  if (!res.ok) return null;
  const data = (await res.json()) as {
    thumbnail?: { source?: string };
    type?: string;
  };
  if (data.type === "disambiguation") return null;
  return data.thumbnail?.source ?? null;
}

/**
 * Returns a Wikimedia thumbnail URL for the note, or null when none is found.
 * Results are memoized for the page lifetime.
 */
export function fetchNoteImageUrl(name: string): Promise<string | null> {
  const key = normKey(name);
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async () => {
    try {
      for (const title of wikiTitleCandidates(name)) {
        const url = await fetchSummaryThumbnail(title);
        if (url) {
          cache.set(key, url);
          return url;
        }
      }
      cache.set(key, null);
      return null;
    } catch {
      cache.set(key, null);
      return null;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}
