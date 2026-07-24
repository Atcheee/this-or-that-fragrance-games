import "server-only";

import {
  fragranceFamilyDefinitions,
  type FragranceFamilyDefinition,
  type FragranceFamilyMemberDefinition,
} from "@/data/fragrance-families";
import {
  getFragranceById,
  type CatalogFragrance,
} from "@/lib/catalog";

export interface FragranceFamilyMember
  extends FragranceFamilyMemberDefinition {
  fragrance: CatalogFragrance;
}

export interface FragranceFamily
  extends Omit<FragranceFamilyDefinition, "members"> {
  members: FragranceFamilyMember[];
}

function resolveFamily(
  definition: FragranceFamilyDefinition,
): FragranceFamily {
  const members = definition.members
    .map((member) => {
      const fragrance = getFragranceById(member.fragranceId);
      if (!fragrance) {
        throw new Error(
          `Curated family "${definition.slug}" references missing fragrance "${member.fragranceId}".`,
        );
      }
      return { ...member, fragrance };
    })
    .sort(
      (a, b) =>
        a.fragrance.year - b.fragrance.year ||
        a.fragrance.name.localeCompare(b.fragrance.name),
    );

  return { ...definition, members };
}

const families = fragranceFamilyDefinitions.map(resolveFamily);
const familyBySlug = new Map(families.map((family) => [family.slug, family]));
const familyByFragranceId = new Map<string, FragranceFamily>();

for (const family of families) {
  for (const member of family.members) {
    familyByFragranceId.set(member.fragranceId, family);
  }
}

export function getAllFragranceFamilies(): readonly FragranceFamily[] {
  return families;
}

export function getFragranceFamilyBySlug(
  slug: string,
): FragranceFamily | undefined {
  return familyBySlug.get(slug);
}

export function getFragranceFamilyForFragrance(
  fragranceId: string,
): FragranceFamily | undefined {
  return familyByFragranceId.get(fragranceId);
}

export function getFragranceFamilySlugs(): string[] {
  return families.map((family) => family.slug);
}
