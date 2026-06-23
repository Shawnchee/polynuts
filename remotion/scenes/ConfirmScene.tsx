import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, RADIUS } from '../theme';
import { FONT } from '../fonts';
import { Cursor } from '../components/Cursor';

const Check: React.FC<{ size?: number; progress: number }> = ({ size = 18, progress }) => {
  // Stroke draws on as `progress` (0..1) advances — a quiet confirmation, no burst.
  const len = 26;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="11" stroke={C.pump} strokeWidth="1.4" opacity={0.5} />
      <path
        d="M6.5 12.5l3.5 3.5 7-8"
        stroke={C.pump}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={len}
        strokeDashoffset={len * (1 - progress)}
      />
    </svg>
  );
};

/**
 * Scene 3 — Confirm (~1.5s).
 *
 * The "Confirm bet" button is pressed (cursor dips), a compact wallet-style
 * confirm chip flashes ("Confirm in wallet"), then the state resolves to
 * "Filled on Base ~2s" with a short tx hash + an animated green check. One
 * restrained settlement beat — no modal theatrics.
 */
export const ConfirmScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Phase timing (frames within the scene)
  const pressed = frame >= 6 && frame <= 14;
  const walletIn = spring({ frame: frame - 10, fps, config: { damping: 200 } });
  const walletOut = interpolate(frame, [26, 32], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const showWallet = frame >= 10 && frame <= 32;

  const filledIn = spring({ frame: frame - 30, fps, config: { damping: 200, mass: 0.6 } });
  const checkProgress = interpolate(frame, [34, 44], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const showFilled = frame >= 30;

  // Cursor dips onto the CTA then lifts.
  const cy = interpolate(frame, [0, 8, 16], [300, 392, 360], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        padding: 22,
      }}
    >
      {/* Order summary chip — small, persistent context */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontFamily: FONT.mono,
          fontSize: 12,
          color: C.muted,
          opacity: 0.9,
        }}
      >
        <span style={{ color: C.pump, fontWeight: 700 }}>PUMP</span>
        <span style={{ color: C.dim }}>·</span>
        <span>$2.00</span>
        <span style={{ color: C.dim }}>·</span>
        <span>1.8x</span>
      </div>

      {/* The CTA being pressed — mirrors the confirm modal's primary button
          (white text on the direction-colored fill, rounded-md). */}
      <div
        style={{
          width: 320,
          borderRadius: RADIUS.card,
          backgroundColor: C.pump,
          color: '#ffffff',
          textAlign: 'center',
          padding: '13px 0',
          fontWeight: 600,
          fontSize: 14,
          transform: `scale(${pressed ? 0.97 : 1})`,
          boxShadow: pressed ? 'none' : `0 8px 24px -10px ${C.pump}88`,
          opacity: showFilled ? 0.35 : 1,
        }}
      >
        Confirm bet
      </div>

      {/* Wallet confirm chip */}
      {showWallet && (
        <div
          style={{
            opacity: walletIn * walletOut,
            transform: `translateY(${interpolate(walletIn, [0, 1], [8, 0])}px)`,
            display: 'flex',
            alignItems: 'center',
            gap: 9,
            borderRadius: RADIUS.chip,
            border: `1px solid ${C.lineStrong}`,
            backgroundColor: C.card,
            padding: '9px 13px',
            fontFamily: FONT.mono,
            fontSize: 12,
            color: C.muted,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: C.accent }} />
          Confirm in wallet…
        </div>
      )}

      {/* Filled result */}
      {showFilled && (
        <div
          style={{
            opacity: filledIn,
            transform: `translateY(${interpolate(filledIn, [0, 1], [10, 0])}px)`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Check progress={checkProgress} />
            <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 17, color: C.text }}>
              Filled on Base
            </span>
            <span
              style={{
                fontFamily: FONT.mono,
                fontSize: 11,
                color: C.pump,
                border: `1px solid ${C.pumpBorder}`,
                backgroundColor: C.pumpFill,
                borderRadius: 6,
                padding: '3px 8px',
              }}
            >
              ~2s
            </span>
          </div>
          <span style={{ fontFamily: FONT.mono, fontSize: 12, color: C.dim }}>
            0x7af3…e1c9
          </span>
        </div>
      )}

      {!showFilled && <Cursor x={300} y={cy} pressed={pressed} />}
    </div>
  );
};
