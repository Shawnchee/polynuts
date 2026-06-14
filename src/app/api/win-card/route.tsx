import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

// Node.js runtime, not edge: next/og's ImageResponse bundles satori + resvg
// WASM (~1 MB), which trips Vercel's 1 MB edge-function size limit on the free
// plan. Node serverless functions have a far larger limit and ImageResponse
// runs there too, so this renders identically without the size ceiling.
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  // result:
  //   win     → settled winning position; green WIN badge + "+$X" headline
  //   loss    → settled losing position; red LOSS badge
  //   pending → open bet just placed; direction-tinted "BETTING" badge,
  //             headline reads as a potential payout ("If correct: +$X")
  const result = (params.get('result') ?? 'win').toLowerCase();
  const isPending = result === 'pending';
  const won = result === 'win';
  const bet = clampNumber(params.get('bet'), 0, 9_999_999) ?? 100;
  const payout = clampNumber(params.get('payout'), 0, 99_999_999) ?? Math.round(bet * 1.61);
  // Whitelist direction to the three known values so a malformed param can't
  // leak arbitrary text into the accent-colour switch below.
  const dirRaw = (params.get('direction') ?? 'PUMP').toUpperCase();
  const direction = dirRaw === 'DUMP' || dirRaw === 'RANGE' ? dirRaw : 'PUMP';
  // `q` is fully user-controlled and rendered into a public, uncached
  // image — cap its length so it can't be abused to render huge text payloads.
  const rawHeadline = params.get('q');
  const headline = rawHeadline
    ? rawHeadline.slice(0, 80)
    : direction === 'DUMP'
    ? 'ETH dumped'
    : direction === 'RANGE'
    ? 'ETH stayed in range'
    : 'ETH pumped';
  const multiplier = bet > 0 ? (payout / bet).toFixed(2) : '—';

  const dirAccent =
    direction === 'PUMP' ? '#16A34A' : direction === 'DUMP' ? '#DC2626' : '#7C3AED';
  const dirAccentBg =
    direction === 'PUMP' ? '#F0FDF4' : direction === 'DUMP' ? '#FEF2F2' : '#F5F3FF';
  // Pending shares track the direction colour; settled shares use win/loss
  // colours so the user instantly reads outcome.
  const accent = isPending ? dirAccent : won ? '#16A34A' : '#DC2626';
  const accentBg = isPending ? dirAccentBg : won ? '#F0FDF4' : '#FEF2F2';
  const badgeLabel = isPending ? 'BETTING' : won ? 'WIN' : 'LOSS';
  const amountSign = isPending ? '+' : won ? '+' : '−';
  const amountLabel = isPending ? 'Win up to' : won ? 'Won' : 'Lost';

  const image = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          padding: '60px',
          background: 'linear-gradient(135deg, #FAFAFA 0%, #F4F4F5 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Wordmark */}
        <div style={{ display: 'flex', fontSize: 36, fontWeight: 700, letterSpacing: '-1px' }}>
          <span style={{ color: '#2563EB' }}>poly</span>
          <span style={{ color: '#09090B' }}>nuts</span>
        </div>

        {/* Card */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            marginTop: 48,
            padding: '48px',
            borderRadius: 24,
            background: '#FFFFFF',
            border: `2px solid ${accent}`,
            flex: 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              color: dirAccent,
            }}
          >
            <span
              style={{
                padding: '4px 14px',
                borderRadius: 8,
                background: accentBg,
                color: accent,
              }}
            >
              {badgeLabel}
            </span>
            <span>{direction}</span>
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: 96,
              fontWeight: 800,
              color: accent,
              marginTop: 24,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-3px',
            }}
          >
            {amountSign}${formatNumber(payout)}
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: 38,
              fontWeight: 600,
              color: '#09090B',
              marginTop: 8,
            }}
          >
            {headline}
          </div>

          <div
            style={{
              display: 'flex',
              gap: 32,
              fontSize: 24,
              fontWeight: 500,
              color: '#52525B',
              marginTop: 'auto',
            }}
          >
            <span style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: '#A1A1AA' }}>Bet</span>
              <span
                style={{
                  color: '#09090B',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ${formatNumber(bet)}
              </span>
            </span>
            <span style={{ color: '#A1A1AA' }}>→</span>
            <span style={{ display: 'flex', gap: 8 }}>
              <span style={{ color: '#A1A1AA' }}>{amountLabel}</span>
              <span
                style={{
                  color: accent,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ${formatNumber(payout)}
              </span>
            </span>
            <span
              style={{
                color: '#09090B',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              ({multiplier}x)
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            marginTop: 32,
            fontSize: 18,
            color: '#52525B',
            justifyContent: 'space-between',
          }}
        >
          <span>polynuts.xyz</span>
          <span style={{ color: '#A1A1AA' }}>powered by Thetanuts V4</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );

  // Output is deterministic per query string, so cache hard at the CDN —
  // without this the public route re-renders an image on every hit, the
  // abuse/cost vector for an unauthenticated OG endpoint. next/og injects its
  // own `Cache-Control: …max-age=31536000` default; passing headers to the
  // constructor APPENDS to it, yielding a malformed header with two max-age
  // values. Headers.set() replaces all values, guaranteeing a single policy.
  image.headers.set(
    'Cache-Control',
    'public, immutable, no-transform, max-age=86400, s-maxage=604800'
  );
  return image;
}

function clampNumber(input: string | null, min: number, max: number): number | null {
  if (input == null) return null;
  const n = Number(input);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function formatNumber(n: number): string {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
