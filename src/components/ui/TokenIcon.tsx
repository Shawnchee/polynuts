import { cn } from '@/lib/utils';

// Assets we have a real brand logo for in /public/tokens (fetched from the
// cryptocurrency-icons set). Anything else falls back to a lettered circle.
const KNOWN_TOKENS = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'AVAX']);

/**
 * Round token logo for a market's underlying asset. Renders the local brand
 * SVG when we have one; otherwise a neutral lettered circle so an unknown
 * feed symbol still shows something sensible (never a broken image).
 */
export function TokenIcon({
  asset,
  size = 24,
  className,
}: {
  asset: string;
  size?: number;
  className?: string;
}) {
  const sym = (asset || '').toUpperCase();
  const dimensions = { width: size, height: size };

  if (KNOWN_TOKENS.has(sym)) {
    return (
      // Local, pre-vetted SVGs — next/image optimization adds no value for a
      // tiny static icon and would need dangerouslyAllowSVG, so a plain img is
      // intentional here.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/tokens/${sym.toLowerCase()}.svg`}
        alt={`${sym} logo`}
        style={dimensions}
        className={cn('shrink-0 rounded-full', className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      style={{ ...dimensions, fontSize: Math.round(size * 0.5) }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-bg-subtle font-bold text-text',
        className
      )}
    >
      {sym.slice(0, 1) || '?'}
    </span>
  );
}
