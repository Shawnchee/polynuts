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
 * PolynutsLaunchTeaser — 1080x1080 @ 30fps, 150 frames (5s). A short,
 * feed-native square teaser for X announcing the launch date is close.
 * Independent of `WaitlistVideo` — shares only the brand tokens and the
 * looping `Background` backdrop, no scenes are reused.
 *
 * Beat sheet (all on one continuous timeline, no Sequence cuts):
 *   1. Countdown kicker chip pops in near the top (bump DAYS_LEFT if this
 *      renders on a different day than it posts — see below)
 *   2. `polynuts` wordmark springs in
 *   3. "LAUNCHING" eases in, then "THIS FRIDAY" slams in word by word
 *   4. Waitlist CTA pill settles in at the bottom
 *
 * The whole foreground group fades in over frames 0–10 and back out over
 * 137–149 (dur=150), so frame 0 and frame 149 both show the bare, already-
 * looping Background — the render loops seamlessly when posted as a clip.
 */
const DUR = 150;
// Days until the Friday launch as of the render date — the headline
// ("LAUNCHING THIS FRIDAY") stays accurate all week, only this needs a bump.
const DAYS_LEFT = 2;
const PUNCH_WORDS = ['THIS', 'FRIDAY'];

export const LaunchTeaser: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Group fade for a seamless loop point over the persistent Background.
  // Right edge is DUR - 1 (the last rendered 0-indexed frame) so the fade
  // reaches a true 0 on frame 149 — no residual text at the loop seam.
  const groupOpacity = interpolate(frame, [0, 10, DUR - 13, DUR - 1], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const kickerIn = spring({ frame: frame - 2, fps, config: { damping: 200 } });
  const markIn = spring({ frame: frame - 14, fps, config: { damping: 200, mass: 0.8 } });
  const line1In = interpolate(frame, [26, 38], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ctaIn = spring({ frame: frame - 70, fps, config: { damping: 14, stiffness: 120, mass: 0.9 } });

  return (
    <AbsoluteFill style={{ backgroundColor: C.appBg }}>
      <Background />

      <AbsoluteFill
        style={{
          opacity: groupOpacity,
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '110px 0 100px',
          fontFamily: FONT.body,
        }}
      >
        {/* Kicker chip */}
        <div
          style={{
            opacity: kickerIn,
            transform: `translateY(${interpolate(kickerIn, [0, 1], [-14, 0])}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            border: `1px solid ${C.lineStrong}`,
            backgroundColor: 'rgba(255,255,255,0.03)',
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
              transform: `scale(${1 + 0.3 * Math.sin(frame / 5)})`,
            }}
          />
          <span style={{ color: C.text, fontWeight: 600 }}>
            {DAYS_LEFT} DAY{DAYS_LEFT === 1 ? '' : 'S'} LEFT
          </span>
        </div>

        {/* Wordmark + headline */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 46 }}>
          {/* Halo behind the lockup */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 900,
              height: 900,
              borderRadius: '50%',
              background: 'radial-gradient(closest-side, rgba(96,165,250,0.10), transparent 70%)',
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
              fontSize: 124,
              letterSpacing: -3,
              lineHeight: 1,
            }}
          >
            <span style={{ color: C.accent }}>poly</span>
            <span style={{ color: C.text }}>nuts</span>
          </div>

          {/* Headline */}
          <div style={{ textAlign: 'center', lineHeight: 1.04 }}>
            <div
              style={{
                opacity: line1In,
                transform: `translateY(${interpolate(line1In, [0, 1], [10, 0])}px)`,
                fontFamily: FONT.display,
                fontWeight: 700,
                fontSize: 56,
                letterSpacing: -1.5,
                color: C.muted,
              }}
            >
              LAUNCHING
            </div>
            <div
              style={{
                marginTop: 14,
                fontFamily: FONT.display,
                fontWeight: 800,
                fontSize: 108,
                letterSpacing: -3,
                color: C.accent,
                display: 'flex',
                gap: 26,
                justifyContent: 'center',
                textShadow: '0 0 90px rgba(96,165,250,0.45)',
              }}
            >
              {PUNCH_WORDS.map((w, i) => {
                const s = spring({
                  frame: frame - 46 - i * 4,
                  fps,
                  config: { damping: 15, stiffness: 140, mass: 0.9 },
                });
                return (
                  <span
                    key={w}
                    style={{
                      display: 'inline-block',
                      opacity: Math.min(1, s * 1.4),
                      transform: `translateY(${interpolate(s, [0, 1], [42, 0])}px)`,
                    }}
                  >
                    {w}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Waitlist CTA */}
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
            boxShadow: '0 0 70px rgba(96,165,250,0.16)',
            borderRadius: RADIUS.pill,
            padding: '16px 34px',
            fontFamily: FONT.mono,
            fontSize: 23,
            letterSpacing: 2,
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: C.pump,
              transform: `scale(${1 + 0.28 * Math.sin(frame / 5)})`,
            }}
          />
          <span style={{ color: C.text, fontWeight: 600 }}>Join the waitlist</span>
          <span style={{ color: C.dim }}>·</span>
          <span style={{ color: C.muted }}>polynuts.xyz</span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
