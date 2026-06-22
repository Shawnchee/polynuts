import type { CSSProperties } from 'react';

/**
 * Hand-drawn pixel-art icon set for the landing sections — inline SVG, no
 * external assets (zero licensing/attribution burden) and matched to the
 * trading-terminal aesthetic. Each glyph is a 9×9 grid authored as an ASCII
 * map ('#' = filled cell); cells render as 1×1 rects with crisp edges so they
 * stay sharp at any size. Colour via `currentColor` (set `color` / text class).
 */
const GLYPHS: Record<string, string[]> = {
  // order book / market — a framed window with list rows
  market: [
    '#########',
    '#.......#',
    '#.#####.#',
    '#.......#',
    '#.#####.#',
    '#.......#',
    '#.#####.#',
    '#.......#',
    '#########',
  ],
  // direction — stacked up / down arrows (PUMP · DUMP)
  direction: [
    '....#....',
    '...###...',
    '..#####..',
    '.#######.',
    '.........',
    '.#######.',
    '..#####..',
    '...###...',
    '....#....',
  ],
  // settle / win — a trophy
  settle: [
    '#.#####.#',
    '#.#####.#',
    '.#######.',
    '.#######.',
    '..#####..',
    '...###...',
    '...###...',
    '.........',
    '.#######.',
  ],
  // custody — a padlock
  lock: [
    '..#####..',
    '.#.....#.',
    '.#.....#.',
    '#########',
    '#.#####.#',
    '#.##.##.#',
    '#.#####.#',
    '#.#####.#',
    '#########',
  ],
  // speed — a lightning bolt
  bolt: [
    '.....###.',
    '....###..',
    '...###...',
    '..######.',
    '.######..',
    '...###...',
    '..###....',
    '.###.....',
    '.........',
  ],
  // pricing / odds — an ascending bar chart
  odds: [
    '.........',
    '.......##',
    '.......##',
    '....##.##',
    '....##.##',
    '.##.##.##',
    '.##.##.##',
    '.##.##.##',
    '#########',
  ],
  // infrastructure — stacked layers
  layers: [
    '....#....',
    '..#####..',
    '#########',
    '..#####..',
    '....#....',
    '..#####..',
    '#########',
    '..#####..',
    '....#....',
  ],
};

export function PixelIcon({
  name,
  className,
  style,
}: {
  name: keyof typeof GLYPHS | string;
  className?: string;
  style?: CSSProperties;
}) {
  const grid = GLYPHS[name] ?? GLYPHS.market;
  const cols = grid[0].length;
  const rows = grid.length;
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === '#') cells.push({ x, y });
    }
  }
  return (
    <svg
      viewBox={`0 0 ${cols} ${rows}`}
      className={className}
      style={style}
      fill="currentColor"
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      {cells.map((c) => (
        <rect key={`${c.x}-${c.y}`} x={c.x} y={c.y} width={1} height={1} />
      ))}
    </svg>
  );
}
