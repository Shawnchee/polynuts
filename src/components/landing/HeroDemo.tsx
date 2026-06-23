'use client';

import { useEffect, useState } from 'react';

/**
 * Hero demo player — the rendered Remotion clip (polynuts-demo.mp4). The clip
 * already renders the app's browser-window chrome (titlebar, URL pill, LIVE
 * dot) inside the composition, so it reads as a live screen capture of
 * polynuts.app, not a banner ad — and we present it raw here (no duplicate
 * frame, just a rounded card + shadow).
 *
 * Self-contained on purpose: the lead wires it into the landing page. It is
 * NOT imported anywhere yet.
 *
 * Reduced motion: visitors with `prefers-reduced-motion: reduce` get the
 * static poster image instead of an autoplaying loop. We resolve the
 * preference on the client (after mount) so SSR output is stable.
 *
 * Assets come from the render step the lead runs:
 *   /public/demo/polynuts-demo.mp4          (npm run render:demo)
 *   /public/demo/polynuts-demo-poster.jpg   (poster frame, exported separately)
 */
export function HeroDemo() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <div className="relative w-full">
      {/* Soft brand glow behind the frame — blue→violet, breathes slowly so the
          demo obviously reads as a live product video, not a static image.
          Sits first in the DOM so the framed card paints above it; goes static
          under reduced motion. */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -inset-5 ${reducedMotion ? '' : 'hero-demo-glow'}`}
        style={{
          background:
            'radial-gradient(58% 58% at 50% 50%, rgba(96,165,250,0.38), rgba(167,139,250,0.20) 48%, transparent 72%)',
          filter: 'blur(26px)',
        }}
      />

      {/* Gradient-stroke border (1.5px): blue → faint white → violet. */}
      <div
        className="relative rounded-2xl p-[1.5px] shadow-2xl shadow-black/60"
        style={{
          background:
            'linear-gradient(135deg, rgba(96,165,250,0.85), rgba(255,255,255,0.10) 42%, rgba(167,139,250,0.75))',
        }}
      >
        <div className="relative overflow-hidden rounded-[15px] bg-[#0a0e16]">
          {/* Bright accent hairline along the top edge */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px"
            style={{ background: 'linear-gradient(to right, transparent, rgba(96,165,250,0.9), transparent)' }}
          />
          {/* The clip already renders the app's browser-window chrome, so it
              sits raw here. aspectRatio matches the 1280x800 composition. */}
          <div style={{ aspectRatio: '1280 / 800' }}>
            {reducedMotion ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/demo/polynuts-demo-poster.jpg"
                alt="Polynuts demo: bet PUMP on BTC, fill on Base, win USDC."
                className="h-full w-full object-cover"
              />
            ) : (
              <video
                className="h-full w-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                poster="/demo/polynuts-demo-poster.jpg"
                src="/demo/polynuts-demo.mp4"
              />
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes heroDemoGlow {
          0%,
          100% {
            opacity: 0.55;
            transform: scale(0.99);
          }
          50% {
            opacity: 1;
            transform: scale(1.02);
          }
        }
        .hero-demo-glow {
          animation: heroDemoGlow 4.5s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-demo-glow {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
