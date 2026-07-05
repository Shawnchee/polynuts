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
 * Scene 7 — end card (~3s). Wordmark, the waitlist page's own headline as
 * tagline ("Bet the moment. Get in early."), and the waitlist CTA pill.
 * The parent Fade handles the loop fade-out over the persistent background.
 */
export const EndCardScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const markIn = spring({ frame: frame - 4, fps, config: { damping: 200, mass: 0.8 } });
  const tagIn = interpolate(frame, [20, 32], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ctaIn = spring({ frame: frame - 34, fps, config: { damping: 14, stiffness: 120, mass: 0.9 } });

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT.body,
      }}
    >
      {/* Halo behind the lockup */}
      <div
        style={{
          position: 'absolute',
          width: 980,
          height: 980,
          borderRadius: '50%',
          background: 'radial-gradient(closest-side, rgba(96,165,250,0.10), transparent 70%)',
          transform: `scale(${0.9 + markIn * 0.1})`,
        }}
      />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 }}>
        {/* Wordmark */}
        <div
          style={{
            opacity: markIn,
            transform: `translateY(${interpolate(markIn, [0, 1], [18, 0])}px)`,
            fontFamily: FONT.display,
            fontWeight: 800,
            fontSize: 128,
            letterSpacing: -3,
            lineHeight: 1,
          }}
        >
          <span style={{ color: C.accent }}>poly</span>
          <span style={{ color: C.text }}>nuts</span>
        </div>

        {/* Tagline — mirrors the waitlist page h1 */}
        <div
          style={{
            opacity: tagIn,
            transform: `translateY(${interpolate(tagIn, [0, 1], [10, 0])}px)`,
            fontFamily: FONT.display,
            fontWeight: 700,
            fontSize: 38,
            letterSpacing: -0.5,
          }}
        >
          <span style={{ color: C.text }}>Bet the moment. </span>
          <span style={{ color: C.accent }}>Get in early.</span>
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
            marginTop: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            border: `1px solid ${C.lineStrong}`,
            backgroundColor: 'rgba(255,255,255,0.04)',
            boxShadow: '0 0 70px rgba(96,165,250,0.16)',
            borderRadius: RADIUS.pill,
            padding: '18px 38px',
            fontFamily: FONT.mono,
            fontSize: 25,
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
      </div>
    </AbsoluteFill>
  );
};
