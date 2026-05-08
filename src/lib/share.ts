'use client';

import type { Direction } from '@/lib/sdk/markets';

export type ShareResult = 'win' | 'loss' | 'pending';

export interface ShareCardArgs {
  result: ShareResult;
  /** USDC bet amount (whole-number USD) */
  bet: number;
  /** Payout in whole-number USD — for pending bets, this is the max-payout projection */
  payout: number;
  direction: Direction;
  /** Plain-English question or short copy for the headline */
  question: string;
  asset: string;
}

const SITE_URL =
  typeof window !== 'undefined' ? window.location.origin : 'https://polynuts.xyz';

/**
 * Build a fully-qualified URL to the OG image for the given bet. The URL is
 * what we paste into X / Farcaster intent links — those platforms unfurl it
 * into the rendered card.
 */
export function buildWinCardUrl(args: ShareCardArgs): string {
  const params = new URLSearchParams({
    result: args.result,
    bet: String(Math.max(0, Math.round(args.bet))),
    payout: String(Math.max(0, Math.round(args.payout))),
    direction: args.direction,
    q: args.question.slice(0, 80),
  });
  return `${SITE_URL}/api/win-card?${params.toString()}`;
}

/**
 * Compose the user-facing share copy. Tone differs slightly per result:
 *   - pending: forward-looking ("If I'm right…")
 *   - win:     celebratory
 *   - loss:    rare, but shipped for completeness
 */
function shareCopy(args: ShareCardArgs): string {
  const dir = args.direction.toLowerCase();
  const mult = args.bet > 0 ? (args.payout / args.bet).toFixed(2) : '—';
  if (args.result === 'pending') {
    return `Just bet $${args.bet} ${dir} on ${args.asset}. If I'm right: +$${args.payout} (${mult}x)\n\nbet on-chain →`;
  }
  if (args.result === 'win') {
    return `Just won $${args.payout} betting ${dir} on ${args.asset} (${mult}x)\n\nplace your own bet →`;
  }
  return `Took an L betting ${dir} on ${args.asset} — at least it was on-chain.\n\nbet smarter →`;
}

export function buildXIntent(args: ShareCardArgs): string {
  const text = encodeURIComponent(shareCopy(args));
  const url = encodeURIComponent(SITE_URL);
  return `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
}

/**
 * Warpcast intent URL — supports `embeds[]` for the OG image so the cast
 * unfurls the card directly.
 */
export function buildFarcasterIntent(args: ShareCardArgs): string {
  const text = encodeURIComponent(shareCopy(args));
  const embed = encodeURIComponent(SITE_URL);
  return `https://warpcast.com/~/compose?text=${text}&embeds[]=${embed}`;
}
