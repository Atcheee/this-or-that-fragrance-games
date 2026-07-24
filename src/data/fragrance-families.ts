export type FamilyRelationship =
  | "Original release"
  | "New concentration"
  | "Intense reinterpretation"
  | "Fresh reinterpretation"
  | "New formula";

export interface FragranceFamilyMemberDefinition {
  fragranceId: string;
  relationship: FamilyRelationship;
  parentId?: string;
  lineageNote: string;
}

export interface FragranceFamilyDefinition {
  slug: string;
  name: string;
  house: string;
  summary: string;
  reviewedAt: string;
  members: FragranceFamilyMemberDefinition[];
  sources: Array<{ label: string; url: string }>;
}

/**
 * Family membership is deliberately curated. Do not generate entries from
 * fragrance names: similar names can describe unrelated scents.
 */
export const fragranceFamilyDefinitions: FragranceFamilyDefinition[] = [
  {
    slug: "dior-sauvage",
    name: "Sauvage",
    house: "Dior",
    summary:
      "From the bright, peppery 2015 original to richer concentrations and the water-based Eau Forte.",
    reviewedAt: "2026-07-24",
    members: [
      {
        fragranceId: "dior-sauvage",
        relationship: "Original release",
        lineageNote: "The modern Sauvage line begins here.",
      },
      {
        fragranceId: "scentbase-dior-sauvage-eau-de-parfum",
        parentId: "dior-sauvage",
        relationship: "New concentration",
        lineageNote: "A warmer Eau de Parfum interpretation.",
      },
      {
        fragranceId: "parfumo-dior-sauvageparfum",
        parentId: "dior-sauvage",
        relationship: "New concentration",
        lineageNote: "A denser Parfum interpretation of the Sauvage signature.",
      },
      {
        fragranceId: "scentbase-dior-sauvage-elixir",
        parentId: "dior-sauvage",
        relationship: "Intense reinterpretation",
        lineageNote: "A highly concentrated, spice-led branch.",
      },
      {
        fragranceId: "scentbase-dior-sauvage-eau-forte",
        parentId: "dior-sauvage",
        relationship: "New formula",
        lineageNote: "An alcohol-free, water-based reinterpretation.",
      },
    ],
    sources: [
      {
        label: "Dior — Sauvage Eau de Parfum",
        url: "https://www.dior.com/en_us/beauty/products/sauvage-eau-de-parfum-E000000376.html",
      },
      {
        label: "Dior — Sauvage Elixir",
        url: "https://www.dior.com/en_us/beauty/products/sauvage-elixir-C099600755.html",
      },
      {
        label: "Dior — Sauvage Eau Forte",
        url: "https://www.dior.com/en_us/beauty/products/sauvage-eau-forte-parfum-Y0998025.html",
      },
    ],
  },
  {
    slug: "chanel-no-5",
    name: "N°5",
    house: "Chanel",
    summary:
      "A century-spanning line of concentrations and modern reinterpretations built around the 1921 original.",
    reviewedAt: "2026-07-24",
    members: [
      {
        fragranceId: "chanel-no5",
        relationship: "Original release",
        lineageNote: "The original aldehydic floral composition.",
      },
      {
        fragranceId: "scentbase-chanel-chanel-no-5-eau-de-parfum",
        parentId: "chanel-no5",
        relationship: "New concentration",
        lineageNote: "The 1986 Eau de Parfum interpretation.",
      },
      {
        fragranceId: "scentbase-chanel-chanel-no-5-eau-premiere-2015",
        parentId: "chanel-no5",
        relationship: "Fresh reinterpretation",
        lineageNote: "A softer, luminous reinterpretation of N°5.",
      },
      {
        fragranceId: "scentbase-chanel-chanel-no-5-l-eau",
        parentId: "chanel-no5",
        relationship: "Fresh reinterpretation",
        lineageNote: "A citrus-led, contemporary Eau de Toilette branch.",
      },
    ],
    sources: [
      {
        label: "Chanel — The N°5 line",
        url: "https://www.chanel.com/gb/fragrance/chanel-number-5/a-number/",
      },
      {
        label: "Chanel — N°5 Eau Première",
        url: "https://www.chanel.com/us/fragrance/p/105330/n5-eau-premiere-eau-de-parfum-spray/",
      },
      {
        label: "Chanel — N°5 L'Eau",
        url: "https://www.chanel.com/fr/parfums/p/105520/n5-leau-eau-de-toilette-vaporisateur/",
      },
    ],
  },
  {
    slug: "ysl-libre",
    name: "Libre",
    house: "Yves Saint Laurent",
    summary:
      "The lavender-and-orange-blossom signature moves through lighter, richer, and more floral branches.",
    reviewedAt: "2026-07-24",
    members: [
      {
        fragranceId: "ysl-libre",
        relationship: "Original release",
        lineageNote: "The 2019 Eau de Parfum starts the Libre line.",
      },
      {
        fragranceId: "scentbase-yves-saint-laurent-libre-intense",
        parentId: "ysl-libre",
        relationship: "Intense reinterpretation",
        lineageNote: "A sweeter, more concentrated take on the original.",
      },
      {
        fragranceId: "scentbase-yves-saint-laurent-libre-eau-de-toilette",
        parentId: "ysl-libre",
        relationship: "New concentration",
        lineageNote: "A lighter Eau de Toilette with jasmine tea.",
      },
      {
        fragranceId: "scentbase-yves-saint-laurent-libre-le-parfum",
        parentId: "ysl-libre",
        relationship: "New concentration",
        lineageNote: "A warm, honeyed Parfum branch.",
      },
      {
        fragranceId: "parfumo-yvessaintlaurent-librelabsoluplatine",
        parentId: "ysl-libre",
        relationship: "Intense reinterpretation",
        lineageNote: "A cool, metallic-lavender reinterpretation.",
      },
      {
        fragranceId: "scentbase-yves-saint-laurent-libre-flowers-flames",
        parentId: "ysl-libre",
        relationship: "Fresh reinterpretation",
        lineageNote: "A solar floral branch with lily and coconut.",
      },
      {
        fragranceId: "scentbase-yves-saint-laurent-libre-leau-nue",
        parentId: "ysl-libre",
        relationship: "New formula",
        lineageNote: "An alcohol-free citrus and orange-blossom interpretation.",
      },
    ],
    sources: [
      {
        label: "YSL Beauty — Libre Eau de Parfum",
        url: "https://www.yslbeauty.com/int/fragrance/fragrance-for-her/libre/libre-eau-de-parfum/3614272648425.html",
      },
      {
        label: "YSL Beauty — Libre L'Absolu Platine",
        url: "https://www.yslbeauty.com/int/fragrance/feminine-fragrance/libre/libre-l-absolu-platine/3614273923859.html",
      },
    ],
  },
];
