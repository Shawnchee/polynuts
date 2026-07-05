import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  random,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { C, RADIUS } from '../../theme';
import { FONT } from '../../fonts';

/**
 * Scene 1 — Hook (~2.3s). A live BTC ticker chip, then the setup line lands
 * word by word: "BTC moves every day." / "Can you call it?" — with the fixed
 * bet windows underneath. The price line is drawing beneath all of it.
 */
const WORDS = ['BTC', 'moves', 'every', 'day.'];

export const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Deterministic ticking price — re-rolls every 5 frames
  const price = 118400 + Math.round((random(`wl-tick-${Math.floor(frame / 5)}`) - 0.5) * 160);

  const chipIn = spring({ frame: frame - 2, fps, config: { damping: 200 } });
  const line2In = spring({ frame: frame - 30, fps, config: { damping: 16, stiffness: 130, mass: 0.9 } });
  const windowsIn = interpolate(frame, [46, 58], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 230,
        fontFamily: FONT.body,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
        {/* Live ticker chip */}
        <div
          style={{
            opacity: chipIn,
            transform: `translateY(${interpolate(chipIn, [0, 1], [-16, 0])}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            border: `1px solid ${C.lineStrong}`,
            backgroundColor: 'rgba(255,255,255,0.03)',
            borderRadius: RADIUS.pill,
            padding: '12px 26px',
            fontFamily: FONT.mono,
            fontSize: 23,
            letterSpacing: 2,
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
          <span style={{ color: C.muted }}>BTC / USD</span>
          <span style={{ color: C.dim }}>·</span>
          <span style={{ color: C.text, fontWeight: 600 }}>${price.toLocaleString('en-US')}</span>
        </div>

        {/* Headline — word-by-word slam */}
        <div style={{ textAlign: 'center', lineHeight: 1.02 }}>
          <div
            style={{
              fontFamily: FONT.display,
              fontWeight: 800,
              fontSize: 108,
              letterSpacing: -3,
              color: C.text,
              display: 'flex',
              gap: 26,
              justifyContent: 'center',
            }}
          >
            {WORDS.map((w, i) => {
              const s = spring({
                frame: frame - 8 - i * 4,
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
          <div
            style={{
              marginTop: 14,
              fontFamily: FONT.display,
              fontWeight: 800,
              fontSize: 108,
              letterSpacing: -3,
              color: C.accent,
              opacity: Math.min(1, line2In * 1.4),
              transform: `translateY(${interpolate(line2In, [0, 1], [42, 0])}px)`,
            }}
          >
            Can you call it?
          </div>
        </div>

        {/* Fixed bet windows */}
        <div
          style={{
            opacity: windowsIn,
            transform: `translateY(${interpolate(windowsIn, [0, 1], [10, 0])}px)`,
            fontFamily: FONT.mono,
            fontSize: 21,
            letterSpacing: 7,
            color: C.dim,
          }}
        >
          TODAY · TOMORROW · NEXT WEEK
        </div>
      </div>
    </AbsoluteFill>
  );
};
