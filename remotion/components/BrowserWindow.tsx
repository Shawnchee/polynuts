import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, RADIUS } from '../theme';
import { FONT } from '../fonts';

/**
 * The app's browser-window chrome — a 1:1 mirror of HeroAppPreview:
 * titlebar with 3 traffic-light dots, a centered URL pill, and a pulsing
 * green LIVE dot, all on the dark app bg. Every scene renders INSIDE this so
 * the whole video reads as one continuous screen capture of polynuts.app.
 *
 * `url` lets a scene swap the pill text (e.g. /markets → /trade) without
 * breaking the illusion of navigation.
 */
export const BrowserWindow: React.FC<{
  children: React.ReactNode;
  url?: string;
}> = ({ children, url = 'polynuts.app/markets' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // LIVE dot pulse — sine-driven opacity, no CSS animation (forbidden in Remotion).
  const pulse = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 2 * 1.1));

  return (
    <AbsoluteFill
      style={{
        backgroundColor: C.appBg,
        // A whisper of vertical depth — NOT a glow storm. Two near-black stops.
        backgroundImage: `radial-gradient(120% 90% at 50% -10%, #1a2030 0%, ${C.appBg} 55%)`,
        fontFamily: FONT.body,
        padding: 28,
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          flex: 1,
          borderRadius: RADIUS.window,
          border: `1px solid ${C.lineStrong}`,
          backgroundColor: C.windowBg,
          overflow: 'hidden',
          boxShadow: '0 40px 80px -20px rgba(0,0,0,0.6)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Titlebar — 1:1 with HeroAppPreview's chrome */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            borderBottom: `1px solid ${C.line}`,
            backgroundColor: 'rgba(255,255,255,0.015)',
          }}
        >
          {/* Traffic dots — 10px, rose/amber/green at /40, gap 6 */}
          <div style={{ display: 'flex', gap: 6 }}>
            <Dot color="rgba(251,113,133,0.4)" />
            <Dot color="rgba(251,191,36,0.4)" />
            <Dot color="rgba(74,222,128,0.4)" />
          </div>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            {/* URL pill — rounded-md, border-white/[0.06] bg-white/[0.02],
                px-3 py-1, font-mono text-[10px] text-white/40 */}
            <span
              style={{
                borderRadius: RADIUS.card,
                border: '1px solid rgba(255,255,255,0.06)',
                backgroundColor: 'rgba(255,255,255,0.02)',
                padding: '4px 12px',
                fontFamily: FONT.mono,
                fontSize: 10,
                color: 'rgba(255,255,255,0.4)',
                letterSpacing: 0.2,
              }}
            >
              {url}
            </span>
          </div>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontFamily: FONT.mono,
              fontSize: 10,
              color: 'rgba(255,255,255,0.4)',
            }}
          >
            {/* LIVE dot — 6px green, pulsing */}
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                backgroundColor: C.pump,
                opacity: pulse,
                boxShadow: `0 0 8px rgba(34,197,94,${pulse * 0.6})`,
              }}
            />
            LIVE
          </span>
        </div>

        {/* Body — the app surface */}
        <div
          style={{
            flex: 1,
            backgroundColor: C.appBg,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Dot: React.FC<{ color: string }> = ({ color }) => (
  <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color }} />
);

/** Fade/lift helper reused across scenes for staggered reveals. */
export function reveal(frame: number, start: number, dur = 14) {
  const o = interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const y = interpolate(frame, [start, start + dur], [10, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return { opacity: o, transform: `translateY(${y}px)` };
}
