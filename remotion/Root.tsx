import React from 'react';
import { Composition } from 'remotion';
import { PolynutsDemo } from './PolynutsDemo';
import { WaitlistVideo } from './waitlist/WaitlistVideo';
import { LaunchTeaser } from './waitlist/LaunchTeaser';
import { LiveTeaser } from './waitlist/LiveTeaser';

/**
 * Composition registry.
 *  - PolynutsDemo: 1280x800 @ 30fps, 476 frames (~16s) — browser-chrome
 *    product walkthrough. Loops cleanly.
 *  - PolynutsWaitlist: 1920x1080 @ 30fps, 540 frames (18s) — full-bleed
 *    kinetic motion-design piece for the waitlist push. Also loops cleanly.
 *  - PolynutsLaunchTeaser: 1080x1080 @ 30fps, 150 frames (5s) — square,
 *    feed-native "launching in a few days" teaser for X. Loops cleanly.
 *  - PolynutsLive: 1080x1080 @ 30fps, 180 frames (6s) — square launch-day
 *    "we're LIVE" hype teaser for X. Loops cleanly.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="PolynutsDemo"
        component={PolynutsDemo}
        durationInFrames={476}
        fps={30}
        width={1280}
        height={800}
      />
      <Composition
        id="PolynutsWaitlist"
        component={WaitlistVideo}
        durationInFrames={540}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="PolynutsLaunchTeaser"
        component={LaunchTeaser}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1080}
      />
      <Composition
        id="PolynutsLive"
        component={LiveTeaser}
        durationInFrames={180}
        fps={30}
        width={1080}
        height={1080}
      />
    </>
  );
};
