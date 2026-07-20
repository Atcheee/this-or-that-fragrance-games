import { dailySeed, hashSeed, seededShuffle, utcDateKey } from "../daily";

export type BuildAnAccordVariant = "daily" | "practice";
export type AccordNoteLayer = "top" | "heart" | "base";
export type AccordNoteRole = "structure" | "character";
export type AccordRelevance = "core" | "supporting" | "neutral" | "conflicting";

export interface AccordNoteOption {
  id: string;
  label: string;
  layer: AccordNoteLayer;
  role: AccordNoteRole;
  relevance: AccordRelevance;
  insight: string;
}

export interface AccordProfile {
  id: string;
  name: string;
  brief: string;
  explanation: string;
  selectionLimit: number;
  idealNoteIds: readonly string[];
  notes: readonly AccordNoteOption[];
}

export interface BuildAnAccordRound {
  id: string;
  profile: AccordProfile;
  options: AccordNoteOption[];
}

export interface AccordScoredNote extends AccordNoteOption {
  points: number;
}

export interface BuildAnAccordScore {
  points: number;
  relevancePoints: number;
  balanceBonus: number;
  maxPoints: number;
  percentage: number;
  strong: AccordScoredNote[];
  weak: AccordScoredNote[];
  neutral: AccordScoredNote[];
  summary: string;
}

export const ACCORD_RELEVANCE_POINTS: Readonly<Record<AccordRelevance, number>> = {
  core: 25,
  supporting: 15,
  neutral: 5,
  conflicting: -10,
};

const profiles: readonly AccordProfile[] = [
  profile(
    "warm-gourmand",
    "Warm gourmand",
    "Build an edible, enveloping accord with sweetness, roasted depth, and a lasting base.",
    "Vanilla and caramel form the edible core. Coffee supplies roasted contrast, while tonka bean extends the warmth into the base without making the accord one-dimensional.",
    [
      note("vanilla", "Vanilla", "base", "structure", "core", "Creates the sweet, creamy foundation."),
      note("caramel", "Caramel", "heart", "character", "core", "Adds unmistakable cooked-sugar character."),
      note("coffee", "Coffee", "heart", "character", "core", "Gives roasted bitterness that keeps sweetness dimensional."),
      note("tonka", "Tonka bean", "base", "structure", "supporting", "Extends vanilla with almond-like warmth."),
      note("lemon", "Lemon", "top", "structure", "neutral", "Can brighten the opening but does not define this accord."),
      note("patchouli", "Patchouli", "base", "structure", "supporting", "Adds dark, earthy depth in a restrained dose."),
      note("mint", "Mint", "top", "character", "conflicting", "Its cooling sharpness fights the warm edible effect."),
      note("sea-salt", "Sea salt", "top", "character", "neutral", "May sharpen sweetness, but contributes little gourmand body."),
    ],
    ["vanilla", "caramel", "coffee", "tonka"],
  ),
  profile(
    "fresh-citrus",
    "Fresh citrus",
    "Compose a sparkling citrus accord that opens brightly and stays crisp rather than sugary.",
    "Bergamot and lemon provide lift, petitgrain adds leafy bitterness, and cedar gives a dry frame that prolongs freshness beyond the volatile opening.",
    [
      note("bergamot", "Bergamot", "top", "character", "core", "Supplies sparkling, aromatic citrus character."),
      note("lemon", "Lemon", "top", "character", "core", "Adds direct, high-impact brightness."),
      note("petitgrain", "Petitgrain", "heart", "structure", "core", "Bridges citrus peel to green woody facets."),
      note("cedar", "Cedar", "base", "structure", "supporting", "Provides a clean, dry frame for fleeting citrus notes."),
      note("neroli", "Neroli", "heart", "character", "supporting", "Adds floral citrus nuance."),
      note("ginger", "Ginger", "top", "character", "neutral", "Contributes fizz but can pull the accord spicy."),
      note("caramel", "Caramel", "heart", "structure", "conflicting", "Heavy sweetness dulls citrus sparkle."),
      note("oud", "Oud", "base", "character", "conflicting", "Dense animalic wood overwhelms a crisp citrus profile."),
    ],
    ["bergamot", "lemon", "petitgrain", "cedar"],
  ),
  profile(
    "aquatic",
    "Aquatic",
    "Create a transparent sea-air accord with watery freshness, mineral salinity, and clean diffusion.",
    "Marine notes establish water and air, sea salt supplies mineral texture, violet leaf adds a cool green-metallic bridge, and white musk creates clean diffusion.",
    [
      note("marine", "Marine notes", "top", "character", "core", "Creates the central water-and-air impression."),
      note("sea-salt", "Sea salt", "heart", "character", "core", "Adds recognizable mineral salinity."),
      note("violet-leaf", "Violet leaf", "heart", "structure", "core", "Links watery facets with cool green texture."),
      note("white-musk", "White musk", "base", "structure", "supporting", "Extends clean, diffusive freshness."),
      note("bergamot", "Bergamot", "top", "structure", "supporting", "Brightens the opening without adding weight."),
      note("watermelon", "Watermelon", "heart", "character", "neutral", "Can suggest water, though it risks a fruity direction."),
      note("tobacco", "Tobacco", "base", "character", "conflicting", "Dry warmth muddies marine transparency."),
      note("cinnamon", "Cinnamon", "heart", "character", "conflicting", "Hot spice opposes the accord's coolness."),
    ],
    ["marine", "sea-salt", "violet-leaf", "white-musk"],
  ),
  profile(
    "green-aromatic",
    "Green aromatic",
    "Build a brisk herbal accord with leafy bite, aromatic clarity, and a dry natural base.",
    "Galbanum supplies intense green structure. Lavender and rosemary create the aromatic heart, while vetiver grounds the herbs with dry roots and grass.",
    [
      note("galbanum", "Galbanum", "top", "structure", "core", "Provides sharp, resinous green structure."),
      note("lavender", "Lavender", "heart", "character", "core", "Defines the clean aromatic heart."),
      note("rosemary", "Rosemary", "heart", "character", "core", "Adds brisk culinary-herbal lift."),
      note("vetiver", "Vetiver", "base", "structure", "supporting", "Grounds herbs with dry roots and grass."),
      note("basil", "Basil", "top", "character", "supporting", "Reinforces the fresh herbal facet."),
      note("bergamot", "Bergamot", "top", "structure", "neutral", "Adds freshness but little green identity."),
      note("praline", "Praline", "base", "character", "conflicting", "Dense sweetness masks leafy bitterness."),
      note("amber", "Amber", "base", "structure", "conflicting", "Warm richness blunts this accord's brisk dryness."),
    ],
    ["galbanum", "lavender", "rosemary", "vetiver"],
  ),
  profile(
    "dry-woody",
    "Dry woody",
    "Construct a polished woody accord with grain, roots, and enough lift to avoid heaviness.",
    "Cedar gives pencil-dry grain, vetiver brings roots and smoke, sandalwood rounds the body, and bergamot opens space above the durable woods.",
    [
      note("cedar", "Cedar", "base", "structure", "core", "Creates the dry woody backbone."),
      note("vetiver", "Vetiver", "base", "character", "core", "Adds rooty, smoky definition."),
      note("sandalwood", "Sandalwood", "base", "structure", "core", "Rounds sharp woods with creamy volume."),
      note("bergamot", "Bergamot", "top", "character", "supporting", "Lifts the dense base and improves diffusion."),
      note("black-pepper", "Black pepper", "top", "character", "supporting", "Adds dry sparkle and texture."),
      note("patchouli", "Patchouli", "heart", "structure", "neutral", "Can deepen woods but may turn earthy."),
      note("strawberry", "Strawberry", "heart", "character", "conflicting", "Juicy sweetness distracts from dry timber."),
      note("coconut", "Coconut", "heart", "character", "conflicting", "Creamy tropical sweetness softens woody austerity too far."),
    ],
    ["cedar", "vetiver", "sandalwood", "bergamot"],
  ),
  profile(
    "smoky-leather",
    "Smoky leather",
    "Shape a dark leather accord with smoke, tannic dryness, and a controlled animalic edge.",
    "Leather and birch tar establish hide and smoke. Saffron adds a supple suede effect, while cedar provides dry construction underneath the dramatic character notes.",
    [
      note("leather", "Leather", "heart", "character", "core", "Defines the hide-like center."),
      note("birch-tar", "Birch tar", "base", "character", "core", "Creates charred, phenolic smoke."),
      note("saffron", "Saffron", "heart", "structure", "core", "Suggests warm, supple suede."),
      note("cedar", "Cedar", "base", "structure", "supporting", "Supplies a dry frame beneath smoke."),
      note("labdanum", "Labdanum", "base", "structure", "supporting", "Adds resinous depth and lasting warmth."),
      note("black-tea", "Black tea", "top", "character", "neutral", "Can add tannins, but is not essential."),
      note("melon", "Melon", "top", "character", "conflicting", "Watery fruit breaks the dark, dry illusion."),
      note("lily-of-the-valley", "Lily of the valley", "heart", "character", "conflicting", "Clean watery florals fight smoke and hide."),
    ],
    ["leather", "birch-tar", "saffron", "cedar"],
  ),
  profile(
    "amber-spice",
    "Amber spice",
    "Create a glowing resinous accord with sweet warmth, spice, and enough dryness to retain shape.",
    "Labdanum and benzoin form the balsamic amber body. Vanilla rounds their edges, while black pepper adds dry contrast so the warmth remains articulate.",
    [
      note("labdanum", "Labdanum", "base", "structure", "core", "Forms the dark resinous body."),
      note("benzoin", "Benzoin", "base", "structure", "core", "Adds balsamic, softly sweet warmth."),
      note("vanilla", "Vanilla", "base", "character", "core", "Rounds resins into a glowing amber effect."),
      note("black-pepper", "Black pepper", "top", "character", "supporting", "Cuts sweetness with dry spice."),
      note("cinnamon", "Cinnamon", "heart", "character", "supporting", "Intensifies warmth and spice."),
      note("patchouli", "Patchouli", "heart", "structure", "neutral", "Adds depth but can pull earthy."),
      note("cucumber", "Cucumber", "top", "character", "conflicting", "Watery coolness disrupts resinous warmth."),
      note("marine", "Marine notes", "top", "structure", "conflicting", "Ozonic water effects clash with dense balsams."),
    ],
    ["labdanum", "benzoin", "vanilla", "black-pepper"],
  ),
  profile(
    "white-floral",
    "Luminous white floral",
    "Build a radiant white-floral bouquet with creamy petals, green lift, and a soft lasting base.",
    "Jasmine and tuberose create floral radiance and creaminess. Orange blossom adds bright green facets, while sandalwood supports the bouquet without competing with it.",
    [
      note("jasmine", "Jasmine", "heart", "character", "core", "Provides radiant, diffusive floral character."),
      note("tuberose", "Tuberose", "heart", "character", "core", "Adds creamy, narcotic petal volume."),
      note("orange-blossom", "Orange blossom", "top", "structure", "core", "Brings green citrus lift to the bouquet."),
      note("sandalwood", "Sandalwood", "base", "structure", "supporting", "Supports creamy petals into the drydown."),
      note("ylang-ylang", "Ylang-ylang", "heart", "character", "supporting", "Adds sunny, tropical floral richness."),
      note("white-musk", "White musk", "base", "structure", "neutral", "Extends cleanliness but can flatten natural texture."),
      note("birch-tar", "Birch tar", "base", "character", "conflicting", "Harsh smoke overwhelms luminous petals."),
      note("sea-salt", "Sea salt", "top", "character", "conflicting", "Mineral salinity pulls focus from the bouquet."),
    ],
    ["jasmine", "tuberose", "orange-blossom", "sandalwood"],
  ),
  profile(
    "powdery-musk",
    "Powdery musk",
    "Compose a soft, clean powder accord with cosmetic texture and a warm skin-like drydown.",
    "Iris provides fine cosmetic powder, heliotrope adds almond softness, white musk creates clean diffusion, and sandalwood gives the accord a smooth lasting frame.",
    [
      note("iris", "Iris", "heart", "character", "core", "Creates fine cosmetic powder and cool elegance."),
      note("heliotrope", "Heliotrope", "heart", "character", "core", "Adds soft almond and vanilla-like powder."),
      note("white-musk", "White musk", "base", "structure", "core", "Provides clean, skin-like diffusion."),
      note("sandalwood", "Sandalwood", "base", "structure", "supporting", "Smooths and anchors the powder."),
      note("violet", "Violet", "heart", "character", "supporting", "Reinforces cosmetic floral powder."),
      note("bergamot", "Bergamot", "top", "structure", "neutral", "Offers opening lift without shaping the drydown."),
      note("seaweed", "Seaweed", "top", "character", "conflicting", "Iodic marine tones disrupt soft cleanliness."),
      note("coffee", "Coffee", "heart", "character", "conflicting", "Roasted bitterness dominates delicate powder."),
    ],
    ["iris", "heliotrope", "white-musk", "sandalwood"],
  ),
  profile(
    "juicy-fruity",
    "Juicy fruity",
    "Create a bright fruit accord with believable juiciness, floral body, and a clean base.",
    "Blackcurrant and peach combine tart and velvety fruit. Jasmine provides a floral heart rather than syrup, and white musk carries the colorful impression into a clean base.",
    [
      note("blackcurrant", "Blackcurrant", "top", "character", "core", "Adds tart, vivid berry character."),
      note("peach", "Peach", "heart", "character", "core", "Creates velvety, juicy fruit volume."),
      note("jasmine", "Jasmine", "heart", "structure", "core", "Gives fruit a diffusive floral body."),
      note("white-musk", "White musk", "base", "structure", "supporting", "Extends fruit cleanly without more sugar."),
      note("bergamot", "Bergamot", "top", "structure", "supporting", "Sharpens freshness around ripe fruit."),
      note("vanilla", "Vanilla", "base", "structure", "neutral", "Can soften fruit but risks a dessert effect."),
      note("birch-tar", "Birch tar", "base", "character", "conflicting", "Phenolic smoke crushes fresh fruit."),
      note("cumin", "Cumin", "heart", "character", "conflicting", "Animalic spice distracts from clean juiciness."),
    ],
    ["blackcurrant", "peach", "jasmine", "white-musk"],
  ),
];

export const BUILD_AN_ACCORD_PROFILES: readonly AccordProfile[] = profiles;

export function createBuildAnAccordRounds(options: {
  variant?: BuildAnAccordVariant;
  rounds?: number;
  date?: Date;
  seed?: number;
} = {}): BuildAnAccordRound[] {
  const variant = options.variant ?? "practice";
  const count = Math.max(1, Math.min(options.rounds ?? 5, profiles.length));
  const seed =
    options.seed ??
    (variant === "daily"
      ? dailySeed("build-an-accord", options.date)
      : hashSeed(`build-an-accord:practice:${Math.random()}:${Date.now()}`));
  const selected = seededShuffle(profiles, seed).slice(0, count);
  return selected.map((accord, index) => ({
    id: `${variant}-${seed.toString(36)}-${index}-${accord.id}`,
    profile: accord,
    options: seededShuffle(accord.notes, seed ^ hashSeed(`${accord.id}:${index}`)),
  }));
}

export function scoreBuildAnAccord(
  profileToScore: AccordProfile,
  selectedIds: readonly string[],
): BuildAnAccordScore {
  const uniqueIds = [...new Set(selectedIds)].slice(0, profileToScore.selectionLimit);
  const scored = uniqueIds
    .map((id) => profileToScore.notes.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is AccordNoteOption => Boolean(candidate))
    .map((candidate) => ({
      ...candidate,
      points: ACCORD_RELEVANCE_POINTS[candidate.relevance],
    }));
  const relevancePoints = scored.reduce((total, current) => total + current.points, 0);
  const balanceBonus = calculateBalanceBonus(scored);
  const points = Math.max(0, relevancePoints + balanceBonus);
  const maxPoints = maximumProfilePoints(profileToScore);
  const percentage = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;
  const strong = scored.filter(
    (candidate) => candidate.relevance === "core" || candidate.relevance === "supporting",
  );
  const weak = scored.filter((candidate) => candidate.relevance === "conflicting");
  const neutral = scored.filter((candidate) => candidate.relevance === "neutral");
  return {
    points,
    relevancePoints,
    balanceBonus,
    maxPoints,
    percentage: Math.min(100, Math.max(0, percentage)),
    strong,
    weak,
    neutral,
    summary: scoreSummary(percentage, weak.length),
  };
}

export function createBuildAnAccordShare(options: {
  percentages: readonly number[];
  variant?: BuildAnAccordVariant;
  date?: Date;
}): string {
  const title = options.variant === "daily"
    ? `Build an Accord Daily ${utcDateKey(options.date)}`
    : "Build an Accord";
  const blocks = options.percentages.map((percentage) =>
    percentage >= 90 ? "🟪" : percentage >= 70 ? "🟩" : percentage >= 45 ? "🟨" : "⬜",
  );
  const average = options.percentages.length
    ? Math.round(options.percentages.reduce((total, score) => total + score, 0) / options.percentages.length)
    : 0;
  return `${title}\n${blocks.join("")}\n${average}% average`;
}

function calculateBalanceBonus(notesToScore: readonly AccordScoredNote[]): number {
  if (!notesToScore.length) return 0;
  const roles = new Set(notesToScore.map((candidate) => candidate.role));
  const layers = new Set(notesToScore.map((candidate) => candidate.layer));
  const roleBonus = roles.size >= 2 ? 10 : 0;
  const layerBonus = layers.size >= 3 ? 10 : layers.size >= 2 ? 5 : 0;
  return roleBonus + layerBonus;
}

function maximumProfilePoints(profileToScore: AccordProfile): number {
  let maximum = 1;
  for (const combination of combinations(profileToScore.notes, profileToScore.selectionLimit)) {
    const relevance = combination.reduce(
      (total, current) => total + ACCORD_RELEVANCE_POINTS[current.relevance],
      0,
    );
    maximum = Math.max(
      maximum,
      relevance + calculateBalanceBonus(
        combination.map((candidate) => ({
          ...candidate,
          points: ACCORD_RELEVANCE_POINTS[candidate.relevance],
        })),
      ),
    );
  }
  return maximum;
}

function combinations<T>(items: readonly T[], count: number): T[][] {
  const result: T[][] = [];
  function visit(start: number, chosen: T[]) {
    if (chosen.length === count) {
      result.push(chosen);
      return;
    }
    for (let index = start; index <= items.length - (count - chosen.length); index += 1) {
      visit(index + 1, [...chosen, items[index]]);
    }
  }
  visit(0, []);
  return result;
}

function scoreSummary(percentage: number, conflicts: number): string {
  if (percentage >= 90) return "Expertly balanced. Your notes define the target and give it a clear structure.";
  if (percentage >= 70) return conflicts
    ? "Strong direction, though one choice pulls against the target."
    : "Strong accord. A more defining character note could make it exceptional.";
  if (percentage >= 45) return "Recognizable direction, but the structure and character need tighter focus.";
  return "This composition drifts from the brief. Use the feedback to rebuild its core.";
}

function profile(
  id: string,
  name: string,
  brief: string,
  explanation: string,
  notes: readonly AccordNoteOption[],
  idealNoteIds: readonly string[],
): AccordProfile {
  return { id, name, brief, explanation, selectionLimit: idealNoteIds.length, idealNoteIds, notes };
}

function note(
  id: string,
  label: string,
  layer: AccordNoteLayer,
  role: AccordNoteRole,
  relevance: AccordRelevance,
  insight: string,
): AccordNoteOption {
  return { id, label, layer, role, relevance, insight };
}
