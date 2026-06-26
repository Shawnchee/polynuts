import React from 'react';
import { C, RADIUS } from '../theme';
import { FONT } from '../fonts';

type Dir = 'PUMP' | 'DUMP' | 'RANGE';

const dirColor: Record<Dir, string> = { PUMP: C.pump, DUMP: C.dump, RANGE: C.range };
const dirFill: Record<Dir, string> = { PUMP: C.pumpFill, DUMP: C.dumpFill, RANGE: C.rangeFill };
const dirBorder: Record<Dir, string> = {
  PUMP: C.pumpBorder,
  DUMP: C.dumpBorder,
  RANGE: C.rangeBorder,
};

/**
 * Round token logo — exact match to the app's <TokenIcon size={24}>. We inline
 * the same brand SVGs the app serves from /public/tokens (btc.svg / eth.svg),
 * so the glyph is pixel-identical to the live card rather than an approximation
 * (the app uses the cryptocurrency-icons set). Unknown assets fall back to a
 * lettered circle, mirroring the app's fallback.
 */
const TokenIcon: React.FC<{ asset: string }> = ({ asset }) => {
  const common = {
    width: 24,
    height: 24,
    viewBox: '0 0 32 32',
    style: { flexShrink: 0, marginTop: 2, display: 'block' as const },
  };
  if (asset === 'BTC') {
    return (
      <svg {...common}>
        <g fill="none" fillRule="evenodd">
          <circle cx="16" cy="16" r="16" fill="#F7931A" />
          <path
            fill="#FFF"
            fillRule="nonzero"
            d="M23.189 14.02c.314-2.096-1.283-3.223-3.465-3.975l.708-2.84-1.728-.43-.69 2.765c-.454-.114-.92-.22-1.385-.326l.695-2.783L15.596 6l-.708 2.839c-.376-.086-.746-.17-1.104-.26l.002-.009-2.384-.595-.46 1.846s1.283.294 1.256.312c.7.175.826.638.805 1.006l-.806 3.235c.048.012.11.03.18.057l-.183-.045-1.13 4.532c-.086.212-.303.531-.793.41.018.025-1.256-.313-1.256-.313l-.858 1.978 2.25.561c.418.105.828.215 1.231.318l-.715 2.872 1.727.43.708-2.84c.472.127.93.245 1.378.357l-.706 2.828 1.728.43.715-2.866c2.948.558 5.164.333 6.097-2.333.752-2.146-.037-3.385-1.588-4.192 1.13-.26 1.98-1.003 2.207-2.538zm-3.95 5.538c-.533 2.147-4.148.986-5.32.695l.95-3.805c1.172.293 4.929.872 4.37 3.11zm.535-5.569c-.487 1.953-3.495.96-4.47.717l.86-3.45c.975.243 4.118.696 3.61 2.733z"
          />
        </g>
      </svg>
    );
  }
  if (asset === 'ETH') {
    return (
      <svg {...common}>
        <g fill="none" fillRule="evenodd">
          <circle cx="16" cy="16" r="16" fill="#627EEA" />
          <g fill="#FFF" fillRule="nonzero">
            <path fillOpacity=".602" d="M16.498 4v8.87l7.497 3.35z" />
            <path d="M16.498 4L9 16.22l7.498-3.35z" />
            <path fillOpacity=".602" d="M16.498 21.968v6.027L24 17.616z" />
            <path d="M16.498 27.995v-6.028L9 17.616z" />
            <path fillOpacity=".2" d="M16.498 20.573l7.497-4.353-7.497-3.348z" />
            <path fillOpacity=".602" d="M9 16.22l7.498 4.353v-7.701z" />
          </g>
        </g>
      </svg>
    );
  }
  return (
    <div
      style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        backgroundColor: C.surface,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        marginTop: 2,
      }}
    >
      <span style={{ fontFamily: FONT.display, fontWeight: 700, fontSize: 13, color: C.text, lineHeight: 1 }}>
        {asset.slice(0, 1)}
      </span>
    </div>
  );
};

/**
 * Mirror of the app's <TimerBadge> — a borderless clock icon + fixed expiry
 * label in muted text (NOT a bordered pill). The real badge is
 * `inline-flex items-center gap-1 text-xs tabular-nums` with a 10px Clock.
 */
const TimerBadge: React.FC<{ label: string }> = ({ label }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontFamily: FONT.mono,
      fontSize: 12,
      lineHeight: 1,
      color: C.muted,
    }}
  >
    <svg width={10} height={10} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" stroke={C.muted} strokeWidth="2" />
      <path d="M12 7v5l3 2" stroke={C.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    {label}
  </span>
);

/**
 * Remotion mirror of the app's <MarketCard>. Same anatomy: header (glyph +
 * question + % chance), a single direction CTA bar, and a liq/expiry meta
 * strip. Styling is hardcoded from the dark tokens (see theme.ts).
 *
 * `selected` raises the border, adds a faint ring + a top accent hairline in
 * the direction color — exactly the real card's selected affordance.
 */
export const MarketCard: React.FC<{
  asset: string;
  question: string;
  direction: Dir;
  chancePct: number;
  multiplier: string;
  volume: string;
  expiry: string;
  selected?: boolean;
  /** 0..1 — how far the selected accent bar has wiped in. */
  selectProgress?: number;
}> = ({
  asset,
  question,
  direction,
  chancePct,
  multiplier,
  volume,
  expiry,
  selected = false,
  selectProgress = 0,
}) => {
  const accent = dirColor[direction];
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        // rounded-xl = 18px in the app's scale
        borderRadius: RADIUS.window,
        // Default border-line (#323C51); selected = border-text + faint ring
        border: `1px solid ${selected ? C.text : C.lineToken}`,
        backgroundColor: C.card,
        // p-3 = 12px
        padding: 12,
        overflow: 'hidden',
        boxShadow: selected
          ? `0 0 0 2px rgba(237,240,246,0.08), 0 0 30px -8px ${accent}55`
          : 'none',
        transition: 'none',
      }}
    >
      {/* Selected top accent hairline (wipes in left→right) */}
      {selected && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: 2,
            width: `${selectProgress * 100}%`,
            backgroundColor: accent,
          }}
        />
      )}

      {/* Header — TokenIcon(24) + question on the left; {N}% / chance on the right */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, minWidth: 0, flex: 1 }}>
          <TokenIcon asset={asset} />
          <p
            style={{
              margin: 0,
              // text-sm = 12px / leading-snug
              fontSize: 12,
              lineHeight: '16px',
              fontWeight: 500,
              color: C.text,
              minHeight: 34,
            }}
          >
            {question}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
          {/* text-md = 15px, font-bold, direction-colored */}
          <span style={{ fontFamily: FONT.mono, fontWeight: 700, fontSize: 15, color: accent, lineHeight: 1.1 }}>
            {chancePct}%
          </span>
          <span style={{ fontSize: 9, letterSpacing: 0.6, textTransform: 'uppercase', color: C.dim }}>
            chance
          </span>
        </div>
      </div>

      {/* Outcome CTA — single full-width tinted bordered pill (rounded-md). */}
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          // rounded-md = 10px
          borderRadius: RADIUS.card,
          border: `1px solid ${dirBorder[direction]}`,
          backgroundColor: dirFill[direction],
          // px-2.5 py-2
          padding: '8px 10px',
          // text-xs = 10px, font-semibold
          fontSize: 12,
          fontWeight: 600,
          color: accent,
        }}
      >
        {`Bet ${direction} · ${multiplier}x max`}
      </div>

      {/* Meta strip — {liq} liq (left) + TimerBadge (right) */}
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 12,
          color: C.muted,
        }}
      >
        <span style={{ fontFamily: FONT.mono }}>
          <span style={{ color: C.text, fontWeight: 600 }}>{volume}</span> liq
        </span>
        <TimerBadge label={expiry} />
      </div>
    </div>
  );
};
