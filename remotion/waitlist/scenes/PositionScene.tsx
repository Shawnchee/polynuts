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
 * Scene 6 — positioning (~2.3s). The one-line pitch from the waitlist page,
 * split into two beats: "Like Polymarket." / "But for options." with an
 * accent underline sweep on the second line.
 */
export const PositionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const l1 = spring({ frame: frame - 4, fps, config: { damping: 16, stiffness: 130, mass: 0.9 } });
  const l2 = spring({ frame: frame - 18, fps, config: { damping: 16, stiffness: 130, mass: 0.9 } });
  const sweep = interpolate(frame, [30, 46], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          fontFamily: FONT.display,
          fontWeight: 800,
          fontSize: 118,
          letterSpacing: -3.5,
          lineHeight: 1,
        }}
      >
        <div
          style={{
            color: C.text,
            opacity: Math.min(1, l1 * 1.4),
            transform: `translateY(${interpolate(l1, [0, 1], [46, 0])}px)`,
          }}
        >
          Like Polymarket.
        </div>
        <div
          style={{
            color: C.accent,
            opacity: Math.min(1, l2 * 1.4),
            transform: `translateY(${interpolate(l2, [0, 1], [46, 0])}px)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 20,
          }}
        >
          But for options.
          <div
            style={{
              width: 560,
              height: 8,
              borderRadius: 4,
              background: `linear-gradient(90deg, ${C.pump}, ${C.accent}, ${C.range})`,
              transform: `scaleX(${sweep})`,
              opacity: sweep,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
