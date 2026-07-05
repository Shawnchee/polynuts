import React from 'react';
import { Composition } from 'remotion';
import { PolynutsDemo } from './PolynutsDemo';
import { WaitlistVideo } from './waitlist/WaitlistVideo';

/**
 * Composition registry.
 *  - PolynutsDemo: 1280x800 @ 30fps, 476 frames (~16s) — browser-chrome
 *    product walkthrough. Loops cleanly.
 *  - PolynutsWaitlist: 1920x1080 @ 30fps, 540 frames (18s) — full-bleed
 *    kinetic motion-design piece for the waitlist push. Also loops cleanly.
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
    </>
  );
};
