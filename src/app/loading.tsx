export default function HomeLoading() {
  return (
    <div className="flex flex-col gap-10 pb-8 sm:gap-12">
      <div className="max-w-3xl space-y-4">
        <div className="h-16 max-w-xl animate-pulse rounded-2xl bg-card" />
        <div className="h-16 max-w-lg animate-pulse rounded-2xl bg-card" />
        <div className="mt-6 h-12 max-w-md animate-pulse rounded-xl bg-card" />
      </div>
      <div className="h-28 animate-pulse rounded-2xl border border-border bg-card" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-2xl border border-border bg-card"
          />
        ))}
      </div>
    </div>
  );
}
