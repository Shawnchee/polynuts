import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C } from '../theme';

/**
 * Persistent backdrop for the waitlist video — drifting hairline grid, two
 * slow-moving color glows (pump green / brand blue), and an edge vignette.
 * It never cuts, so every scene reads as one continuous space and the video
 * loops seamlessly (scenes fade in/out over it).
 */
export const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = (frame * 0.22) % 72;
  const orbX = Math.sin(frame / 110) * 46;
  const orbY = Math.cos(frame / 140) * 34;

  return (
    <AbsoluteFill style={{ backgroundColor: C.appBg }}>
      {/* Soft center lift so the slate bg doesn't read flat */}
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(90% 70% at 50% 42%, #182031 0%, ${C.appBg} 62%)`,
        }}
      />

      {/* Drifting grid */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          backgroundPosition: `${-drift}px ${-drift * 0.5}px`,
        }}
      />

      {/* Color glows */}
      <div
        style={{
          position: 'absolute',
          width: 1100,
          height: 1100,
          left: '58%',
          top: '-32%',
          transform: `translate(${orbX}px, ${orbY}px)`,
          background: 'radial-gradient(closest-side, rgba(34,197,94,0.075), transparent 70%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 1300,
          height: 1300,
          left: '-22%',
          top: '38%',
          transform: `translate(${-orbX}px, ${-orbY}px)`,
          background: 'radial-gradient(closest-side, rgba(96,165,250,0.07), transparent 70%)',
        }}
      />

      {/* Vignette */}
      <AbsoluteFill
        style={{
          backgroundImage:
            'radial-gradient(115% 100% at 50% 50%, transparent 58%, rgba(5,7,12,0.55) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};
