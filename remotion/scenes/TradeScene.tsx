import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, RADIUS } from '../theme';
import { FONT } from '../fonts';
import { MarketCard } from '../components/MarketCard';
import { reveal } from '../components/BrowserWindow';

/**
 * A label/value row inside the trade panel — mirrors the real panel's
 * SummaryRow: `text-sm`, muted label on the left, mono value on the right.
 */
const SummaryRow: React.FC<{ label: string; value: string; accent?: string }> = ({
  label,
  value,
  accent,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      fontSize: 12,
    }}
  >
    <span style={{ color: C.muted }}>{label}</span>
    <span
      style={{
        fontFamily: FONT.mono,
        fontSize: 12,
        fontWeight: 500,
        color: accent ?? C.text,
      }}
    >
      {value}
    </span>
  </div>
);

/** Mirror of the app's <DirectionTag> (PUMP) — tinted bordered pill + arrow. */
const DirectionTag: React.FC = () => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      borderRadius: RADIUS.card,
      border: `1px solid ${C.pumpBorder}`,
      backgroundColor: C.pumpFill,
      color: C.pump,
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: 0.4,
      lineHeight: 1,
      textTransform: 'uppercase',
    }}
  >
    <svg width={10} height={10} viewBox="0 0 24 24" fill="none">
      <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke={C.pump} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    PUMP
  </span>
);

/**
 * Scene 2 — Pick direction (~2s).
 *
 * The PUMP card stays selected on the left; a trade panel slides in from the
 * right with the bet summary: "You bet PUMP", contracts, cost, max payout +
 * multiplier, implied probability. Restraint over flash — this matches the
 * app's real trade panel density. NO taker/platform fee line (per product
 * rule: the taker pays only the premium).
 */
export const TradeScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Panel slide-in from the right.
  const t = spring({ frame, fps, config: { damping: 200, mass: 0.7 } });
  const panelX = interpolate(t, [0, 1], [60, 0]);
  const panelOpacity = interpolate(t, [0, 1], [0, 1]);

  return (
    <div style={{ flex: 1, padding: 22, display: 'flex', gap: 16 }}>
      {/* Left — the selected PUMP card persists (continuity from Scene 1) */}
      <div style={{ width: '46%', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <span
          style={{
            fontFamily: FONT.mono,
            fontSize: 11,
            letterSpacing: 2.2,
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          Live markets
        </span>
        <MarketCard
          asset="BTC"
          question="Will BTC close above $65,000 by 04:00 PM UTC today?"
          direction="PUMP"
          chancePct={56}
          multiplier="1.8"
          volume="$10K"
          expiry="16:00 UTC"
          selected
          selectProgress={1}
        />
      </div>

      {/* Right — trade panel (mirror of <TradePanel>) */}
      <div
        style={{
          flex: 1,
          opacity: panelOpacity,
          transform: `translateX(${panelX}px)`,
        }}
      >
        <div
          style={{
            // rounded-xl border border-line bg-bg-elev p-4
            borderRadius: RADIUS.window,
            border: `1px solid ${C.lineToken}`,
            backgroundColor: C.card,
            padding: 16,
            height: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header — "Place Your Bet" + DirectionTag */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              ...reveal(frame, 6),
            }}
          >
            <span style={{ fontFamily: FONT.display, fontWeight: 600, fontSize: 15, color: C.text }}>
              Place Your Bet
            </span>
            <DirectionTag />
          </div>

          {/* Question line */}
          <p
            style={{
              margin: '12px 0 0',
              fontSize: 13,
              lineHeight: '18px',
              fontWeight: 500,
              color: C.text,
              ...reveal(frame, 10),
            }}
          >
            Will BTC close above $65,000 by 04:00 PM UTC today?
          </p>

          {/* Hero payout — "If correct, you win" big green number */}
          <div
            style={{
              marginTop: 16,
              borderRadius: RADIUS.lg,
              border: `1px solid ${C.pumpBorder}`,
              backgroundColor: 'rgba(34,197,94,0.10)',
              padding: 16,
              textAlign: 'center',
              ...reveal(frame, 14),
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                color: C.dim,
              }}
            >
              If correct, you win
            </div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontWeight: 700,
                fontSize: 28,
                letterSpacing: -0.5,
                color: C.pump,
                marginTop: 4,
              }}
            >
              +$3.60
            </div>
            <div
              style={{
                fontFamily: FONT.mono,
                fontSize: 12,
                fontWeight: 600,
                color: C.muted,
                marginTop: 4,
              }}
            >
              1.80x return · 56% implied probability
            </div>
          </div>

          {/* Detail rows — mirror the panel's collapsed "Trade details" */}
          <div
            style={{
              marginTop: 12,
              borderRadius: RADIUS.card,
              border: `1px solid ${C.lineToken}`,
              backgroundColor: C.cardDeep,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 7,
              ...reveal(frame, 18),
            }}
          >
            <SummaryRow label="You bet" value="$2.00 USDC" />
            <SummaryRow label="Contracts" value="0.0023" />
            <SummaryRow label="Max loss" value="$2.00 USDC" />
          </div>

          {/* Primary CTA — direction-colored solid (idle; pressed in Scene 3) */}
          <div
            style={{
              marginTop: 'auto',
              borderRadius: RADIUS.card,
              backgroundColor: C.pump,
              color: '#ffffff',
              textAlign: 'center',
              padding: '12px 0',
              fontWeight: 600,
              fontSize: 14,
              ...reveal(frame, 24),
            }}
          >
            Bet PUMP — $2.00 USDC
          </div>
        </div>
      </div>
    </div>
  );
};
