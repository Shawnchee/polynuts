import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Background } from './Background';
import { C, RADIUS } from '../theme';
import { FONT } from '../fonts';

/**
 * PolynutsLive — 1080x1080 @ 30fps, 180 frames (6s). Launch-day hype square
 * for X: the waitlist is over, the app is LIVE. Sibling of LaunchTeaser —
 * shares the brand tokens, fonts, and the looping `Background`, but swaps the
 * countdown beat for a "we're live" slam.
 *
 * Beat sheet (one continuous timeline, no Sequence cuts):
 *   1. Pulsing "LIVE ON BASE MAINNET" badge pops in up top
 *   2. `polynuts` wordmark springs in behind a halo
 *   3. "WE'RE LIVE" slams in word-by-word; a bright bloom flashes as LIVE lands
 *   4. "Bet PUMP or DUMP on ETH & BTC" fades in (PUMP green / DUMP rose)
 *   5. "Trade now · polynuts.xyz" CTA pill settles at the bottom
 *
 * The foreground group fades in over 0–10 and out over 167–179, so frame 0 and
 * frame 179 both show the bare looping Background — seamless when posted as a clip.
 */
const DUR = 180;
const PUNCH_WORDS = ["WE'RE", 'LIVE'];

export const LiveTeaser: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Group fade for a seamless loop point over the persistent Background.
  const groupOpacity = interpolate(frame, [0, 10, DUR - 13, DUR - 1], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const kickerIn = spring({ frame: frame - 2, fps, config: { damping: 200 } });
  const markIn = spring({ frame: frame - 14, fps, config: { damping: 200, mass: 0.8 } });
  const subIn = interpolate(frame, [72, 88], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ctaIn = spring({ frame: frame - 92, fps, config: { damping: 14, stiffness: 120, mass: 0.9 } });

  // Bright bloom that flashes the instant "LIVE" lands (~frame 50), then fades.
  const bloom = interpolate(frame, [46, 51, 66], [0, 0.55, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: C.appBg }}>
      <Background />

      {/* Launch-moment bloom — a soft accent flash centered on the headline. */}
      <AbsoluteFill
        style={{
          opacity: bloom,
          background:
            'radial-gradient(closest-side, rgba(96,165,250,0.9), rgba(96,165,250,0.25) 45%, transparent 72%)',
          transform: 'translateY(-40px)',
        }}
      />

      <AbsoluteFill
        style={{
          opacity: groupOpacity,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '104px 0 96px',
          fontFamily: FONT.body,
        }}
      >
        {/* LIVE badge */}
        <div
          style={{
            opacity: kickerIn,
            transform: `translateY(${interpolate(kickerIn, [0, 1], [-14, 0])}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            border: `1px solid ${C.pumpBorder}`,
            backgroundColor: C.pumpFill,
            borderRadius: RADIUS.pill,
            padding: '11px 24px',
            fontFamily: FONT.mono,
            fontSize: 20,
            letterSpacing: 3,
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              backgroundColor: C.pump,
              boxShadow: `0 0 ${8 + 6 * Math.abs(Math.sin(frame / 5))}px ${C.pump}`,
              transform: `scale(${1 + 0.35 * Math.sin(frame / 5)})`,
            }}
          />
          <span style={{ color: C.text, fontWeight: 600 }}>LIVE ON BASE MAINNET</span>
        </div>

        {/* Wordmark + headline */}
        <div
          style={{
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 40,
          }}
        >
          {/* Halo behind the lockup */}
          <div
            style={{
              position: 'absolute',
              top: '48%',
              left: '50%',
              width: 940,
              height: 940,
              borderRadius: '50%',
              background: 'radial-gradient(closest-side, rgba(96,165,250,0.12), transparent 70%)',
              transform: `translate(-50%, -50%) scale(${0.9 + markIn * 0.1})`,
            }}
          />

          {/* Wordmark */}
          <div
            style={{
              opacity: markIn,
              transform: `translateY(${interpolate(markIn, [0, 1], [18, 0])}px)`,
              fontFamily: FONT.display,
              fontWeight: 800,
              fontSize: 104,
              letterSpacing: -3,
              lineHeight: 1,
            }}
          >
            <span style={{ color: C.accent }}>poly</span>
            <span style={{ color: C.text }}>nuts</span>
          </div>

          {/* "WE'RE LIVE" — word-by-word slam, LIVE carries the glow */}
          <div
            style={{
              display: 'flex',
              gap: 30,
              justifyContent: 'center',
              fontFamily: FONT.display,
              fontWeight: 800,
              fontSize: 130,
              letterSpacing: -4,
              lineHeight: 1,
            }}
          >
            {PUNCH_WORDS.map((w, i) => {
              const s = spring({
                frame: frame - 42 - i * 5,
                fps,
                config: { damping: 13, stiffness: 150, mass: 0.9 },
              });
              const isLive = w === 'LIVE';
              return (
                <span
                  key={w}
                  style={{
                    display: 'inline-block',
                    opacity: Math.min(1, s * 1.4),
                    transform: `translateY(${interpolate(s, [0, 1], [48, 0])}px) scale(${interpolate(
                      s,
                      [0, 1],
                      [0.86, 1]
                    )})`,
                    color: isLive ? C.accent : C.text,
                    textShadow: isLive ? '0 0 100px rgba(96,165,250,0.55)' : 'none',
                  }}
                >
                  {w}
                </span>
              );
            })}
          </div>
        </div>

        {/* Subline + CTA */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 34 }}>
          {/* Product line — PUMP green, DUMP rose */}
          <div
            style={{
              opacity: subIn,
              transform: `translateY(${interpolate(subIn, [0, 1], [12, 0])}px)`,
              fontFamily: FONT.display,
              fontWeight: 600,
              fontSize: 40,
              letterSpacing: -0.5,
              color: C.muted,
            }}
          >
            Bet <span style={{ color: C.pump, fontWeight: 800 }}>PUMP</span> or{' '}
            <span style={{ color: C.dump, fontWeight: 800 }}>DUMP</span> on ETH &amp; BTC
          </div>

          {/* CTA */}
          <div
            style={{
              opacity: Math.min(1, ctaIn * 1.3),
              transform: `translateY(${interpolate(ctaIn, [0, 1], [24, 0])}px) scale(${interpolate(
                ctaIn,
                [0, 1],
                [0.94, 1]
              )})`,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              border: `1px solid ${C.lineStrong}`,
              backgroundColor: 'rgba(255,255,255,0.04)',
              boxShadow: '0 0 70px rgba(96,165,250,0.18)',
              borderRadius: RADIUS.pill,
              padding: '16px 34px',
              fontFamily: FONT.mono,
              fontSize: 23,
              letterSpacing: 2,
            }}
          >
            <span style={{ color: C.text, fontWeight: 600 }}>Trade now</span>
            <span style={{ color: C.dim }}>·</span>
            <span style={{ color: C.accent }}>polynuts.xyz</span>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
