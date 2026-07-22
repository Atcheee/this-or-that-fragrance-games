import { CalendarDots } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import { ModeGrid } from "@/components/ModeGrid";

export default function Home() {
  return (
    <div className="flex flex-col gap-10 pb-8 sm:gap-12">
      <section className="max-w-3xl">
        <h1 className="text-5xl font-bold leading-[0.98] tracking-[-0.055em] sm:text-6xl">
          Pick a game.
          <br />
          Trust <span className="text-accent">your</span> nose.
        </h1>
        <p className="mt-6 max-w-md text-base leading-6 text-muted sm:text-lg">
          Eighteen games. Different ways to play.
          <br />
          One thing in common: your taste.
        </p>
      </section>

      <Link
        href="/play/connections-daily"
        className="group flex flex-col gap-5 rounded-2xl border border-accent/30 bg-card px-6 py-5 hover:border-accent sm:flex-row sm:items-center sm:px-8"
      >
        <span className="flex size-16 shrink-0 items-center justify-center text-accent sm:size-20">
          <CalendarDots aria-hidden size={52} weight="light" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="inline-flex rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
            Daily
          </span>
          <span className="mt-2 block text-xl font-semibold tracking-tight sm:text-2xl">
            Daily Connections
          </span>
          <span className="mt-1 block text-sm text-muted sm:text-base">
            One shared fragrance puzzle every UTC day.
          </span>
        </span>
        <span className="inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-9 font-semibold text-[#17120a] transition-transform group-hover:-translate-y-0.5 sm:ml-5">
          Play
        </span>
      </Link>

      <ModeGrid />
    </div>
  );
}
