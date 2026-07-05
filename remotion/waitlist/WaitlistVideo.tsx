import React from 'react';
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from 'remotion';
import { Background } from './Background';
import { PriceLine } from './PriceLine';
import { HookScene } from './scenes/HookScene';
import { CallScene } from './scenes/CallScene';
import { TruthsScene } from './scenes/TruthsScene';
import { PositionScene } from './scenes/PositionScene';
import { EndCardScene } from './scenes/EndCardScene';
import { C } from '../theme';
import '../fonts';

/**
 * Waitlist video — 1920x1080 @ 30fps, 540 frames (18s).
 *
 * Deliberately the opposite style of PolynutsDemo (the browser-chrome screen
 * capture): full-bleed kinetic motion design. One continuous market line acts
 * out the product mechanic while giant type explains it.
 *
 * Schedule:
 *   1. Hook      0–70    "BTC moves every day. Can you call it?" + live ticker
 *   2. PUMP      70–130  word slams up, line surges above the strike
 *   3. DUMP      130–190 word drops in, line crashes below the strike
 *   4. RANGE     190–256 word clamps in, line oscillates inside the band
 *   5. Truths    258–378 max loss / settlement / custody + "live on Base"
 *   6. Position  380–448 "Like Polymarket. But for options."
 *   7. End card  450–540 wordmark + "Bet the moment. Get in early." + CTA
 *
 * Background (grid + glows) and the price line persist across cuts; the end
 * card fades out over the bare background so the video loops seamlessly.
 */
const S = {
  hook: { from: 0, dur: 70 },
  pump: { from: 70, dur: 60 },
  dump: { from: 130, dur: 60 },
  range: { from: 190, dur: 66 },
  truths: { from: 258, dur: 120 },
  position: { from: 380, dur: 68 },
  end: { from: 450, dur: 90 },
} as const;

/** Fades a scene in at its head and out at its tail (over the shared bg). */
const Fade: React.FC<{
  from: number;
  dur: number;
  fade?: number;
  children: React.ReactNode;
}> = ({ from, dur, fade = 8, children }) => {
  const frame = useCurrentFrame();
  const local = frame - from;
  const opacity = interpolate(local, [0, fade, dur - fade, dur], [0, 1, 1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

export const WaitlistVideo: React.FC = () => {
  return (
    <AbsoluteFill>
      <Background />

      {/* The market line — persists under scenes 1–5 */}
      <Sequence from={0} durationInFrames={S.position.from + 14}>
        <PriceLine />
      </Sequence>

      <Fade from={S.hook.from} dur={S.hook.dur}>
        <Sequence from={S.hook.from} durationInFrames={S.hook.dur} layout="none">
          <HookScene />
        </Sequence>
      </Fade>

      {/* The three calls animate their own enters/exits — no fade wrapper */}
      <Sequence from={S.pump.from} durationInFrames={S.pump.dur}>
        <CallScene
          word="PUMP"
          color={C.pump}
          glow="rgba(34,197,94,0.5)"
          caption="CLOSES ABOVE THE STRIKE"
          mode="up"
          dur={S.pump.dur}
        />
      </Sequence>
      <Sequence from={S.dump.from} durationInFrames={S.dump.dur}>
        <CallScene
          word="DUMP"
          color={C.dump}
          glow="rgba(244,63,94,0.5)"
          caption="CLOSES BELOW THE STRIKE"
          mode="down"
          dur={S.dump.dur}
        />
      </Sequence>
      <Sequence from={S.range.from} durationInFrames={S.range.dur}>
        <CallScene
          word="RANGE"
          color={C.range}
          glow="rgba(167,139,250,0.5)"
          caption="STAYS INSIDE THE BAND"
          mode="clamp"
          dur={S.range.dur}
        />
      </Sequence>

      <Fade from={S.truths.from} dur={S.truths.dur} fade={10}>
        <Sequence from={S.truths.from} durationInFrames={S.truths.dur} layout="none">
          <TruthsScene />
        </Sequence>
      </Fade>

      <Fade from={S.position.from} dur={S.position.dur} fade={8}>
        <Sequence from={S.position.from} durationInFrames={S.position.dur} layout="none">
          <PositionScene />
        </Sequence>
      </Fade>

      {/* End card — fades out over the bare bg for a clean loop point */}
      <Fade from={S.end.from} dur={S.end.dur} fade={10}>
        <Sequence from={S.end.from} durationInFrames={S.end.dur} layout="none">
          <EndCardScene />
        </Sequence>
      </Fade>
    </AbsoluteFill>
  );
};
