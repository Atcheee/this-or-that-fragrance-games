export default function FragrancesLoading() {
  return (
    <div className="flex flex-1 flex-col gap-8 pb-8">
      <div className="h-40 animate-pulse rounded-3xl border border-border bg-card" />
      <div className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, index) => (
          <div
            key={index}
            className="h-64 animate-pulse rounded-2xl border border-border bg-card"
          />
        ))}
      </div>
    </div>
  );
}
