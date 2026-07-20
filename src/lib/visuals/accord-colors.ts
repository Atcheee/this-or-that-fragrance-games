/**
 * Fragrantica-inspired accord colors. Unknown accords get a stable hue from
 * the name so every badge still reads as a distinct color chip.
 */

const ACCORD_COLORS: Record<string, string> = {
  citrus: "#e8d44d",
  sweet: "#e89a5c",
  woody: "#a67c52",
  floral: "#e87aad",
  "white floral": "#f0b8d0",
  "yellow floral": "#e8c84d",
  fruity: "#e85c7a",
  fresh: "#6ec9a8",
  green: "#6aaa3c",
  aromatic: "#5a9e6e",
  spicy: "#c94a3a",
  "warm spicy": "#d45a2a",
  "fresh spicy": "#e07a4a",
  "soft spicy": "#c97a6a",
  powdery: "#b88cc8",
  musky: "#9aa4b0",
  amber: "#d4a04a",
  ambery: "#d4a04a",
  aquatic: "#4aa8d4",
  marine: "#3a90c0",
  ozonic: "#7ec8e0",
  leather: "#6b4a3a",
  leathery: "#6b4a3a",
  smoky: "#6a7078",
  oud: "#5a3a2a",
  vanilla: "#e8d4a0",
  gourmand: "#c49a72",
  oriental: "#9a5aaa",
  balsamic: "#b8884a",
  earthy: "#8a7a4a",
  mossy: "#5a7a4a",
  chypre: "#7a8a4a",
  fougere: "#6a9a6a",
  "fougère": "#6a9a6a",
  animalic: "#8a6a5a",
  animal: "#8a6a5a",
  creamy: "#e8d8c0",
  lactonic: "#e0d0b8",
  resinous: "#a87840",
  incense: "#7a6a8a",
  tobacco: "#8a6a40",
  coffee: "#5a3a28",
  chocolate: "#6a4030",
  cacao: "#6a4030",
  cocoa: "#6a4030",
  caramel: "#c88840",
  honey: "#d4a830",
  almond: "#d4b888",
  coconut: "#e0d0b0",
  tropical: "#e87850",
  cherry: "#c03040",
  rose: "#d45070",
  jasmine: "#e8d8a0",
  iris: "#a898c0",
  lavender: "#8a7ab8",
  violet: "#8a70b0",
  patchouli: "#6a5840",
  sandalwood: "#c8a878",
  vetiver: "#7a8a50",
  tonka: "#c8a060",
  boozy: "#a05040",
  rum: "#8a4030",
  champagne: "#e8d480",
  soapy: "#b0c8d8",
  clean: "#a8c8d0",
  metallic: "#9098a0",
  mineral: "#889098",
  bitter: "#7a8a50",
  sour: "#c8c850",
  salty: "#80b0c8",
  dark: "#4a4550",
  warm: "#d08050",
  classic: "#8a7a68",
  luxurious: "#b89850",
  synthetic: "#7890a8",
  conifer: "#4a7a50",
  hay: "#c8b860",
  herbal: "#6a9a58",
  fig: "#6a8050",
  anis: "#90a070",
  cinnamon: "#b05030",
  ginger: "#d08040",
  beeswax: "#d4b850",
  marshmallow: "#f0d0d8",
  savory: "#a07050",
  petrol: "#505860",
  tar: "#3a3a40",
  sand: "#d4c090",
  vodka: "#c8d0d8",
  alcohol: "#a8b0b8",
  aldehydic: "#c0c8d0",
  camphor: "#90b8b0",
  nutty: "#b89060",
  tuberose: "#e8c8d0",
  tea: "#7a9a50",
  minimal: "#a0a8b0",
};

function normKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/** Stable HSL color for accords missing from the curated map. */
function hashColor(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  const h = hash % 360;
  const s = 42 + (hash % 28);
  const l = 48 + (hash % 16);
  return `hsl(${h} ${s}% ${l}%)`;
}

export function accordColor(name: string): string {
  const key = normKey(name);
  return ACCORD_COLORS[key] ?? hashColor(key);
}

/** Soft fill that stays readable on light and dark card backgrounds. */
export function accordSoftBackground(color: string): string {
  if (color.startsWith("hsl")) {
    return color.replace(
      /hsl\((\d+)\s+(\d+)%\s+(\d+)%\)/,
      (_m, h, s) => `hsl(${h} ${s}% 50% / 0.28)`,
    );
  }
  return `${color}47`;
}
