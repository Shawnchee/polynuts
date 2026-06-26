import React from 'react';
import { Composition } from 'remotion';
import { PolynutsDemo } from './PolynutsDemo';

/**
 * Composition registry. The demo is 1280x800 @ 30fps, 476 frames (~16s) and
 * loops cleanly (the end card fades and the markets scene fades in).
 */
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="PolynutsDemo"
      component={PolynutsDemo}
      durationInFrames={476}
      fps={30}
      width={1280}
      height={800}
    />
  );
};
