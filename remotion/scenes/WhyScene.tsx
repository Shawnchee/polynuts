import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, RADIUS } from '../theme';
import { FONT } from '../fonts';

/**
 * Scene 5 — Why Polynuts (~6s, no window chrome).
 *
 * Mirrors the landing page's "Why Polynuts / Real options under the hood"
 * section: a mono kicker + display heading, then the same four feature cells
 * (Custody / Speed / Pricing / Infrastructure) in a 2×2 grid that staggers in.
 * Copy is trimmed to one line per card so it stays legible at video pace; the
 * wording, kickers, and order match `FEATURES` in src/app/page.tsx.
 */

// Clean line icons in the accent color — echo the landing's PixelIcon set
// (lock / bolt / odds / layers) without the pixel-art rendering.
const Icon: React.FC<{ name: string }> = ({ name }) => {
  const p = {
    stroke: C.accent,
    strokeWidth: 2,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" style={{ display: 'block' }}>
      {name === 'lock' && (
        <>
          <rect x="5" y="11" width="14" height="9" rx="2" {...p} />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" {...p} />
        </>
      )}
      {name === 'bolt' && <path d="M13 2L4 14h6l-1 8 9-12h-6z" {...p} />}
      {name === 'odds' && (
        <>
          <path d="M4 20V4M4 20h16" {...p} />
          <rect x="7" y="12" width="3" height="5" {...p} />
          <rect x="12" y="8" width="3" height="9" {...p} />
          <rect x="17" y="5" width="3" height="12" {...p} />
        </>
      )}
      {name === 'layers' && (
        <>
          <path d="M12 3l9 5-9 5-9-5 9-5z" {...p} />
          <path d="M3 13l9 5 9-5" {...p} />
        </>
      )}
    </svg>
  );
};

const FEATURES = [
  { icon: 'lock', kicker: 'Custody', title: 'Non-custodial', body: 'Your USDC, your keys. No custody, no KYC.' },
  { icon: 'bolt', kicker: 'Speed', title: 'Sub-second fills', body: 'Bets execute on Base in ~2 seconds.' },
  { icon: 'odds', kicker: 'Pricing', title: 'Real-time odds', body: 'Implied probability on-chain via simulatePayout.' },
  {
    icon: 'layers',
    kicker: 'Infrastructure',
    title: 'Powered by Thetanuts V4',
    body: 'Audited structured-product vaults, live since 2021.',
  },
];

export const WhyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const head = spring({ frame, fps, config: { damping: 200, mass: 0.7 } });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.appBg,
        backgroundImage: `radial-gradient(120% 90% at 50% 30%, #181f2e 0%, ${C.appBg} 62%)`,
        fontFamily: FONT.body,
        padding: '56px 72px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {/* Header — kicker + display heading (matches the landing section) */}
      <div
        style={{
          opacity: head,
          transform: `translateY(${interpolate(head, [0, 1], [10, 0])}px)`,
          marginBottom: 26,
        }}
      >
        <div
          style={{
            fontFamily: FONT.mono,
            fontSize: 12,
            letterSpacing: 3,
            textTransform: 'uppercase',
            color: C.dim,
            marginBottom: 12,
          }}
        >
          Why Polynuts
        </div>
        <div
          style={{
            fontFamily: FONT.display,
            fontWeight: 800,
            fontSize: 40,
            lineHeight: 1.04,
            letterSpacing: -0.5,
            color: C.text,
          }}
        >
          Real options under the hood
        </div>
      </div>

      {/* 2×2 feature grid — staggered reveal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {FEATURES.map((f, i) => {
          const start = 14 + i * 8;
          const o = interpolate(frame, [start, start + 12], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          const yy = interpolate(frame, [start, start + 12], [14, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          });
          return (
            <div
              key={f.title}
              style={{
                opacity: o,
                transform: `translateY(${yy}px)`,
                border: `1px solid ${C.lineToken}`,
                backgroundColor: C.card,
                borderRadius: RADIUS.window,
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <Icon name={f.icon} />
              <div>
                <div
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 10,
                    letterSpacing: 1.6,
                    textTransform: 'uppercase',
                    color: C.dim,
                    marginBottom: 6,
                  }}
                >
                  {f.kicker}
                </div>
                <div
                  style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 18, color: C.text, marginBottom: 6 }}
                >
                  {f.title}
                </div>
                <div style={{ fontSize: 13.5, lineHeight: '19px', color: C.muted }}>{f.body}</div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
