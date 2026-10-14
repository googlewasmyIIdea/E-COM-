export default function StoreLoading() {
  return (
    <main
      className="page-width py-4"
      aria-label="Loading store"
      aria-busy="true"
    >
      <div className="mb-5 h-32 animate-pulse rounded-2xl bg-mint/40" />
      <div className="mb-4 h-7 w-48 animate-pulse rounded-lg bg-mint/40" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} className="rounded-xl border border-ink/10 bg-white p-3">
            <div className="aspect-square animate-pulse rounded-lg bg-mint/30" />
            <div className="mt-3 h-4 animate-pulse rounded bg-mint/40" />
            <div className="mt-3 h-10 animate-pulse rounded bg-mint/30" />
          </div>
        ))}
      </div>
    </main>
  );
}
