import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C } from '../theme';
import { FONT } from '../fonts';
import { MarketCard } from '../components/MarketCard';
import { Cursor } from '../components/Cursor';
import { reveal } from '../components/BrowserWindow';

/**
 * Scene 1 — Markets (~1.5s).
 *
 * The real markets surface: a section label, then two realistic market cards
 * (BTC PUMP $64k/$65k @ 1.8x and a BTC DUMP card). The cursor glides from the
 * bottom-right toward the PUMP card and the PUMP card's selected accent begins
 * to wipe in at the end — handing off to Scene 2 (the trade panel).
 *
 * `local` is the frame within this scene's Sequence.
 */
export const MarketsScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();

  // Cursor path: rest bottom-right → arc up to the PUMP card CTA.
  // Spring keeps it eased and human, not linear.
  const t = spring({ frame: frame - 6, fps, config: { damping: 200, mass: 0.9 } });
  const cx = interpolate(t, [0, 1], [width - 220, 250]);
  const cy = interpolate(t, [0, 1], [430, 232]);

  // PUMP selection accent wipes in over the last ~10 frames of the scene.
  const selectProgress = interpolate(frame, [34, 45], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const pumpSelected = frame >= 34;

  return (
    <div style={{ flex: 1, padding: 22, display: 'flex', flexDirection: 'column' }}>
      {/* Section label row — mirrors HeroAppPreview's "Live markets / Base mainnet" */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
          ...reveal(frame, 0),
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
          Live markets
        </span>
        <span style={{ fontFamily: FONT.mono, fontSize: 11, color: 'rgba(255,255,255,0.32)' }}>
          Base mainnet
        </span>
      </div>

      {/* Two-card grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div style={reveal(frame, 4)}>
          <MarketCard
            asset="BTC"
            question="Will BTC close above $65,000 by 04:00 PM UTC today?"
            direction="PUMP"
            chancePct={56}
            multiplier="1.8"
            volume="$10K"
            expiry="16:00 UTC"
            selected={pumpSelected}
            selectProgress={selectProgress}
          />
        </div>
        <div style={reveal(frame, 9)}>
          <MarketCard
            asset="BTC"
            question="Will BTC drop below $64,000 by 04:00 PM UTC today?"
            direction="DUMP"
            chancePct={41}
            multiplier="2.4"
            volume="$5K"
            expiry="16:00 UTC"
          />
        </div>
      </div>

      <Cursor x={cx} y={cy} pressed={frame >= 38 && frame <= 44} />
    </div>
  );
};
