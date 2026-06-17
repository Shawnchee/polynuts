'use client';

import { getReadClient } from './clients';

/**
 * Canonicalise a tx hash for cross-source comparison. The Thetanuts indexer
 * returns hashes WITHOUT the `0x` prefix (e.g. `643fec…`) while our Supabase
 * rows store ethers' `receipt.hash` WITH it (`0x643fec…`). Lowercasing alone
 * never makes them equal, which silently broke the position↔DB premium join
 * and the fill-vs-position dedup. Strip the prefix + lowercase so both sides
 * key identically.
 */
export function normTx(hash: string | null | undefined): string {
  return (hash ?? '').toLowerCase().replace(/^0x/, '');
}

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
