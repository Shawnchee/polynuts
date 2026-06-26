/**
 * Canonical tx-hash / trade-key helpers — the SINGLE source of truth for
 * comparing identifiers that arrive formatted differently from each source.
 *
 * The Thetanuts indexer returns tx hashes WITHOUT the `0x` prefix and addresses
 * checksummed; our Supabase rows store ethers' `receipt.hash` WITH the prefix
 * and option ids lowercased. A raw string compare therefore never matches —
 * which silently broke the settlement-sync join (settled trades stuck on
 * "FILLED" with no realized PnL) and the position↔DB premium join.
 *
 * Both the server (`server-only` sync) and the browser (`'use client'`
 * explorer) canonicalise through THIS module, so the two sides can never drift
 * out of agreement. It must therefore stay free of BOTH the `'use client'` and
 * `server-only` directives (and import nothing that carries them).
 */

/** Strip a leading `0x` prefix and lowercase a tx hash so any source keys identically. */
export function normTx(hash: string | null | undefined): string {
  return (hash ?? '').toLowerCase().replace(/^0x/, '');
}

/**
 * Canonical `0x`-prefixed form of a tx hash for storage / Basescan links
 * (matches how `trades.tx_hash` is stored from `receipt.hash`). Null in → null
 * out so nullable columns stay null. Idempotent on an already-prefixed hash.
 */
export function prefixTx(hash: string | null | undefined): string | null {
  if (!hash) return null;
  return '0x' + normTx(hash);
}

/**
 * Canonical join key between an indexer history row and a DB trade row:
 * `<bare-lowercased-tx>:<lowercased-option-id>`. Used wherever the two sources
 * are matched (settlement sync, position↔DB premium join). Params are typed
 * `string` (callers always have both), but the body is nullish-guarded.
 */
export function tradeKey(txHash: string, optionId: string): string {
  return `${normTx(txHash)}:${(optionId ?? '').toLowerCase()}`;
}
