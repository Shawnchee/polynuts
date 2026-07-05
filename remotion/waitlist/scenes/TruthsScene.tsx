import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { C, RADIUS } from '../../theme';
import { FONT } from '../../fonts';

/**
 * Scene 5 — the three product truths (~4s), Q&A rhythm. Each row slides in
 * from the left on a stagger; the price line has receded to a watermark
 * behind. Closes with a "LIVE ON BASE MAINNET" credibility chip.
 */
const ROWS: Array<{
  q: string;
  a: Array<{ t: string; c: string }>;
}> = [
  {
    q: 'MAX LOSS?',
    a: [
      { t: 'Your bet.', c: C.gold },
      { t: ' That’s it.', c: C.text },
    ],
  },
  {
    q: 'SETTLEMENT?',
    a: [
      { t: 'Automatic. ', c: C.text },
      { t: 'On-chain.', c: C.accent },
    ],
  },
  {
    q: 'CUSTODY?',
    a: [{ t: 'Never.', c: C.pump }],
  },
];

export const TruthsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const chipIn = interpolate(frame, [92, 104], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', fontFamily: FONT.body }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 52, minWidth: 760 }}>
        {ROWS.map((row, i) => {
          const s = spring({
            frame: frame - 6 - i * 28,
            fps,
            config: { damping: 200, mass: 0.8 },
          });
          return (
            <div
              key={row.q}
              style={{
                opacity: s,
                transform: `translateX(${interpolate(s, [0, 1], [-56, 0])}px)`,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div
                style={{
                  fontFamily: FONT.mono,
                  fontSize: 22,
                  letterSpacing: 6,
                  color: C.dim,
                }}
              >
                {row.q}
              </div>
              <div
                style={{
                  fontFamily: FONT.display,
                  fontWeight: 700,
                  fontSize: 64,
                  letterSpacing: -1.5,
                  lineHeight: 1,
                }}
              >
                {row.a.map((part) => (
                  <span key={part.t} style={{ color: part.c }}>
                    {part.t}
                  </span>
                ))}
              </div>
            </div>
          );
        })}

        {/* Credibility chip */}
        <div
          style={{
            opacity: chipIn,
            transform: `translateY(${interpolate(chipIn, [0, 1], [10, 0])}px)`,
            alignSelf: 'flex-start',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            border: `1px solid ${C.lineStrong}`,
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderRadius: RADIUS.pill,
            padding: '10px 22px',
            fontFamily: FONT.mono,
            fontSize: 19,
            letterSpacing: 4,
            color: C.muted,
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: C.accent,
              transform: `scale(${1 + 0.25 * Math.sin(frame / 5)})`,
            }}
          />
          LIVE ON BASE MAINNET
        </div>
      </div>
    </AbsoluteFill>
  );
};
