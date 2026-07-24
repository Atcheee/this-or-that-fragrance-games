import "server-only";

import type { CatalogFragrance } from "@/lib/catalog";
import { sample, shuffle } from "@/lib/random";

export interface FakeOrRealConcept {
  id: string;
  name: string;
  house: string;
  year: number;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  accords: string[];
  description: string;
}

export interface FakeOrRealRound extends FakeOrRealConcept {
  isReal: boolean;
  explanation: string;
  realSlug?: string;
}

interface FakeConcept extends FakeOrRealConcept {
  explanation: string;
}

const FAKE_CONCEPTS: FakeConcept[] = [
  {
    id: "fake-velours-de-minuit",
    name: "Velours de Minuit",
    house: "Guerlain",
    year: 2018,
    topNotes: ["Bergamot", "Plum"],
    heartNotes: ["Iris", "Rose", "Incense"],
    baseNotes: ["Vanilla", "Benzoin", "Sandalwood"],
    accords: ["powdery", "amber", "floral", "warm spicy"],
    description:
      "A twilight iris wrapped in dark plum and rose, settling into Guerlain's familiar trail of vanilla, benzoin, and polished woods.",
    explanation:
      "The French name, powdery iris, and vanilla-benzoin base echo Guerlain signatures. The tidy twilight story makes the invented concept feel archival.",
  },
  {
    id: "fake-after-the-storm",
    name: "Replica After the Storm",
    house: "Maison Martin Margiela",
    year: 2021,
    topNotes: ["Rain Notes", "Bergamot", "Violet Leaf"],
    heartNotes: ["Wet Stone", "Iris", "Pine"],
    baseNotes: ["Patchouli", "Musk", "Cedar"],
    accords: ["aquatic", "woody", "ozonic", "earthy"],
    description:
      "A memory of warm pavement after summer rain, where mineral air, damp pine, and clean musk linger beneath clearing skies.",
    explanation:
      "The memory-and-place framing matches the Replica line, while rain, wet stone, and musk form a plausible atmospheric pyramid.",
  },
  {
    id: "fake-saffron-smoke",
    name: "Saffron Smoke",
    house: "Tom Ford",
    year: 2020,
    topNotes: ["Saffron", "Black Pepper"],
    heartNotes: ["Tobacco", "Rose", "Incense"],
    baseNotes: ["Oud", "Leather", "Labdanum"],
    accords: ["warm spicy", "smoky", "leather", "amber"],
    description:
      "Saffron ignites a dark accord of tobacco and rose before oud, leather, and resin leave a polished trail of smoke.",
    explanation:
      "A blunt two-word name, luxurious materials, and a dense smoky-amber structure closely mirror Tom Ford's Private Blend vocabulary.",
  },
  {
    id: "fake-bois-de-verre",
    name: "Bois de Verre",
    house: "Diptyque",
    year: 2019,
    topNotes: ["Juniper", "Bergamot"],
    heartNotes: ["Mastic", "Fig Leaf", "Cypress"],
    baseNotes: ["Cedar", "Mineral Notes", "White Musk"],
    accords: ["woody", "aromatic", "green", "mineral"],
    description:
      "A transparent wood shaped by juniper, green fig leaf, and cool mineral facets, softened by cedar and white musk.",
    explanation:
      "The poetic French title and contrast between transparent texture and natural materials fit Diptyque's restrained naming style.",
  },
  {
    id: "fake-black-tea-quince",
    name: "Black Tea & Quince",
    house: "Jo Malone London",
    year: 2017,
    topNotes: ["Quince", "Bergamot"],
    heartNotes: ["Black Tea", "Rose"],
    baseNotes: ["Hay", "White Musk"],
    accords: ["fruity", "fresh spicy", "green", "floral"],
    description:
      "Tart quince brightens an infusion of black tea and soft rose, grounded by sun-dried hay and sheer musk.",
    explanation:
      "The ingredient-pair name, sparse note list, and transparent cologne structure follow Jo Malone conventions without copying an entry.",
  },
  {
    id: "fake-static-bloom",
    name: "Static Bloom",
    house: "Byredo",
    year: 2022,
    topNotes: ["Aldehydes", "Pink Pepper"],
    heartNotes: ["Magnolia", "Violet", "Ozone"],
    baseNotes: ["Ambroxan", "Musk", "Cashmere Wood"],
    accords: ["floral", "aldehydic", "musky", "ozonic"],
    description:
      "Electric aldehydes crackle over magnolia and violet, fading into weightless musk and the warmth of cashmere wood.",
    explanation:
      "An abstract two-word title and a clean, high-contrast floral idea resemble Byredo's modern conceptual language.",
  },
  {
    id: "fake-laurel-24",
    name: "Laurel 24",
    house: "Le Labo",
    year: 2023,
    topNotes: ["Bay Leaf", "Cardamom"],
    heartNotes: ["Laurel", "Incense", "Fig"],
    baseNotes: ["Cedar", "Vetiver", "Musk"],
    accords: ["aromatic", "woody", "fresh spicy", "smoky"],
    description:
      "A dry laurel leaf accord sharpened with cardamom, then rounded by incense, fig wood, and quiet musk.",
    explanation:
      "The hero ingredient plus formula number imitates Le Labo's naming system; the dry aromatic composition keeps the premise credible.",
  },
  {
    id: "fake-cipresso-di-sardegna",
    name: "Cipresso di Sardegna",
    house: "Acqua di Parma",
    year: 2016,
    topNotes: ["Lemon", "Myrtle", "Juniper"],
    heartNotes: ["Cypress", "Lentisque", "Lavender"],
    baseNotes: ["Cedar", "Pine Resin", "Musk"],
    accords: ["aromatic", "woody", "citrus", "green"],
    description:
      "A brisk Sardinian breeze carrying lemon, myrtle, and cypress over resinous woods and sun-warmed Mediterranean scrub.",
    explanation:
      "The Italian destination name, local botanicals, and citrus-aromatic shape convincingly match the Blu Mediterraneo house style.",
  },
  {
    id: "fake-cendre-des-roses",
    name: "La Cendre des Roses",
    house: "Serge Lutens",
    year: 2014,
    topNotes: ["Clove", "Rose"],
    heartNotes: ["Damask Rose", "Incense", "Cinnamon"],
    baseNotes: ["Ash", "Patchouli", "Labdanum"],
    accords: ["rose", "smoky", "warm spicy", "amber"],
    description:
      "A rose darkened at the edges: clove and incense smolder into ash, patchouli, and a resinous amber glow.",
    explanation:
      "The dramatic French metaphor and shadowy rose-incense treatment fit Serge Lutens' literary, material-rich catalog persona.",
  },
  {
    id: "fake-kingfisher",
    name: "Kingfisher",
    house: "Zoologist Perfumes",
    year: 2024,
    topNotes: ["Water Mint", "Mandarin", "Reed"],
    heartNotes: ["Lotus", "Blue Ginger", "River Pebbles"],
    baseNotes: ["Driftwood", "Musk", "Vetiver"],
    accords: ["aquatic", "green", "fresh spicy", "woody"],
    description:
      "A flash of blue above a cool river: crushed mint, lotus, wet pebbles, and pale driftwood trace the bird's waterside habitat.",
    explanation:
      "An animal title, habitat-led narrative, and unusual but readable materials reproduce Zoologist's signature world-building.",
  },
  {
    id: "fake-last-observatory",
    name: "The Last Observatory",
    house: "Imaginary Authors",
    year: 2020,
    topNotes: ["Cold Air", "Black Pepper"],
    heartNotes: ["Paper", "Orris", "Night-Blooming Jasmine"],
    baseNotes: ["Cedar", "Amber", "Machine Oil"],
    accords: ["woody", "powdery", "metallic", "amber"],
    description:
      "Dusty star charts, cedar shelves, and a trace of machine oil surround jasmine opening beneath a cold night sky.",
    explanation:
      "The novel-like title and cinematic mix of familiar and imaginary notes closely follow Imaginary Authors' storytelling formula.",
  },
  {
    id: "fake-botanists-alibi",
    name: "The Botanist's Alibi",
    house: "Penhaligon's",
    year: 2022,
    topNotes: ["Green Mandarin", "Absinthe"],
    heartNotes: ["Geranium", "Tomato Leaf", "Rosemary"],
    baseNotes: ["Oakmoss", "Vetiver", "Suede"],
    accords: ["green", "aromatic", "woody", "fresh spicy"],
    description:
      "A suspiciously immaculate greenhouse of tomato leaf, geranium, and rosemary conceals absinthe, suede, and earthy oakmoss.",
    explanation:
      "The eccentric character title and gently comic British narrative resemble Penhaligon's Portraits, backed by a plausible green fougère.",
  },
];

function normalizedName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function conceptFromReal(fragrance: CatalogFragrance): FakeOrRealRound {
  return {
    id: `real-${fragrance.id}`,
    name: fragrance.name,
    house: fragrance.house,
    year: fragrance.year,
    topNotes: fragrance.topNotes,
    heartNotes: fragrance.heartNotes,
    baseNotes: fragrance.baseNotes,
    accords: fragrance.accords,
    description: fragrance.description,
    isReal: true,
    explanation:
      "This name, description, and note pyramid come from a real entry in the fragrance catalog.",
    realSlug: fragrance.slug,
  };
}

function pickMatchingReal(
  fake: FakeConcept,
  catalog: readonly CatalogFragrance[],
  usedIds: Set<string>,
): CatalogFragrance | undefined {
  const eligible = catalog.filter(
    (fragrance) =>
      !usedIds.has(fragrance.id) &&
      fragrance.description.trim().length >= 50 &&
      fragrance.topNotes.length +
        fragrance.heartNotes.length +
        fragrance.baseNotes.length >=
        4 &&
      fragrance.accords.length >= 2,
  );
  const sameHouse = eligible.filter(
    (fragrance) =>
      fragrance.house.toLowerCase() === fake.house.toLowerCase(),
  );
  const candidates = sameHouse.length >= 3 ? sameHouse : eligible;
  const fakeNoteCount =
    fake.topNotes.length + fake.heartNotes.length + fake.baseNotes.length;

  const ranked = candidates
    .map((fragrance) => {
      const noteCount =
        fragrance.topNotes.length +
        fragrance.heartNotes.length +
        fragrance.baseNotes.length;
      const nameGap = Math.abs(fragrance.name.length - fake.name.length);
      const noteGap = Math.abs(noteCount - fakeNoteCount) * 4;
      const descriptionGap =
        Math.abs(
          Math.min(fragrance.description.length, 260) -
            fake.description.length,
        ) / 12;
      const popularityBonus = Math.min(
        Math.log10((fragrance.votes ?? 0) + 1) * 2,
        8,
      );
      return {
        fragrance,
        score: nameGap + noteGap + descriptionGap - popularityBonus,
      };
    })
    .sort((a, b) => a.score - b.score);

  return sample(ranked.slice(0, 8), 1)[0]?.fragrance;
}

function hasLongTruthRun(rounds: FakeOrRealRound[]): boolean {
  for (let index = 2; index < rounds.length; index += 1) {
    if (
      rounds[index]!.isReal === rounds[index - 1]!.isReal &&
      rounds[index]!.isReal === rounds[index - 2]!.isReal
    ) {
      return true;
    }
  }
  return false;
}

function balancedShuffle(rounds: FakeOrRealRound[]): FakeOrRealRound[] {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const candidate = shuffle(rounds);
    if (!hasLongTruthRun(candidate)) return candidate;
  }
  return shuffle(rounds);
}

export function generateFakeOrRealRounds(
  catalog: readonly CatalogFragrance[],
  requestedRounds: number,
): FakeOrRealRound[] {
  const total = Math.max(2, Math.min(requestedRounds, 20));
  const catalogNames = new Set(catalog.map((entry) => normalizedName(entry.name)));
  const availableFakes = FAKE_CONCEPTS.filter(
    (entry) => !catalogNames.has(normalizedName(entry.name)),
  );
  const fakeCount = Math.min(Math.floor(total / 2), availableFakes.length);
  const realCount = total - fakeCount;
  const selectedFakes = sample(availableFakes, fakeCount);
  const usedIds = new Set<string>();
  const matchedReals: CatalogFragrance[] = [];

  for (const fake of selectedFakes) {
    if (matchedReals.length >= realCount) break;
    const match = pickMatchingReal(fake, catalog, usedIds);
    if (!match) continue;
    usedIds.add(match.id);
    matchedReals.push(match);
  }

  const fallbackReals = sample(
    catalog.filter(
      (entry) =>
        !usedIds.has(entry.id) &&
        entry.description.trim().length >= 50 &&
        entry.accords.length >= 2,
    ),
    realCount - matchedReals.length,
  );

  return balancedShuffle([
    ...selectedFakes.map((entry) => ({
      ...entry,
      isReal: false,
    })),
    ...matchedReals.map(conceptFromReal),
    ...fallbackReals.map(conceptFromReal),
  ]);
}
