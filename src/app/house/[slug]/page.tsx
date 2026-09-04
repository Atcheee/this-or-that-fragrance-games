import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { AccordBars } from "@/components/AccordBars";
import { JsonLd } from "@/components/JsonLd";
import {
  FragranceCollectionBrowser,
  type HouseCollectionItem,
} from "@/components/FragranceCollectionBrowser";
import { HouseMark } from "@/components/game/HouseMark";
import { getHouseBySlug } from "@/lib/catalog";
import { absoluteUrl } from "@/lib/site";
import { allNotes } from "@/lib/types";

interface HousePageProps {
  params: Promise<{ slug: string }>;
}

// Catalog data changes only with a new deployment. Render each selected house
// once on demand, then keep it cached for that deployment's lifetime.
export const dynamicParams = true;
export const revalidate = false;

export function generateStaticParams() {
  return [];
}

const getCachedHouseBySlug = cache(getHouseBySlug);

export async function generateMetadata({
  params,
}: HousePageProps): Promise<Metadata> {
  const { slug } = await params;
  const house = await getCachedHouseBySlug(slug);
  if (!house) return { title: "Fragrance house not found" };

  const description = `Explore ${house.fragranceCount} fragrances by ${house.name}. Search and filter the collection by name, year, notes, accords, rating, and popularity.`;

  return {
    title: `${house.name} fragrances — Scenthub`,
    description,
    alternates: { canonical: `/house/${house.slug}` },
    openGraph: {
      type: "website",
      title: `${house.name} fragrances`,
      description,
      url: `/house/${house.slug}`,
    },
  };
}

export default async function HousePage({ params }: HousePageProps) {
  const { slug } = await params;
  const house = await getCachedHouseBySlug(slug);
  if (!house) notFound();

  const collection: HouseCollectionItem[] = house.fragrances.map(
    (fragrance) => ({
      id: fragrance.id,
      name: fragrance.name,
      house: fragrance.house,
      year: fragrance.year,
      rating: fragrance.rating,
      votes: fragrance.votes,
      imageUrl: fragrance.imageUrl,
      slug: fragrance.slug,
      accords: fragrance.accords,
      notes: allNotes(fragrance),
    }),
  );

  const yearRange =
    house.firstYear && house.latestYear
      ? house.firstYear === house.latestYear
        ? String(house.firstYear)
        : `${house.firstYear}–${house.latestYear}`
      : "Not listed";
  const houseSchema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": absoluteUrl(`/house/${house.slug}#collection`),
        url: absoluteUrl(`/house/${house.slug}`),
        name: `${house.name} fragrances`,
        description: `Explore ${house.fragranceCount} fragrances by ${house.name}, including notes, accords, ratings, release years, and popularity.`,
        about: {
          "@type": "Brand",
          name: house.name,
        },
        mainEntity: {
          "@type": "ItemList",
          name: `${house.name} fragrance collection`,
          numberOfItems: house.fragranceCount,
        },
        isPartOf: { "@id": absoluteUrl("/#website") },
        inLanguage: "en",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Home",
            item: absoluteUrl("/"),
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Houses",
            item: absoluteUrl("/houses"),
          },
          {
            "@type": "ListItem",
            position: 3,
            name: house.name,
            item: absoluteUrl(`/house/${house.slug}`),
          },
        ],
      },
    ],
  };

  return (
    <>
      <JsonLd data={houseSchema} />
      <div className="flex flex-col gap-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex items-center gap-2">
          <li>
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/houses" className="hover:text-foreground">
              Houses
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="text-foreground" aria-current="page">
            {house.name}
          </li>
        </ol>
      </nav>

      <section className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[minmax(0,1.35fr)_minmax(260px,0.65fr)]">
          <div>
            <div className="flex items-start gap-4 sm:gap-5">
              <HouseMark name={house.name} size="lg" className="mt-1" />
              <div className="min-w-0">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-accent">
                  Fragrance house
                </p>
                <h1 className="mt-2 text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">
                  {house.name}
                </h1>
              </div>
            </div>
            <p className="mt-4 max-w-2xl leading-7 text-muted">
              Browse the local catalog for {house.name}. Search the complete
              collection or narrow it by notes, accords, release year, rating,
              and popularity.
            </p>

            <dl className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <HouseFact
                label="Fragrances"
                value={new Intl.NumberFormat("en").format(
                  house.fragranceCount,
                )}
              />
              <HouseFact label="Years" value={yearRange} />
              <HouseFact
                label="Average rating"
                value={
                  house.averageRating > 0
                    ? `${house.averageRating.toFixed(2)} / 5`
                    : "Not rated"
                }
              />
            </dl>
          </div>

          <div className="rounded-2xl border border-border bg-background p-5">
            <h2 className="font-semibold">Collection accord profile</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Most frequently listed accords across this house.
            </p>
            <div className="mt-5">
              <AccordBars
                accords={house.topAccords.map((accord) => accord.name)}
                label={`${house.name} collection accords`}
              />
            </div>
          </div>
        </div>
      </section>

      <FragranceCollectionBrowser
        houseName={house.name}
        items={collection}
      />
      </div>
    </>
  );
}

function HouseFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
