import React from 'react';
import { interpolate, interpolateColors, random, useCurrentFrame } from 'remotion';
import { C } from '../theme';
import { FONT } from '../fonts';

/**
 * The protagonist of the waitlist video: one continuous market line that draws
 * left→right across the whole piece and *acts out* the product mechanic —
 * it drifts (hook), surges above the strike (PUMP), crashes below it (DUMP),
 * then oscillates inside a violet band (RANGE).
 *
 * The path is a deterministic mean-reverting random walk (remotion `random()`
 * seeds, so every render is identical), built once at module scope. The frame
 * only controls how much of it is revealed, the glow head, and the fades.
 *
 * Timeline (absolute frames, 30fps):
 *   head x:   f4→0 … f70→480 (hook) … f130→960 (pump) … f190→1440 (dump)
 *             … f252→1904 (range)
 *   strike:   fades in f62–82 (dashed, labeled)
 *   band:     clamps in f188–208 (violet rails + fill)
 *   fade:     drops to a faint watermark for the truths scene (f256–282),
 *             gone by the positioning scene (f378–394).
 */
const W = 1920;
const H = 1080;
const STEP = 8;
const N = W / STEP + 1;
const STRIKE_Y = 800;
const BAND_TOP = 745;
const BAND_BOTTOM = 875;
const BAND_X = 1400;

const buildPoints = (): Array<{ x: number; y: number }> => {
  const raw: Array<{ x: number; y: number }> = [];
  let y = 832;
  for (let i = 0; i < N; i++) {
    const x = i * STEP;
    const noise = (random(`wl-noise-${i}`) - 0.5) * 2;
    let target: number;
    let pull: number;
    let amp: number;
    if (x < 480) {
      // Hook — restless drift just below the strike
      target = 826 + 14 * Math.sin(x / 58);
      pull = 0.1;
      amp = 5;
    } else if (x < 960) {
      // PUMP — impulse move up through the strike
      target = 648;
      pull = 0.05;
      amp = 9;
    } else if (x < 1440) {
      // DUMP — capitulation back down through it
      target = 946;
      pull = 0.055;
      amp = 9;
    } else {
      // RANGE — tight oscillation inside the band
      target = 810 + 52 * Math.sin((x - 1440) / 40);
      pull = 0.2;
      amp = 4;
    }
    y = y + (target - y) * pull + noise * amp;
    raw.push({ x, y });
  }
  // 3-point smoothing so the walk reads as a chart line, not static
  return raw.map((p, i) => {
    const prev = raw[Math.max(0, i - 1)];
    const next = raw[Math.min(raw.length - 1, i + 1)];
    return { x: p.x, y: (prev.y + p.y + next.y) / 3 };
  });
};

const POINTS = buildPoints();

const yAt = (x: number): number => {
  const i = Math.min(Math.floor(x / STEP), POINTS.length - 2);
  const a = POINTS[i];
  const b = POINTS[i + 1];
  const t = (x - a.x) / STEP;
  return a.y + (b.y - a.y) * t;
};

export const PriceLine: React.FC = () => {
  const frame = useCurrentFrame();

  const headX = interpolate(frame, [4, 70, 130, 190, 252], [0, 480, 960, 1440, 1904], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const headY = yAt(headX);

  const visible = POINTS.filter((p) => p.x <= headX);
  const polyPoints =
    visible.map((p) => `${p.x},${Math.round(p.y * 10) / 10}`).join(' ') +
    ` ${headX},${Math.round(headY * 10) / 10}`;
  const areaPoints = `${polyPoints} ${headX},${H} 0,${H}`;

  const headColor = interpolateColors(
    frame,
    [0, 66, 78, 126, 138, 186, 198, 540],
    [C.accent, C.accent, C.pump, C.pump, C.dump, C.dump, C.range, C.range]
  );
  const pulse = 1 + 0.22 * Math.sin(frame / 4);

  const strikeIn = interpolate(frame, [62, 82], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const bandIn = interpolate(frame, [188, 208], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  // Band rails clamp in from outside, mirroring the RANGE word treatment
  const bandTopY = interpolate(bandIn, [0, 1], [BAND_TOP - 46, BAND_TOP]);
  const bandBottomY = interpolate(bandIn, [0, 1], [BAND_BOTTOM + 46, BAND_BOTTOM]);

  // Recede to a watermark under the truths scene, exit before positioning
  const fade = interpolate(frame, [256, 282, 378, 394], [1, 0.13, 0.13, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      style={{ position: 'absolute', inset: 0, opacity: fade }}
    >
      <defs>
        <linearGradient id="wl-line-grad" x1={0} y1={0} x2={W} y2={0} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={C.accent} />
          <stop offset="0.25" stopColor={C.accent} />
          <stop offset="0.31" stopColor={C.pump} />
          <stop offset="0.5" stopColor={C.pump} />
          <stop offset="0.56" stopColor={C.dump} />
          <stop offset="0.75" stopColor={C.dump} />
          <stop offset="0.81" stopColor={C.range} />
          <stop offset="1" stopColor={C.range} />
        </linearGradient>
      </defs>

      {/* RANGE band — fill + rails */}
      <rect
        x={BAND_X}
        y={bandTopY}
        width={W - BAND_X}
        height={bandBottomY - bandTopY}
        fill={C.rangeFill}
        opacity={bandIn * 0.55}
      />
      <line
        x1={BAND_X}
        x2={W}
        y1={bandTopY}
        y2={bandTopY}
        stroke={C.range}
        strokeWidth={2.5}
        opacity={bandIn * 0.8}
      />
      <line
        x1={BAND_X}
        x2={W}
        y1={bandBottomY}
        y2={bandBottomY}
        stroke={C.range}
        strokeWidth={2.5}
        opacity={bandIn * 0.8}
      />

      {/* Strike */}
      <line
        x1={0}
        x2={W}
        y1={STRIKE_Y}
        y2={STRIKE_Y}
        stroke={C.gold}
        strokeWidth={2}
        strokeDasharray="10 12"
        opacity={strikeIn * 0.55}
      />
      <text
        x={30}
        y={STRIKE_Y - 16}
        fill={C.gold}
        opacity={strikeIn * 0.8}
        fontFamily={FONT.mono}
        fontSize={20}
        fontWeight={600}
        letterSpacing={4}
      >
        STRIKE $118,000
      </text>

      {/* Area fill under the drawn line */}
      {visible.length > 1 && <polygon points={areaPoints} fill="url(#wl-line-grad)" opacity={0.055} />}

      {/* The line itself */}
      {visible.length > 1 && (
        <polyline
          points={polyPoints}
          fill="none"
          stroke="url(#wl-line-grad)"
          strokeWidth={5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {/* Glow head */}
      <circle cx={headX} cy={headY} r={26 * pulse} fill={headColor} opacity={0.16} />
      <circle cx={headX} cy={headY} r={13 * pulse} fill={headColor} opacity={0.35} />
      <circle cx={headX} cy={headY} r={7} fill={headColor} />
      <circle cx={headX} cy={headY} r={3} fill="#fff" opacity={0.9} />
    </svg>
  );
};
