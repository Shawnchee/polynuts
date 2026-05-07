'use client';

import { useLiveFeed } from '@/lib/sdk/useLiveFeed';

/**
 * Mounted once at app root. Owns the WebSocket connection lifecycle.
 */
export function LiveFeedBoot() {
  useLiveFeed();
  return null;
}
