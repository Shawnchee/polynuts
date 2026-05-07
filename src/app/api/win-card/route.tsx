import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const result = (params.get('result') ?? 'win').toLowerCase(); // win | loss
  const won = result === 'win';
  const bet = clampNumber(params.get('bet'), 0, 9_999_999) ?? 100;
  const payout = clampNumber(params.get('payout'), 0, 99_999_999) ?? Math.round(bet * 1.61);
  const direction = (params.get('direction') ?? 'PUMP').toUpperCase(); // PUMP | DUMP | RANGE
  const headline =
    params.get('q') ??
    (direction === 'DUMP'
      ? 'ETH dumped'
      : direction === 'RANGE'
      ? 'ETH stayed in range'
      : 'ETH pumped');
  const multiplier = bet > 0 ? (payout / bet).toFixed(2) : '—';

  const accent = won ? '#16A34A' : '#DC2626';
  const accentBg = won ? '#F0FDF4' : '#FEF2F2';
  const dirAccent =
    direction === 'PUMP' ? '#16A34A' : direction === 'DUMP' ? '#DC2626' : '#7C3AED';

  return new ImageResponse(
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
              {won ? 'WIN' : 'LOSS'}
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
            {won ? '+' : '−'}${formatNumber(payout)}
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
              <span style={{ color: '#A1A1AA' }}>Won</span>
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
