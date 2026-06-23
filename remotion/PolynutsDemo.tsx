import React from 'react';
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { BrowserWindow } from './components/BrowserWindow';
import { MarketsScene } from './scenes/MarketsScene';
import { TradeScene } from './scenes/TradeScene';
import { ConfirmScene } from './scenes/ConfirmScene';
import { SettleScene } from './scenes/SettleScene';
import { WhyScene } from './scenes/WhyScene';
import { EndScene } from './scenes/EndScene';
import { C } from './theme';
import './fonts';

/**
 * Scene schedule (30fps). Total 476 frames ≈ 15.9s.
 *   1. Markets   0–48    (1.6s)  browser frame, two cards, cursor → PUMP
 *   2. Trade     48–110  (2.1s)  selected card + trade panel slides in
 *   3. Confirm   110–162 (1.7s)  press → wallet → "Filled on Base ~2s"
 *   4. Settle    162–222 (2.0s)  price crosses strike → WON → payout counts up
 *   5. Why       222–404 (6.1s)  "Why Polynuts" — four feature cards (no chrome)
 *   6. End       404–476 (2.4s)  wordmark + tagline + CTA (no chrome)
 *
 * Scenes 1–4 share the BrowserWindow so the whole thing reads as one capture.
 * A short cross-dissolve at each handoff hides the Sequence cut. The URL pill
 * swaps to /trade then /portfolio as the user moves through the flow.
 */
const S = {
  markets: { from: 0, dur: 50 },
  trade: { from: 48, dur: 64 },
  confirm: { from: 110, dur: 54 },
  settle: { from: 162, dur: 62 },
  why: { from: 222, dur: 188 },
  end: { from: 404, dur: 72 },
} as const;

/** Cross-dissolve wrapper — fades a scene in at its head and out at its tail. */
const Dissolve: React.FC<{
  from: number;
  dur: number;
  fade?: number;
  children: React.ReactNode;
}> = ({ from, dur, fade = 8, children }) => {
  const frame = useCurrentFrame();
  const local = frame - from;
  const opacity = interpolate(
    local,
    [0, fade, dur - fade, dur],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export const PolynutsDemo: React.FC = () => {
  const frame = useCurrentFrame();
  // URL pill reflects where we are: markets list → bet flow → portfolio (the
  // Settle scene is the position view, so it reads /portfolio, not /trade).
  const url =
    frame >= S.settle.from + 6
      ? 'polynuts.app/portfolio'
      : frame >= S.trade.from + 6
      ? 'polynuts.app/trade'
      : 'polynuts.app/markets';

  return (
    <AbsoluteFill style={{ backgroundColor: C.appBg }}>
      {/* Scenes 1–4 live inside the persistent browser chrome */}
      <Sequence from={0} durationInFrames={S.settle.from + S.settle.dur}>
        <BrowserWindow url={url}>
          <Dissolve from={S.markets.from} dur={S.markets.dur}>
            <Sequence from={S.markets.from} durationInFrames={S.markets.dur} layout="none">
              <MarketsScene />
            </Sequence>
          </Dissolve>
          <Dissolve from={S.trade.from} dur={S.trade.dur}>
            <Sequence from={S.trade.from} durationInFrames={S.trade.dur} layout="none">
              <TradeScene />
            </Sequence>
          </Dissolve>
          <Dissolve from={S.confirm.from} dur={S.confirm.dur}>
            <Sequence from={S.confirm.from} durationInFrames={S.confirm.dur} layout="none">
              <ConfirmScene />
            </Sequence>
          </Dissolve>
          <Dissolve from={S.settle.from} dur={S.settle.dur}>
            <Sequence from={S.settle.from} durationInFrames={S.settle.dur} layout="none">
              <SettleScene />
            </Sequence>
          </Dissolve>
        </BrowserWindow>
      </Sequence>

      {/* Scene 5 — Why Polynuts, no chrome */}
      <Dissolve from={S.why.from} dur={S.why.dur} fade={10}>
        <Sequence from={S.why.from} durationInFrames={S.why.dur} layout="none">
          <WhyScene />
        </Sequence>
      </Dissolve>

      {/* Scene 6 — end card, no chrome */}
      <Dissolve from={S.end.from} dur={S.end.dur} fade={10}>
        <Sequence from={S.end.from} durationInFrames={S.end.dur} layout="none">
          <EndScene />
        </Sequence>
      </Dissolve>
    </AbsoluteFill>
  );
};
