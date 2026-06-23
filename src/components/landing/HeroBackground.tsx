'use client';

import { useEffect, useRef } from 'react';

/**
 * HeroBackground — a faint, drifting candlestick / price-line field.
 *
 * The texture IS the product: a trading surface, not generic decoration. It
 * replaces the old square blueprint grid + corner radial glow (the single most
 * common AI-crypto-landing pattern).
 *
 * How it's drawn
 * --------------
 * A single <canvas> renders a procedural OHLC candlestick field with a drifting
 * accent price polyline threaded through the closes. Candles are generated on a
 * fixed column pitch via a seeded random walk, so the silhouette is coherent
 * (an uptrend/downtrend/chop sequence) rather than noise. Bodies are tinted
 * pump-green / dump-rose by direction at very low opacity (~4-9%); the price
 * line uses the #60a5fa accent, also faint. The whole field drifts slowly
 * leftward; columns that scroll off the left are recycled on the right with a
 * fresh walk step, so the motion never repeats and never pops.
 *
 * Perf
 * ----
 * - One canvas, one rAF loop, integer-snapped column pitch.
 * - DPR-aware backing store, capped at 2 so retina laptops don't overdraw.
 * - The loop pauses via IntersectionObserver when the hero scrolls out of view.
 * - Drift speed is in px/sec (time-delta based), so it's framerate-independent
 *   and stays cheap on a 120Hz panel.
 *
 * Reduced motion / static frame
 * ------------------------------
 * `variant="static"` (used for the CTA), or a `prefers-reduced-motion: reduce`
 * match, both render exactly one frame and never start the rAF loop. The frame
 * is deterministic (fixed seed), so the static picture is composed, not random.
 *
 * Masking is done in CSS (see globals.css `.hero-motif` / `.hero-motif-cta`) so
 * the field dissolves toward the edges and under the headline column — it never
 * competes with the foreground copy or the HeroAppPreview window.
 */

type Variant = 'hero' | 'cta';

interface HeroBackgroundProps {
  variant?: Variant;
}

const ACCENT = '#60a5fa';
// Direction tints (pump-green / dump-rose) at very low alpha. Range-violet is
// reserved as a rare accent column so the field still reads BTC/ETH-binary.
const PUMP = '52, 211, 153'; // emerald-400
const DUMP = '251, 113, 133'; // rose-400
const RANGE = '167, 139, 250'; // violet-400

// A tiny deterministic PRNG (mulberry32) so the field is reproducible frame to
// frame and the static fallback is composed rather than random noise.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Candle {
  // price-space values in [0,1]; mapped to canvas Y at draw time
  open: number;
  close: number;
  high: number;
  low: number;
  dir: 'PUMP' | 'DUMP' | 'RANGE';
  // per-candle body-width scale (×BODY_W) so the field isn't a uniform comb
  wScale: number;
}

// Generate the next candle from the previous close via a gentle biased walk.
function nextCandle(prevClose: number, rnd: () => number, biasRef: { v: number }): Candle {
  // Occasionally flip the trend bias so the field has runs, not pure chop.
  if (rnd() < 0.07) biasRef.v = (rnd() - 0.5) * 0.05;
  // ~16% of bars are higher-volatility movers, so some candles tower over
  // their neighbours instead of every bar standing the same height.
  const vol = rnd() < 0.16 ? 1.9 + rnd() * 1.7 : 1;
  const drift = biasRef.v + (rnd() - 0.5) * 0.085 * vol;
  let close = prevClose + drift;
  // Soft reflect at the edges so the walk stays in [0.12, 0.88].
  if (close > 0.88) close = 0.88 - (close - 0.88);
  if (close < 0.12) close = 0.12 + (0.12 - close);
  close = Math.max(0.1, Math.min(0.9, close));
  const open = prevClose;
  const wick = (0.02 + rnd() * 0.04) * (0.7 + vol * 0.45);
  const high = Math.min(0.95, Math.max(open, close) + wick);
  const low = Math.max(0.05, Math.min(open, close) - wick);
  // ~6% of columns are RANGE (violet) accents; rest is up/down by candle color.
  const dir = rnd() < 0.06 ? 'RANGE' : close >= open ? 'PUMP' : 'DUMP';
  // Randomised body width (0.55×–1.5× BODY_W) so neighbouring candles differ in
  // girth — a uniform-width comb is the dead giveaway of a generated field.
  const wScale = 0.55 + rnd() * 0.95;
  return { open, close, high, low, dir, wScale };
}

export function HeroBackground({ variant = 'hero' }: HeroBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;
    // Non-null locals so the nested draw/resize closures keep the narrowing
    // (TS doesn't carry the guard across function boundaries).
    const g = ctx;
    const cv = canvas;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const animate = variant === 'hero' && !reduce;

    // Visual tuning per variant. The CTA panel is small and centered, so it
    // gets a denser, lower band; the hero is wide and tall.
    const COL = variant === 'cta' ? 34 : 46; // column pitch (px)
    const BODY_W = variant === 'cta' ? 13 : 18; // candle body width (px)
    // Body/wick kept in the 4-10% band so the candles read as a surface, not
    // noise; the line is the brightest element but still faint.
    const BODY_ALPHA = variant === 'cta' ? 0.085 : 0.11;
    const WICK_ALPHA = variant === 'cta' ? 0.07 : 0.09;
    const LINE_ALPHA = variant === 'cta' ? 0.18 : 0.26;
    const DRIFT = 12; // px/sec leftward drift (slightly quicker than the original 9)

    let dpr = 1;
    let cssW = 0;
    let cssH = 0;
    // Price band occupies the lower-middle of the canvas; top is left airy so
    // the headline never sits over dense candles.
    let bandTop = 0;
    let bandH = 0;

    let candles: Candle[] = [];
    const biasRef = { v: 0 };
    let rnd = mulberry32(variant === 'cta' ? 0x9e3779b9 : 0x1a2b3c4d);
    let offset = 0; // sub-pixel drift accumulator
    let raf = 0;
    let running = false;
    let lastT = 0;

    function rebuild() {
      const cols = Math.ceil(cssW / COL) + 3;
      candles = [];
      // reset the walk deterministically so resize doesn't reshuffle the look
      rnd = mulberry32(variant === 'cta' ? 0x9e3779b9 : 0x1a2b3c4d);
      biasRef.v = 0;
      let prev = 0.5;
      for (let i = 0; i < cols; i++) {
        const c = nextCandle(prev, rnd, biasRef);
        candles.push(c);
        prev = c.close;
      }
    }

    function y(v: number) {
      // v in [0,1], higher price = higher on screen
      return bandTop + (1 - v) * bandH;
    }

    function draw() {
      g.clearRect(0, 0, cssW, cssH);

      // ── candles ──
      for (let i = 0; i < candles.length; i++) {
        const c = candles[i];
        const cx = i * COL - offset + COL / 2;
        if (cx < -COL || cx > cssW + COL) continue;

        const tint = c.dir === 'PUMP' ? PUMP : c.dir === 'DUMP' ? DUMP : RANGE;

        // wick
        g.strokeStyle = `rgba(${tint}, ${WICK_ALPHA})`;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(Math.round(cx) + 0.5, y(c.high));
        g.lineTo(Math.round(cx) + 0.5, y(c.low));
        g.stroke();

        // body
        const yo = y(c.open);
        const yc = y(c.close);
        const top = Math.min(yo, yc);
        const h = Math.max(2, Math.abs(yc - yo));
        const bw = BODY_W * c.wScale;
        g.fillStyle = `rgba(${tint}, ${BODY_ALPHA})`;
        g.fillRect(Math.round(cx - bw / 2), top, bw, h);
      }

      // ── accent price polyline through the closes ──
      g.strokeStyle = ACCENT;
      g.globalAlpha = LINE_ALPHA;
      g.lineWidth = 1.5;
      g.lineJoin = 'round';
      g.beginPath();
      let started = false;
      for (let i = 0; i < candles.length; i++) {
        const cx = i * COL - offset + COL / 2;
        const cy = y(candles[i].close);
        if (!started) {
          g.moveTo(cx, cy);
          started = true;
        } else {
          g.lineTo(cx, cy);
        }
      }
      g.stroke();

      // a faint glow node riding the most-recent on-screen close
      let lastIdx = candles.length - 1;
      for (let i = candles.length - 1; i >= 0; i--) {
        if (i * COL - offset + COL / 2 <= cssW) {
          lastIdx = i;
          break;
        }
      }
      const nx = lastIdx * COL - offset + COL / 2;
      const ny = y(candles[lastIdx].close);
      g.beginPath();
      g.arc(nx, ny, 2.2, 0, Math.PI * 2);
      g.globalAlpha = LINE_ALPHA * 1.8;
      g.fillStyle = ACCENT;
      g.fill();
      g.globalAlpha = 1;
    }

    function resize() {
      const rect = cv.getBoundingClientRect();
      cssW = rect.width;
      cssH = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(cssW * dpr);
      cv.height = Math.round(cssH * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (variant === 'cta') {
        bandH = cssH * 0.58;
        bandTop = cssH * 0.40;
      } else {
        bandH = cssH * 0.56;
        bandTop = cssH * 0.40;
      }
      rebuild();
      draw();
    }

    function tick(t: number) {
      if (!running) return;
      if (!lastT) lastT = t;
      const dt = Math.min((t - lastT) / 1000, 0.05); // clamp tab-restore jumps
      lastT = t;

      offset += DRIFT * dt;
      // recycle whole columns as they scroll off the left
      while (offset >= COL) {
        offset -= COL;
        candles.shift();
        const prev = candles[candles.length - 1].close;
        candles.push(nextCandle(prev, rnd, biasRef));
      }
      draw();
      raf = requestAnimationFrame(tick);
    }

    function start() {
      if (running || !animate) return;
      running = true;
      lastT = 0;
      raf = requestAnimationFrame(tick);
    }
    function stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    }

    resize();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => resize());
      ro.observe(canvas);
    } else {
      window.addEventListener('resize', resize);
    }

    let io: IntersectionObserver | null = null;
    if (animate) {
      if (typeof IntersectionObserver !== 'undefined') {
        io = new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (e.isIntersecting) start();
              else stop();
            }
          },
          { threshold: 0 }
        );
        io.observe(canvas);
      } else {
        start();
      }
      // Also halt while the tab is hidden.
      const onVis = () => {
        if (document.hidden) stop();
        else start();
      };
      document.addEventListener('visibilitychange', onVis);
      return () => {
        stop();
        ro?.disconnect();
        io?.disconnect();
        window.removeEventListener('resize', resize);
        document.removeEventListener('visibilitychange', onVis);
      };
    }

    // Static path (CTA or reduced-motion): no loop, just the one frame.
    return () => {
      stop();
      ro?.disconnect();
      window.removeEventListener('resize', resize);
    };
  }, [variant]);

  return (
    <div
      aria-hidden
      className={variant === 'cta' ? 'hero-motif-cta' : 'hero-motif'}
    >
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
