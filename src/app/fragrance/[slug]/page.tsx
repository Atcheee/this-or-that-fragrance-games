import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccordBars } from "@/components/AccordBars";
import { CatalogFragranceCard } from "@/components/CatalogFragranceCard";
import { FragranceBottleImage } from "@/components/FragranceBottleImage";
import { PerfumePyramid } from "@/components/PerfumePyramid";
import { UserRatings } from "@/components/UserRatings";
import { primaryBottleSrc } from "@/lib/bottle-images";
import {
  getFragranceBySlug,
  getPopularFragranceSlugs,
  getRelatedFragrances,
} from "@/lib/catalog";

interface FragrancePageProps {
  params: Promise<{ slug: string }>;
}

export const dynamicParams = true;

export function generateStaticParams() {
  return getPopularFragranceSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: FragrancePageProps): Promise<Metadata> {
  const { slug } = await params;
  const fragrance = getFragranceBySlug(slug);
  if (!fragrance) return { title: "Fragrance not found" };

  const description =
    fragrance.description ||
    `Explore ${fragrance.name} by ${fragrance.house}: notes, accords, rating, and related fragrances.`;
  const usableImage =
    fragrance.imageUrl && !fragrance.imageUrl.includes("cdn.fragella.com")
      ? fragrance.imageUrl
      : undefined;

  return {
    title: `${fragrance.name} by ${fragrance.house} — This or That`,
    description,
    alternates: { canonical: `/fragrance/${fragrance.slug}` },
    openGraph: {
      type: "article",
      title: `${fragrance.name} by ${fragrance.house}`,
      description,
      url: `/fragrance/${fragrance.slug}`,
      images: usableImage ? [{ url: usableImage }] : undefined,
    },
  };
}

export default async function FragrancePage({ params }: FragrancePageProps) {
  const { slug } = await params;
  const fragrance = getFragranceBySlug(slug);
  if (!fragrance) notFound();

  const related = getRelatedFragrances(fragrance);
  const heroSrc = primaryBottleSrc(fragrance.imageUrl);

  return (
    <article className="flex flex-col gap-8">
      {heroSrc ? (
        <>
          <link rel="preconnect" href="https://img.fraganty.ai" />
          <link
            rel="preconnect"
            href="https://media.thescentbase.com"
            crossOrigin="anonymous"
          />
        </>
      ) : null}

      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-2">
          <li>
            <Link href="/" className="hover:text-foreground">
              Home
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link href="/fragrances" className="hover:text-foreground">
              Fragrances
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li>
            <Link
              href={`/house/${fragrance.houseSlug}`}
              className="hover:text-foreground"
            >
              {fragrance.house}
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li className="truncate text-foreground" aria-current="page">
            {fragrance.name}
          </li>
        </ol>
      </nav>

      <section className="overflow-hidden rounded-3xl border border-border bg-card">
        <div className="grid gap-8 p-6 sm:p-8 md:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.4fr)]">
          <div className="bottle-studio flex min-h-72 items-center justify-center rounded-2xl px-4 py-6">
            <FragranceBottleImage
              imageUrl={fragrance.imageUrl}
              alt={`${fragrance.name} by ${fragrance.house} bottle`}
              eager
              width={480}
              height={640}
              sizes="(max-width: 768px) 70vw, 320px"
              className="max-h-80 w-auto max-w-full object-contain"
              placeholderClassName="h-44 w-auto text-stone-400 opacity-40"
              stage={false}
            />
          </div>

          <div className="flex min-w-0 flex-col justify-center">
            <Link
              href={`/house/${fragrance.houseSlug}`}
              className="w-fit text-sm font-semibold uppercase tracking-[0.16em] text-accent hover:underline"
            >
              {fragrance.house}
            </Link>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
              {fragrance.name}
            </h1>
            {fragrance.year > 0 ? (
              <p className="mt-2 text-muted">Released in {fragrance.year}</p>
            ) : null}

            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Fact
                label="Rating"
                value={
                  fragrance.rating > 0
                    ? `${fragrance.rating.toFixed(2)} / 5`
                    : "Unrated"
                }
              />
              <Fact
                label="Votes"
                value={
                  fragrance.votes
                    ? new Intl.NumberFormat("en").format(fragrance.votes)
                    : "Not listed"
                }
              />
              <Fact
                label="Price"
                value={
                  fragrance.price > 0
                    ? `~$${Math.round(fragrance.price)}`
                    : "Not listed"
                }
              />
              <Fact
                label="Accords"
                value={
                  fragrance.accords.length > 0
                    ? String(fragrance.accords.length)
                    : "Not listed"
                }
              />
            </dl>

            <p className="mt-5 text-xs leading-relaxed text-muted">
              Ratings and prices are approximate catalog data. Availability and
              bottle sizes may vary.
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700 dark:text-teal-400/90">
            Main accords
          </h2>
          <p className="mb-5 text-sm text-muted">
            Most to least prominent in the local catalog.
          </p>
          <AccordBars accords={fragrance.accords} />
        </section>

        <section className="rounded-2xl border border-border bg-card p-6">
          <PerfumePyramid
            topNotes={fragrance.topNotes}
            heartNotes={fragrance.heartNotes}
            baseNotes={fragrance.baseNotes}
          />
        </section>
      </div>

      <UserRatings
        rating={fragrance.rating}
        votes={fragrance.votes}
        accords={fragrance.accords}
        wearShares={fragrance.wear}
        longevity={fragrance.longevity}
        sillage={fragrance.sillage}
      />

      <section className="rounded-2xl border border-border bg-card p-6 sm:p-8">
        <h2 className="text-xl font-semibold">About this fragrance</h2>
        {fragrance.description ? (
          <p className="mt-4 max-w-3xl whitespace-pre-line leading-7 text-muted">
            {fragrance.description}
          </p>
        ) : (
          <p className="mt-4 text-muted">
            The local catalog does not yet include an editorial description for
            this fragrance. Its available notes, accords, rating, and release
            year are shown above.
          </p>
        )}
      </section>

      {related.length > 0 ? (
        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                You may also like
              </h2>
              <p className="mt-1 text-sm text-muted">
                Similar scents based on shared house, notes, and accords.
              </p>
            </div>
            <Link
              href={`/house/${fragrance.houseSlug}`}
              className="shrink-0 text-sm font-semibold text-accent hover:underline"
            >
              View house
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {related.map((item) => (
              <CatalogFragranceCard key={item.id} fragrance={item} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
