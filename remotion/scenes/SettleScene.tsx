import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { C, RADIUS } from '../theme';
import { FONT } from '../fonts';

/**
 * Scene 4 — Settle / WIN (~2s).
 *
 * The BTC spot price ticks UP past the $65,000 strike; once it crosses, the
 * position status flips PENDING → WON and the payout counts up to +$3.60 USDC
 * in green. One restrained celebration beat: a single soft ring pulse behind
 * the payout — no confetti, no particle spam.
 */
export const SettleScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Spot price climbs 64,820 → 65,140 over the first ~30 frames, easing out.
  const priceT = interpolate(frame, [4, 34], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const price = 64820 + priceT * (65140 - 64820);
  const crossed = price >= 65000;
  const crossFrame = 22; // ~ when price passes 65,000

  // Mini sparkline points (climbing) — derived, not random, so it's stable.
  const pts = Array.from({ length: 24 }, (_, i) => {
    const p = i / 23;
    const eased = Math.pow(p, 1.4);
    return { x: p, y: 0.72 - eased * 0.5 + Math.sin(p * 9) * 0.03 };
  });

  // WON badge + payout reveal after the cross.
  const wonIn = spring({ frame: frame - crossFrame, fps, config: { damping: 200, mass: 0.6 } });
  const payoutT = interpolate(frame, [crossFrame + 4, crossFrame + 26], [0, 3.6], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.bezier(0.22, 1, 0.36, 1),
  });
  // Single soft ring pulse (the one restrained celebration beat).
  const ringT = interpolate(frame, [crossFrame, crossFrame + 22], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const lineColor = crossed ? C.pump : C.muted;

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        padding: 26,
        gap: 18,
      }}
    >
      <span
        style={{
          fontFamily: FONT.mono,
          fontSize: 11,
          letterSpacing: 2.2,
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.4)',
        }}
      >
        Your position
      </span>

      {/* Position card — rounded-xl border border-line bg-bg-elev */}
      <div
        style={{
          borderRadius: RADIUS.window,
          border: `1px solid ${crossed ? C.pumpBorder : C.lineToken}`,
          backgroundColor: C.card,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: crossed ? `0 0 40px -16px ${C.pump}` : 'none',
        }}
      >
        {/* Top row: market label + side + status badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Market label — matches the table's "BTC $65,000" cell */}
            <span style={{ fontWeight: 500, fontSize: 14, color: C.text }}>
              BTC $65,000
            </span>
            {/* Side = YES (buyer) in pump-dark, matching the Side column */}
            <span
              style={{
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                color: C.pump,
              }}
            >
              YES
            </span>
          </div>
          {crossed ? (
            // StatusBadge WON: rounded-md px-2 py-0.5 text-xs font-bold uppercase,
            // bg-pump/15 text-pump-dark.
            <span
              style={{
                opacity: wonIn,
                transform: `scale(${interpolate(wonIn, [0, 1], [0.8, 1])})`,
                fontFamily: FONT.body,
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                color: C.pump,
                backgroundColor: C.pumpFill,
                borderRadius: RADIUS.card,
                padding: '2px 8px',
              }}
            >
              WON
            </span>
          ) : (
            // PENDING: bg-gold/15 text-gold, same badge shape.
            <span
              style={{
                fontFamily: FONT.body,
                fontWeight: 700,
                fontSize: 11,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
                color: C.gold,
                backgroundColor: 'rgba(245,158,11,0.15)',
                borderRadius: RADIUS.card,
                padding: '2px 8px',
              }}
            >
              PENDING
            </span>
          )}
        </div>

        {/* Price + sparkline */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 11, color: C.dim, fontFamily: FONT.mono, letterSpacing: 0.5 }}>
              BTC SPOT
            </span>
            <span style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 30, color: lineColor }}>
              {`$${Math.round(price).toLocaleString('en-US')}`}
            </span>
            <span style={{ fontSize: 11, color: C.dim, fontFamily: FONT.mono }}>
              strike $65,000
            </span>
          </div>

          {/* Sparkline with strike line */}
          <svg width={220} height={84} viewBox="0 0 220 84" style={{ overflow: 'visible' }}>
            {/* strike reference */}
            <line x1={0} y1={42} x2={220} y2={42} stroke={C.lineToken} strokeWidth={1} strokeDasharray="4 4" />
            <polyline
              points={pts.map((p) => `${p.x * 220},${p.y * 84}`).join(' ')}
              fill="none"
              stroke={lineColor}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* leading dot */}
            <circle cx={220} cy={pts[pts.length - 1].y * 84} r={3.5} fill={lineColor} />
          </svg>
        </div>

        {/* PnL row — label matches the table's "PnL" column; value uses the
            app's PnlPill format (font-semibold tabular, signed currency). */}
        <div
          style={{
            borderTop: `1px solid ${C.lineToken}`,
            paddingTop: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            position: 'relative',
          }}
        >
          <span style={{ fontSize: 12, color: C.muted }}>PnL</span>
          <div style={{ position: 'relative' }}>
            {/* single soft ring pulse */}
            {crossed && (
              <span
                style={{
                  position: 'absolute',
                  inset: -10,
                  borderRadius: 12,
                  border: `1.5px solid ${C.pump}`,
                  opacity: (1 - ringT) * 0.5,
                  transform: `scale(${1 + ringT * 0.5})`,
                  pointerEvents: 'none',
                }}
              />
            )}
            <span
              style={{
                fontFamily: FONT.mono,
                fontWeight: 600,
                fontSize: 22,
                color: crossed ? C.pump : C.dim,
              }}
            >
              {crossed ? `+$${payoutT.toFixed(2)}` : '$0.00'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
