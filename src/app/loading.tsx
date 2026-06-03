// Route-level loading fallback. Mirrors the app shell silhouette (sticky nav
// bar + max-w-page content) so the swap to a real page causes no layout shift.
// Pure CSS animate-pulse — no custom keyframes — and respects reduced motion
// via the global media query in globals.css.
export default function Loading() {
  return (
    <div className="min-h-dvh" aria-busy="true" aria-label="Loading">
      {/* Nav bar placeholder */}
      <div className="glass sticky top-0 z-30 border-b border-line">
        <div className="mx-auto flex h-14 max-w-page items-center justify-between px-6">
          <div className="flex items-center gap-8">
            <div className="select-none text-md font-bold tracking-tight">
              <span className="text-brand">poly</span>
              <span className="text-text">nuts</span>
            </div>
            <div className="hidden items-center gap-4 sm:flex">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-4 w-16 animate-pulse rounded bg-bg-subtle" />
              ))}
            </div>
          </div>
          <div className="h-8 w-28 animate-pulse rounded-md bg-bg-subtle" />
        </div>
      </div>

      {/* Content placeholder */}
      <main className="mx-auto max-w-page px-6 py-6">
        <div className="h-8 w-48 animate-pulse rounded bg-bg-subtle" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-44 animate-pulse rounded-lg border border-line bg-bg-elev"
            />
          ))}
        </div>
      </main>
    </div>
  );
}
