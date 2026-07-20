import type { ReactNode } from "react";
import {
  deriveSentimentBuckets,
  deriveWearBuckets,
  formatCount,
  type SentimentBucket,
  type WearBucket,
} from "@/lib/visuals/wear-profile";

interface UserRatingsProps {
  rating: number;
  votes?: number;
  accords: string[];
  wearShares?: Partial<Record<WearBucket["id"], number>>;
  longevity?: string;
  sillage?: string;
}

export function UserRatings({
  rating,
  votes = 0,
  accords,
  wearShares,
  longevity,
  sillage,
}: UserRatingsProps) {
  const sentiments = deriveSentimentBuckets(rating, votes);
  const wear = deriveWearBuckets(accords, votes, wearShares);
  const maxSentiment = Math.max(...sentiments.map((s) => s.share), 0.01);
  const maxWear = Math.max(...wear.map((w) => w.share), 0.01);
  const hasRating = rating > 0;
  const hasStoredWear = Boolean(
    wearShares && Object.values(wearShares).some((v) => (v ?? 0) > 0),
  );

  return (
    <section aria-label="User ratings" className="space-y-4">
      <h2 className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-muted">
        User ratings
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5">
          <header className="mb-5 flex items-center gap-2">
            <HeartIcon className="h-4 w-4 text-pink-600 dark:text-pink-400" />
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              Rating
            </h3>
          </header>
          {hasRating ? (
            <div className="grid grid-cols-5 gap-2 sm:gap-3">
              {sentiments.map((bucket) => (
                <MetricColumn
                  key={bucket.id}
                  label={bucket.label}
                  count={bucket.count}
                  color={bucket.color}
                  fillRatio={bucket.share / maxSentiment}
                  icon={<SentimentEmoji id={bucket.id} />}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No rating data available.</p>
          )}
        </div>

        <div className="rounded-2xl border border-border bg-card p-5">
          <header className="mb-5 flex items-center gap-2">
            <ClockIcon className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
              When to wear
            </h3>
          </header>
          {accords.length > 0 || votes > 0 ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
              {wear.map((bucket) => (
                <MetricColumn
                  key={bucket.id}
                  label={bucket.label}
                  count={bucket.count}
                  color={bucket.color}
                  fillRatio={bucket.share / maxWear}
                  icon={<WearIcon id={bucket.id} color={bucket.color} />}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No occasion data available.</p>
          )}
        </div>
      </div>

      {hasRating ? (
        <p className="text-center text-sm text-muted">
          Perfume rating{" "}
          <span className="font-semibold text-teal-700 dark:text-teal-400">
            {rating.toFixed(2)}
          </span>{" "}
          out of 5
          {votes > 0 ? (
            <>
              {" "}
              with{" "}
              <span className="tabular-nums">
                {new Intl.NumberFormat("en").format(votes)}
              </span>{" "}
              votes
            </>
          ) : null}
          <span className="mt-1 block text-xs opacity-80">
            {hasStoredWear
              ? "Sentiment bars are estimated from rating and votes; wear bars use catalog occasion rankings when available."
              : "Sentiment and wear bars are estimated from catalog rating, votes, and accords."}
          </span>
        </p>
      ) : null}

      {longevity || sillage ? (
        <dl className="mx-auto grid max-w-md grid-cols-2 gap-3 text-center text-sm">
          {longevity ? (
            <div className="rounded-xl border border-border bg-card px-3 py-2">
              <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">
                Longevity
              </dt>
              <dd className="mt-1 font-semibold text-foreground">{longevity}</dd>
            </div>
          ) : null}
          {sillage ? (
            <div className="rounded-xl border border-border bg-card px-3 py-2">
              <dt className="text-[11px] uppercase tracking-[0.14em] text-muted">
                Sillage
              </dt>
              <dd className="mt-1 font-semibold text-foreground">{sillage}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </section>
  );
}

function MetricColumn({
  label,
  count,
  color,
  fillRatio,
  icon,
}: {
  label: string;
  count: number;
  color: string;
  fillRatio: number;
  icon: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5">
      <div className="flex h-6 items-center justify-center">{icon}</div>
      <span className="text-[11px] lowercase text-muted">{label}</span>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/70">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.max(8, fillRatio * 100)}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span
        className="text-xs font-semibold tabular-nums"
        style={{ color }}
      >
        {formatCount(count)}
      </span>
    </div>
  );
}

function SentimentEmoji({ id }: { id: SentimentBucket["id"] }) {
  const map: Record<SentimentBucket["id"], string> = {
    love: "😍",
    like: "🙂",
    ok: "😐",
    dislike: "🙁",
    hate: "😠",
  };
  return (
    <span className="text-xl leading-none" aria-hidden>
      {map[id]}
    </span>
  );
}

function WearIcon({
  id,
  color,
}: {
  id: WearBucket["id"];
  color: string;
}) {
  const common = "h-5 w-5";
  switch (id) {
    case "winter":
      return <SnowflakeIcon className={common} color={color} />;
    case "spring":
      return <LeafIcon className={common} color={color} />;
    case "summer":
      return <UmbrellaIcon className={common} color={color} />;
    case "fall":
      return <MapleIcon className={common} color={color} />;
    case "day":
      return <SunIcon className={common} color={color} />;
    case "night":
      return <MoonIcon className={common} color={color} />;
  }
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 21s-6.7-4.35-9.33-7.4C.7 11.3 1.1 7.9 3.6 6.3c1.9-1.2 4.3-.7 5.7 1.1L12 10l2.7-2.6c1.4-1.8 3.8-2.3 5.7-1.1 2.5 1.6 2.9 5 1 7.3C18.7 16.65 12 21 12 21z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function SnowflakeIcon({
  className,
  color,
}: {
  className?: string;
  color: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M12 3v18M5 7l14 10M19 7 5 17M4 12h16" />
    </svg>
  );
}

function LeafIcon({
  className,
  color,
}: {
  className?: string;
  color: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill={color} className={className} aria-hidden>
      <path d="M17 4c-5 1-9 5-10 10-1 4 1 7 4 8 5-1 9-5 10-10 1-4-1-7-4-8z" />
      <path
        d="M8 16c2-2 5-5 8-8"
        stroke="#0f172a"
        strokeWidth="1.2"
        fill="none"
      />
    </svg>
  );
}

function UmbrellaIcon({
  className,
  color,
}: {
  className?: string;
  color: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M4 13a8 8 0 0 1 16 0H4z" fill={color} stroke="none" />
      <path d="M12 13v6a2 2 0 0 0 4 0" />
    </svg>
  );
}

function MapleIcon({
  className,
  color,
}: {
  className?: string;
  color: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill={color} className={className} aria-hidden>
      <path d="M12 3l2.2 3.2L18 5l-1 3.5L21 11l-3.5.8L19 16l-4-1.2L12 19l-3-4.2L5 16l1.5-4.2L3 11l4-2.5L6 5l3.8 1.2L12 3z" />
      <path d="M12 19v2" stroke="#0f172a" strokeWidth="1.4" />
    </svg>
  );
}

function SunIcon({
  className,
  color,
}: {
  className?: string;
  color: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.75"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="3.5" fill={color} stroke="none" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
    </svg>
  );
}

function MoonIcon({
  className,
  color,
}: {
  className?: string;
  color: string;
}) {
  return (
    <svg viewBox="0 0 24 24" fill={color} className={className} aria-hidden>
      <path d="M16 3a8.5 8.5 0 1 0 5 14.5A7 7 0 1 1 16 3z" />
      <circle cx="18.5" cy="7" r="0.8" fill="#f8fafc" />
      <circle cx="20.2" cy="10.2" r="0.55" fill="#f8fafc" />
    </svg>
  );
}
