// Deterministic per-column widths so the skeleton reads like a real table
// (first column wide, trailing numeric columns narrower) and stays stable
// across renders rather than jittering with random widths.
const COL_WIDTHS = ['80%', '55%', '70%', '45%', '60%', '50%', '65%', '50%'];

export function TableSkeleton({ cols, rows }: { cols: number; rows: number }) {
  return (
    <div
      className="divide-y divide-line"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid items-center gap-3 px-4 py-3 animate-pulse"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-4 rounded bg-bg-subtle"
              style={{ width: COL_WIDTHS[c % COL_WIDTHS.length] }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
