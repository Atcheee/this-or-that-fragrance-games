export default function HousesLoading() {
  return (
    <div className="flex flex-1 flex-col gap-8 pb-8">
      <div className="h-40 animate-pulse rounded-3xl border border-border bg-card" />
      <div className="h-24 animate-pulse rounded-2xl border border-border bg-card" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div
            key={index}
            className="h-44 animate-pulse rounded-2xl border border-border bg-card"
          />
        ))}
      </div>
    </div>
  );
}
