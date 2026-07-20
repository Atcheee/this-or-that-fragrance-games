import type { ConnectionPuzzle } from "@/lib/types";

export const CONNECTION_PUZZLES: ConnectionPuzzle[] = [
  {
    id: "signature-notes-and-styles",
    groups: [
      {
        id: "pineapple-note",
        label: "Contain pineapple",
        difficulty: "yellow",
        fragranceIds: [
          "creed-aventus",
          "armaf-club-de-nuit-intense",
          "ck-one",
          "fragrantica-99238",
        ],
        match: { kind: "note", value: "Pineapple" },
      },
      {
        id: "chanel-house",
        label: "Made by Chanel",
        difficulty: "green",
        fragranceIds: [
          "fragrantica-25967",
          "parfumo-chanel-allurehomme",
          "parfumo-chanel-allurehommeeditionblanche",
          "parfumo-chanel-pourmonsieuragentlemanscologneformen",
        ],
        match: { kind: "house", value: "Chanel" },
      },
      {
        id: "aquatic-accord",
        label: "Have an aquatic accord",
        difficulty: "blue",
        fragranceIds: [
          "rabanne-invictus",
          "fragrantica-32191",
          "issey-leau-dissey",
          "fragrantica-66627",
        ],
        match: { kind: "accord", value: "aquatic" },
      },
      {
        id: "tobacco-note",
        label: "Have a tobacco accord",
        difficulty: "purple",
        fragranceIds: [
          "tom-ford-tobacco-vanille",
          "fragrantica-20541",
          "fragrantica-30529",
          "fragella-jeanpaulgaultier-lemaleelixir",
        ],
        match: { kind: "accord", value: "tobacco" },
      },
    ],
  },
  {
    id: "cinnamon-jpg-aquatic-creed",
    groups: [
      {
        id: "cinnamon-note",
        label: "Contain cinnamon",
        difficulty: "yellow",
        fragranceIds: [
          "fragrantica-75805",
          "fragrantica-62615",
          "fragrantica-30529",
          "fragella-parfumsdemarly-althair",
        ],
        match: { kind: "note", value: "Cinnamon" },
      },
      {
        id: "jean-paul-gaultier-house",
        label: "Made by Jean Paul Gaultier",
        difficulty: "green",
        fragranceIds: [
          "jpg-le-male-le-parfum",
          "fragella-jeanpaulgaultier-lemaleelixir",
          "fragella-jeanpaulgaultier-lebeauleparfum",
          "parfumo-jeanpaulgaultier-lebeau",
        ],
        match: { kind: "house", value: "Jean Paul Gaultier" },
      },
      {
        id: "aquatic-accord",
        label: "Have an aquatic accord",
        difficulty: "blue",
        fragranceIds: [
          "rabanne-invictus",
          "armani-acqua-di-gio",
          "issey-leau-dissey",
          "davidoff-cool-water",
        ],
        match: { kind: "accord", value: "aquatic" },
      },
      {
        id: "creed-house",
        label: "Made by Creed",
        difficulty: "purple",
        fragranceIds: [
          "creed-aventus",
          "creed-green-irish-tweed",
          "creed-silver-mountain-water",
          "parfumo-creed-originalvetiver",
        ],
        match: { kind: "house", value: "Creed" },
      },
    ],
  },
  {
    id: "apple-tom-ford-aquatic-amouage",
    groups: [
      {
        id: "apple-note-family",
        label: "Contain an apple note",
        difficulty: "yellow",
        fragranceIds: [
          "ysl-y-edp",
          "creed-aventus",
          "versace-eros",
          "pdm-layton",
        ],
        match: { kind: "curated" },
      },
      {
        id: "tom-ford-house",
        label: "Made by Tom Ford",
        difficulty: "green",
        fragranceIds: [
          "tom-ford-tobacco-vanille",
          "tom-ford-oud-wood",
          "tom-ford-lost-cherry",
          "tom-ford-black-orchid",
        ],
        match: { kind: "house", value: "Tom Ford" },
      },
      {
        id: "aquatic-accord",
        label: "Have an aquatic accord",
        difficulty: "blue",
        fragranceIds: [
          "rabanne-invictus",
          "armani-acqua-di-gio",
          "issey-leau-dissey",
          "parfumo-bvlgari-aqvaamara",
        ],
        match: { kind: "accord", value: "aquatic" },
      },
      {
        id: "amouage-house",
        label: "Made by Amouage",
        difficulty: "purple",
        fragranceIds: [
          "amouage-reflection-man",
          "amouage-interlude-man",
          "parfumo-amouage-lyricman",
          "parfumo-amouage-memoirman",
        ],
        match: { kind: "house", value: "Amouage" },
      },
    ],
  },
  {
    id: "lavender-dior-gourmand-xerjoff",
    groups: [
      {
        id: "lavender-note-family",
        label: "Contain a lavender note",
        difficulty: "yellow",
        fragranceIds: [
          "jpg-le-male",
          "ysl-la-nuit-de-lhomme",
          "fragrantica-65414",
          "parfumo-montblanc-individuel",
        ],
        match: { kind: "curated" },
      },
      {
        id: "dior-house",
        label: "Made by Dior",
        difficulty: "green",
        fragranceIds: [
          "parfumo-dior-diorhomme",
          "parfumo-dior-diorhommesport",
          "parfumo-dior-oudispahan",
          "parfumo-dior-poison",
        ],
        match: { kind: "house", value: "Dior" },
      },
      {
        id: "gourmand-accord",
        label: "Have a gourmand accord",
        difficulty: "blue",
        fragranceIds: [
          "mugler-angel",
          "parfumo-lancome-lavieestbelleleaudeparfum",
          "parfumo-prada-candy",
          "parfumo-kilian-backtoblackaphrodisiac",
        ],
        match: { kind: "accord", value: "gourmand" },
      },
      {
        id: "xerjoff-house",
        label: "Made by Xerjoff",
        difficulty: "purple",
        fragranceIds: [
          "xerjoff-erba-pura",
          "fragella-xerjoff-accento",
          "parfumo-xerjoff-torino22",
          "parfumo-xerjoff-apollonia",
        ],
        match: { kind: "house", value: "Xerjoff" },
      },
    ],
  },
];
