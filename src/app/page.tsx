import { ModeGrid } from "@/components/ModeGrid";

export default function Home() {
  return (
    <div className="flex flex-col gap-10">
      <section className="pt-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Fragrance <span className="text-accent">This or That</span>
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-muted">
          Ten games: test your nose-knowledge on ratings, prices, notes, and
          houses — or discover your perfect fragrance with a preference quiz.
        </p>
      </section>
      <ModeGrid />
    </div>
  );
}
