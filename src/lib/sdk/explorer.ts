'use client';

import { getReadClient } from './clients';

// `normTx` is defined in src/lib/txKey.ts (a shared, directive-free module) and
// re-exported here so existing `@/lib/sdk/explorer` importers are untouched.
// Server code (sync.ts) imports the SAME function from txKey directly, so both
// sides canonicalise tx hashes identically and can't drift apart.
export { normTx } from '@/lib/txKey';

/**
 * Block-explorer transaction URL for a tx hash on the active chain
 * (Basescan on Base mainnet). Returns null when the hash is missing so
 * callers can omit the link rather than render a dead anchor.
 */
export function txUrl(hash: string | null | undefined): string | null {
  if (!hash) return null;
  const base = getReadClient().chainConfig.explorerUrl;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/tx/${hash}`;
}
