import type { Fragrance } from "../types";

export type CrimeSceneClueSource =
  | "accord"
  | "top note"
  | "heart note"
  | "base note";

export interface CrimeSceneClue {
  id: string;
  label: string;
  text: string;
  source: CrimeSceneClueSource;
  value: string;
  explanation: string;
}

export interface CrimeSceneChallenge {
  id: string;
  caseNumber: string;
  title: string;
  location: string;
  briefing: string;
  fragrance: Fragrance;
  clues: CrimeSceneClue[];
  maxGuesses: number;
}

interface SceneTemplate {
  id: string;
  title: string;
  location: string;
  briefing: string;
  beats: [string, string, string, string, string];
  preferredAccords: string[];
}

interface EvidenceDescription {
  description: string;
  object: string;
}

export const CRIME_SCENE_SCORE_STEPS = [100, 80, 60, 40, 20] as const;

const SCENE_TEMPLATES: SceneTemplate[] = [
  {
    id: "glasshouse",
    title: "The Glasshouse Incident",
    location: "Municipal conservatory · Orchid wing",
    briefing:
      "At 11:47 p.m., the glasshouse alarm sounded. Nothing was stolen, but a single scent trail crossed the locked orchid wing. Identify the fragrance left by the intruder.",
    beats: [
      "The air nearest the shattered display carried",
      "On the brass latch, investigators found",
      "Beneath the central potting table lay",
      "A trail toward the service door ended beside",
      "The final item in the evidence bag was",
    ],
    preferredAccords: ["floral", "green", "fresh", "fruity"],
  },
  {
    id: "archive",
    title: "The Black Archive",
    location: "Halcyon Library · Restricted stacks",
    briefing:
      "A rare manuscript vanished during a seven-minute power cut. Security found no fingerprints—only an unusual scent clinging to the reading desk and the locked archive door.",
    beats: [
      "The sealed room carried a deliberate atmospheric signature.",
      "Pressed into the blotter on the curator’s desk was",
      "Inside the cold fireplace, detectives recovered",
      "The archive key had been set down beside",
      "Caught in the door’s brass escutcheon was",
    ],
    preferredAccords: ["woody", "leather", "smoky", "amber", "spicy"],
  },
  {
    id: "hotel",
    title: "Room 507",
    location: "Hotel Belladonna · Fifth floor",
    briefing:
      "Room 507 was locked from inside after the midnight gala. Its guest was gone, the balcony untouched, and a scent composed of five distinct traces remained behind.",
    beats: [
      "The room’s first impression was polished, rich, and too carefully arranged.",
      "On the rim of an untouched coupe sat",
      "The dressing mirror had been marked with",
      "At the foot of the bed, housekeeping found",
      "The wastebasket concealed",
    ],
    preferredAccords: ["sweet", "vanilla", "powdery", "gourmand", "fruity"],
  },
  {
    id: "boathouse",
    title: "The Vanishing at Pier Nine",
    location: "North harbor · Abandoned boathouse",
    briefing:
      "A boat returned to Pier Nine without its passenger. The deck was dry despite the rain, and the cabin held a precise scent trail that did not belong to the sea.",
    beats: [
      "The cabin air seemed bright and cold against the storm outside.",
      "Beside the untouched compass lay",
      "Under the passenger seat, forensics found",
      "A damp rope had been looped around",
      "Wedged into the cabin door was",
    ],
    preferredAccords: ["aquatic", "marine", "fresh", "citrus", "aromatic"],
  },
  {
    id: "opera",
    title: "The Last Curtain",
    location: "Orpheum Theatre · Dressing room B",
    briefing:
      "Minutes before the final curtain, a locked dressing room was found empty. The mirror lights were still warm. Five scented traces form the only reliable witness statement.",
    beats: [
      "The room opened with an unmistakable dramatic character.",
      "Across the illuminated mirror was scattered",
      "Inside a half-open costume trunk rested",
      "The velvet curtain had snagged on",
      "Under the star’s handwritten cue sheet was",
    ],
    preferredAccords: ["floral", "rose", "powdery", "musky", "amber"],
  },
];

const EXACT_NOTE_EVIDENCE: Record<string, EvidenceDescription> = {
  aldehydes: {
    description: "a burst of cold, soap-clean sparkle with no visible source",
    object: "the electrically bright air",
  },
  amber: {
    description: "a warm resinous smear, glowing like varnish under the lamp",
    object: "the amber-colored resin",
  },
  ambergris: {
    description: "a mineral-salty trace with a strangely warm animalic edge",
    object: "the salty mineral trace",
  },
  ambroxan: {
    description: "a dry, radiant mineral trail that seemed to cling to the walls",
    object: "the persistent mineral trail",
  },
  apple: {
    description: "one crisp green shaving, freshly cut and beginning to brown",
    object: "the green fruit shaving",
  },
  bergamot: {
    description: "a strip of bitter yellow-green rind, bright but not quite lemon",
    object: "the bitter citrus rind",
  },
  birch: {
    description: "a blackened curl of bark carrying a dry, tarry smoke",
    object: "the charred bark",
  },
  "black currant": {
    description: "a dark berry stain with a sharp green, almost inky edge",
    object: "the dark berry stain",
  },
  cardamom: {
    description: "a crushed green pod releasing cool, aromatic spice",
    object: "the crushed spice pod",
  },
  cedar: {
    description: "a clean red pencil shaving from a dry wooden box",
    object: "the dry wood shaving",
  },
  cedarwood: {
    description: "a clean red pencil shaving from a dry wooden box",
    object: "the dry wood shaving",
  },
  cinnamon: {
    description: "a reddish curl of bark dusted with warm, sweet spice",
    object: "the warm bark curl",
  },
  coffee: {
    description: "a scatter of dark roasted grounds, bitter and still warm",
    object: "the roasted grounds",
  },
  grapefruit: {
    description: "a pale pink rind leaving a bitter, sparkling oil on the glove",
    object: "the pink citrus rind",
  },
  incense: {
    description: "a thin grey ribbon of sacred smoke lingering after the flame",
    object: "the grey smoke ribbon",
  },
  iris: {
    description: "a pale cosmetic powder with a cool, root-like dryness",
    object: "the pale cosmetic powder",
  },
  jasmine: {
    description: "several waxy white petals, lush enough to scent the whole room",
    object: "the waxy white petals",
  },
  lavender: {
    description: "a bruised purple sprig, clean, herbal, and faintly medicinal",
    object: "the purple herbal sprig",
  },
  leather: {
    description: "a cut strip from a black glove, polished and faintly smoky",
    object: "the black glove cutting",
  },
  lemon: {
    description: "a sharp yellow peel releasing clean, mouth-watering oil",
    object: "the sharp yellow peel",
  },
  musk: {
    description: "a clean white fiber holding a soft skin-like warmth",
    object: "the warm white fiber",
  },
  oakmoss: {
    description: "a pinch of damp forest growth scraped from old bark",
    object: "the damp forest growth",
  },
  "orange blossom": {
    description: "a white blossom carrying both clean soap and warm sweetness",
    object: "the white citrus blossom",
  },
  orange: {
    description: "a bright curl of sweet peel with fresh oil along its edge",
    object: "the sweet citrus peel",
  },
  patchouli: {
    description: "dark earth packed around a dried leaf, woody and faintly sweet",
    object: "the dark earthy leaf",
  },
  peach: {
    description: "a velvety stone-fruit skin marked by syrupy golden juice",
    object: "the velvety fruit skin",
  },
  pepper: {
    description: "a scatter of cracked dark grains delivering a dry, hot bite",
    object: "the cracked pepper grains",
  },
  pineapple: {
    description: "a sticky golden cube, tart at the edge and almost smoky beneath",
    object: "the golden fruit cube",
  },
  rose: {
    description: "a crushed crimson petal with a rich, unmistakably romantic bloom",
    object: "the crushed crimson petal",
  },
  sandalwood: {
    description: "a smooth pale carving with a creamy, warm wooden scent",
    object: "the pale wood carving",
  },
  tobacco: {
    description: "a folded brown leaf, honeyed, dry, and slightly smoky",
    object: "the folded brown leaf",
  },
  "tonka bean": {
    description: "a wrinkled black seed smelling of hay, almond, and warm sweetness",
    object: "the wrinkled dark seed",
  },
  tuberose: {
    description: "a thick white petal with a creamy, narcotic floral trail",
    object: "the thick white petal",
  },
  vanilla: {
    description: "a split dark pod dusted with soft, confectionary sweetness",
    object: "the split dark pod",
  },
  vetiver: {
    description: "a bundle of dry roots smelling green, earthy, and faintly smoky",
    object: "the dry root bundle",
  },
  violet: {
    description: "a tiny purple flower beside a cool, cosmetic powder mark",
    object: "the powdery purple flower",
  },
  "violet leaf": {
    description: "a torn green leaf with a cold, watery, metallic edge",
    object: "the metallic green leaf",
  },
  "ylang-ylang": {
    description: "a waxy yellow petal giving off creamy, tropical sweetness",
    object: "the waxy yellow petal",
  },
};

const ACCORD_EVIDENCE: Record<string, EvidenceDescription> = {
  amber: {
    description: "warm resin, shadowed sweetness, and a glow that outlasted every other trace",
    object: "the warm resinous atmosphere",
  },
  aromatic: {
    description: "a brisk arrangement of crushed herbs, clean stems, and cooling air",
    object: "the brisk herbal atmosphere",
  },
  aquatic: {
    description: "an impossible impression of clean spray and open water inside a sealed room",
    object: "the watery atmosphere",
  },
  citrus: {
    description: "a bright spray of bitter peels that made the whole scene feel freshly cut",
    object: "the bright citrus atmosphere",
  },
  creamy: {
    description: "a smooth, lactonic softness that rounded every sharper trace",
    object: "the smooth creamy atmosphere",
  },
  earthy: {
    description: "the cool smell of turned soil, roots, and a cellar after rain",
    object: "the cool earthy atmosphere",
  },
  floral: {
    description: "the ghost of a bouquet—petaled, diffusive, and far too lush for the empty room",
    object: "the floral atmosphere",
  },
  fresh: {
    description: "an unnaturally crisp current, as if the scene had been rinsed moments earlier",
    object: "the crisp fresh atmosphere",
  },
  fruity: {
    description: "a vivid trail of ripe juice and bright skins without a single piece of fruit",
    object: "the ripe fruit atmosphere",
  },
  gourmand: {
    description: "the suggestion of a dessert trolley—edible, toasted, and suspiciously comforting",
    object: "the dessert-like atmosphere",
  },
  green: {
    description: "the snap of crushed stems and wet leaves in a room with no open window",
    object: "the crushed green atmosphere",
  },
  leather: {
    description: "a polished, dark dryness recalling gloves, saddles, and old cases",
    object: "the polished leather atmosphere",
  },
  leathery: {
    description: "a polished, dark dryness recalling gloves, saddles, and old cases",
    object: "the polished leather atmosphere",
  },
  musky: {
    description: "a soft, clean warmth that hovered close to the fabric and skin",
    object: "the soft skin-like atmosphere",
  },
  powdery: {
    description: "a pale cosmetic haze, soft-edged and carefully composed",
    object: "the cosmetic powder atmosphere",
  },
  oriental: {
    description: "a shadowed warmth of resins, sweet spice, and polished woods",
    object: "the warm resin-and-spice atmosphere",
  },
  resinous: {
    description: "a slow-burning warmth of balsam, sap, and ceremonial smoke",
    object: "the resinous atmosphere",
  },
  rose: {
    description: "the plush impression of crushed red petals, dark at their edges",
    object: "the rose-petal atmosphere",
  },
  smoky: {
    description: "a dry charred veil with no ash, match, or fire to explain it",
    object: "the charred smoky atmosphere",
  },
  spicy: {
    description: "a warm prickle of crushed seeds and bark that caught in the throat",
    object: "the warm spicy atmosphere",
  },
  sweet: {
    description: "a dense, candied warmth that clung to the room long after the trail ended",
    object: "the candied atmosphere",
  },
  vanilla: {
    description: "a creamy confectionary warmth, dark at the edges rather than sugary",
    object: "the creamy vanilla atmosphere",
  },
  woody: {
    description: "a dry architecture of fresh shavings, old boards, and polished grain",
    object: "the dry wooden atmosphere",
  },
};

const FAMILY_EVIDENCE: Array<[string[], EvidenceDescription]> = [
  [
    ["lime", "mandarin", "citron", "clementine", "yuzu", "citrus"],
    {
      description: "a bright curl of peel leaking sharp, volatile oil",
      object: "the bright citrus peel",
    },
  ],
  [
    ["pear", "plum", "berry", "cherry", "fig", "melon", "mango", "apricot"],
    {
      description: "a bruised piece of ripe fruit leaving a vivid, sweet stain",
      object: "the bruised fruit",
    },
  ],
  [
    ["lily", "peony", "magnolia", "freesia", "gardenia", "orchid", "neroli"],
    {
      description: "a pale flower fragment with a lush trail larger than its size",
      object: "the pale flower fragment",
    },
  ],
  [
    ["ginger", "saffron", "nutmeg", "clove", "coriander", "cumin"],
    {
      description: "a pinch of warm aromatic spice caught in a folded paper",
      object: "the aromatic spice",
    },
  ],
  [
    ["oud", "agarwood", "guaiac", "rosewood", "cashmere wood", "fir", "pine"],
    {
      description: "a dark wood splinter, resinous and unusually persistent",
      object: "the resinous wood splinter",
    },
  ],
  [
    ["benzoin", "labdanum", "myrrh", "frankincense", "resin"],
    {
      description: "a hardened drop of resin, warm, smoky, and faintly sweet",
      object: "the hardened resin drop",
    },
  ],
  [
    ["caramel", "chocolate", "honey", "praline", "cacao", "almond", "milk"],
    {
      description: "a sticky confectionary trace, toasted and almost edible",
      object: "the confectionary trace",
    },
  ],
  [
    ["mint", "basil", "sage", "thyme", "rosemary", "grass", "tea"],
    {
      description: "a crushed green cutting with a cool, brisk herbal scent",
      object: "the crushed herbal cutting",
    },
  ],
  [
    ["sea", "marine", "water", "rain", "ozonic", "calone"],
    {
      description: "a clear droplet leaving a clean mineral and sea-air impression",
      object: "the mineral water droplet",
    },
  ],
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function noteEvidence(note: string): EvidenceDescription {
  const normalized = normalize(note);
  const exact = EXACT_NOTE_EVIDENCE[normalized];
  if (exact) return exact;

  for (const [needles, evidence] of FAMILY_EVIDENCE) {
    if (needles.some((needle) => normalized.includes(needle))) return evidence;
  }

  return {
    description:
      "an unfamiliar scented fragment—distinctive, carefully placed, and preserved for analysis",
    object: "the unfamiliar scented fragment",
  };
}

function accordEvidence(accord: string): EvidenceDescription {
  const normalized = normalize(accord);
  return (
    ACCORD_EVIDENCE[normalized] ?? {
      description:
        "a coherent scent signature that tied the otherwise unrelated evidence together",
      object: "the scene’s overall scent signature",
    }
  );
}

function choose<T>(items: readonly T[], random: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))]!;
}

function chooseScene(fragrance: Fragrance, random: () => number): SceneTemplate {
  const accords = fragrance.accords.map(normalize);
  const ranked = SCENE_TEMPLATES.map((scene) => ({
    scene,
    score: scene.preferredAccords.filter((accord) =>
      accords.some((candidate) => candidate.includes(accord)),
    ).length,
  }));
  const bestScore = Math.max(...ranked.map(({ score }) => score));
  const candidates = ranked
    .filter(({ score }) => score === bestScore)
    .map(({ scene }) => scene);
  return choose(candidates, random);
}

function chooseUnusedNote(
  notes: readonly string[],
  used: Set<string>,
  random: () => number,
): string {
  const candidates = notes.filter((note) => !used.has(normalize(note)));
  const source = candidates.length > 0 ? candidates : notes;
  const selected = choose(source, random);
  used.add(normalize(selected));
  return selected;
}

function buildClue(
  index: number,
  beat: string,
  value: string,
  source: CrimeSceneClueSource,
  evidence: EvidenceDescription,
): CrimeSceneClue {
  const sourceLabel =
    source === "accord" ? "main accord" : source.replace(" note", "");
  return {
    id: `evidence-${index + 1}`,
    label: `Evidence ${String(index + 1).padStart(2, "0")}`,
    text: `${beat} ${evidence.description}.`,
    source,
    value,
    explanation: `${evidence.object} represented ${value}, a ${sourceLabel} in the fragrance.`,
  };
}

export function isCrimeSceneEligible(fragrance: Fragrance): boolean {
  const uniqueNotes = new Set(
    [
      ...fragrance.topNotes,
      ...fragrance.heartNotes,
      ...fragrance.baseNotes,
    ].map(normalize),
  );
  return (
    fragrance.topNotes.length > 0 &&
    fragrance.heartNotes.length > 0 &&
    fragrance.baseNotes.length > 0 &&
    fragrance.accords.length > 0 &&
    uniqueNotes.size >= 4 &&
    (fragrance.votes ?? 0) >= 100
  );
}

export function createCrimeSceneChallenge(
  fragrances: readonly Fragrance[],
  random: () => number = Math.random,
): CrimeSceneChallenge {
  const eligible = fragrances.filter(isCrimeSceneEligible);
  if (eligible.length === 0) {
    throw new Error(
      "Fragrance Crime Scene needs a fragrance with notes, accords, and catalog votes.",
    );
  }

  const fragrance = choose(eligible, random);
  const scene = chooseScene(fragrance, random);
  const used = new Set<string>();
  const leadingAccords = fragrance.accords.slice(0, 3);
  const mappedAccords = leadingAccords.filter(
    (candidate) => ACCORD_EVIDENCE[normalize(candidate)],
  );
  const accord = choose(
    mappedAccords.length > 0 ? mappedAccords : leadingAccords,
    random,
  );
  const top = chooseUnusedNote(fragrance.topNotes, used, random);
  const heart = chooseUnusedNote(fragrance.heartNotes, used, random);
  const base = chooseUnusedNote(fragrance.baseNotes, used, random);
  const remainingNotes = [
    ...fragrance.topNotes,
    ...fragrance.heartNotes,
    ...fragrance.baseNotes,
  ];
  const finalNote = chooseUnusedNote(remainingNotes, used, random);
  const finalSource: CrimeSceneClueSource = fragrance.topNotes.includes(finalNote)
    ? "top note"
    : fragrance.heartNotes.includes(finalNote)
      ? "heart note"
      : "base note";

  const clueInputs: Array<{
    value: string;
    source: CrimeSceneClueSource;
    evidence: EvidenceDescription;
  }> = [
    { value: accord, source: "accord", evidence: accordEvidence(accord) },
    { value: top, source: "top note", evidence: noteEvidence(top) },
    { value: heart, source: "heart note", evidence: noteEvidence(heart) },
    { value: base, source: "base note", evidence: noteEvidence(base) },
    {
      value: finalNote,
      source: finalSource,
      evidence: noteEvidence(finalNote),
    },
  ];

  return {
    id: `crime-scene-${fragrance.id}-${scene.id}`,
    caseNumber: `${String(fragrance.year || 0).slice(-2)}-${fragrance.id
      .replace(/[^a-z0-9]/gi, "")
      .slice(0, 4)
      .toUpperCase()}`,
    title: scene.title,
    location: scene.location,
    briefing: scene.briefing,
    fragrance,
    clues: clueInputs.map((input, index) =>
      buildClue(
        index,
        scene.beats[index],
        input.value,
        input.source,
        input.evidence,
      ),
    ),
    maxGuesses: 5,
  };
}

export function scoreCrimeScene(revealedClues: number): number {
  const index = Math.max(
    0,
    Math.min(revealedClues - 1, CRIME_SCENE_SCORE_STEPS.length - 1),
  );
  return CRIME_SCENE_SCORE_STEPS[index];
}
