import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from '../theme';
import { FONT } from '../fonts';

/**
 * Scene 5 — End card (~1.5s).
 *
 * Quiet brand close on the app bg (no window chrome): the polynuts wordmark
 * (`poly` accent + `nuts` white), the tagline "Trade the moment. On-chain.",
 * and a restrained CTA "polynuts.app". Lots of negative space — the opposite
 * of motion-graphics clutter.
 */
export const EndScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const markIn = spring({ frame: frame - 2, fps, config: { damping: 200, mass: 0.8 } });
  const tagOpacity = interpolate(frame, [14, 26], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const tagY = interpolate(frame, [14, 26], [8, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const ctaOpacity = interpolate(frame, [24, 36], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.appBg,
        backgroundImage: `radial-gradient(100% 80% at 50% 40%, #181f2e 0%, ${C.appBg} 60%)`,
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT.body,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 22,
          transform: `translateY(${interpolate(markIn, [0, 1], [12, 0])}px)`,
        }}
      >
        {/* Wordmark */}
        <div
          style={{
            opacity: markIn,
            fontFamily: FONT.display,
            fontWeight: 800,
            fontSize: 72,
            letterSpacing: -1.5,
            lineHeight: 1,
          }}
        >
          <span style={{ color: C.accent }}>poly</span>
          <span style={{ color: C.text }}>nuts</span>
        </div>

        {/* Tagline */}
        <p
          style={{
            margin: 0,
            opacity: tagOpacity,
            transform: `translateY(${tagY}px)`,
            fontSize: 19,
            color: C.muted,
            letterSpacing: 0.2,
          }}
        >
          Trade the moment. On-chain.
        </p>

        {/* CTA */}
        <div
          style={{
            opacity: ctaOpacity,
            marginTop: 8,
            fontFamily: FONT.mono,
            fontSize: 13,
            color: C.dim,
            border: `1px solid ${C.lineStrong}`,
            borderRadius: 999,
            padding: '8px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: C.pump }} />
          polynuts.app
        </div>
      </div>
    </AbsoluteFill>
  );
};
