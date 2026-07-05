import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { C } from '../../theme';
import { FONT } from '../../fonts';

/**
 * Scenes 2–4 — the three calls. One giant word slams in per scene while the
 * price line acts it out underneath:
 *   PUMP  enters from below (up-move), exits upward
 *   DUMP  enters from above (down-move), exits downward
 *   RANGE compresses into place between two violet clamp bars
 * A radial burst flashes in the word's color on impact; a mono caption states
 * the settlement rule ("closes above the strike", etc.).
 */
export type CallMode = 'up' | 'down' | 'clamp';

type Props = {
  word: string;
  color: string;
  glow: string;
  caption: string;
  mode: CallMode;
  dur: number;
};

export const CallScene: React.FC<Props> = ({ word, color, glow, caption, mode, dur }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slam = spring({
    frame: frame - 4,
    fps,
    config: { damping: 13, stiffness: 115, mass: 0.9 },
  });

  const enterY = mode === 'up' ? 170 : mode === 'down' ? -170 : 0;
  const enterScale = mode === 'clamp' ? 1.35 : 0.9;

  // Exit continues the word's direction of travel
  const out = interpolate(frame, [dur - 10, dur - 2], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const exitY = mode === 'up' ? -80 * out : mode === 'down' ? 80 * out : 0;

  const y = interpolate(slam, [0, 1], [enterY, 0]) + exitY;
  const scale = interpolate(slam, [0, 1], [enterScale, 1]) * (mode === 'clamp' ? 1 - out * 0.06 : 1);
  const opacity = Math.min(1, slam * 1.5) * (1 - out);

  // Impact burst
  const burstScale = interpolate(frame, [4, 22], [0.35, 2.1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const burstOpacity = interpolate(frame, [4, 9, 24], [0, 0.55, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const captionIn = interpolate(frame, [16, 28], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Clamp bars (RANGE only)
  const barScale = interpolate(slam, [0, 1], [0.25, 1]);
  const barGap = interpolate(slam, [0, 1], [190, 128]);

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', paddingBottom: 190 }}>
      {/* Burst */}
      <div
        style={{
          position: 'absolute',
          width: 640,
          height: 640,
          borderRadius: '50%',
          background: `radial-gradient(closest-side, ${glow}, transparent 72%)`,
          transform: `scale(${burstScale})`,
          opacity: burstOpacity,
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 34,
          opacity,
          transform: `translateY(${y}px) scale(${scale})`,
        }}
      >
        {mode === 'clamp' && (
          <div
            style={{
              width: 620,
              height: 7,
              borderRadius: 4,
              backgroundColor: color,
              transform: `scaleX(${barScale}) translateY(${-barGap + 128}px)`,
              boxShadow: `0 0 34px ${glow}`,
            }}
          />
        )}

        <div
          style={{
            fontFamily: FONT.display,
            fontWeight: 800,
            fontSize: 236,
            letterSpacing: -4,
            lineHeight: 0.95,
            color,
            textShadow: `0 0 100px ${glow}`,
          }}
        >
          {word}
        </div>

        {mode === 'clamp' && (
          <div
            style={{
              width: 620,
              height: 7,
              borderRadius: 4,
              backgroundColor: color,
              transform: `scaleX(${barScale}) translateY(${barGap - 128}px)`,
              boxShadow: `0 0 34px ${glow}`,
            }}
          />
        )}

        <div
          style={{
            opacity: captionIn,
            transform: `translateY(${interpolate(captionIn, [0, 1], [12, 0])}px)`,
            fontFamily: FONT.mono,
            fontSize: 25,
            letterSpacing: 6,
            color: C.muted,
          }}
        >
          {caption}
        </div>
      </div>
    </AbsoluteFill>
  );
};
