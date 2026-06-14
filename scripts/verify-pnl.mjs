/**
 * verify-pnl.mjs
 *
 * Validates the assumption behind src/lib/sdk/positionLogic.ts —
 * that the indexer-supplied `Position.pnlUsd` is the trustworthy
 * realized-PnL figure for SETTLED buyer-side trades, and that the
 * legacy `(h.amount * h.price) / 1e8` formula on TradeHistory is
 * broken for inverse-collateral options (BTC/ETH spreads against
 * USDC).
 *
 * Usage:
 *   node scripts/verify-pnl.mjs <userAddress>
 *
 * Example (test trade from the bug report — BTC $80k/$81k spread,
 * tx 0x6a04794cb5c4432e58aaf49e3230f688b28135d6fe0202d3d49f1f07a0ddbe35):
 *   node scripts/verify-pnl.mjs <wallet-that-placed-that-trade>
 *
 * Prints, for each settled buyer-side trade:
 *   - the legacy formula's result (amount * price / 1e8 → expected
 *     to be tiny for inverse-collateral)
 *   - the indexer's Position.pnlUsd (expected to match basescan)
 *   - the matched Position.pnlEntries[].costUsd (true cost basis)
 *
 * Verdict: if Position.pnlUsd differs materially from the legacy
 * formula on any inverse-collateral trade, the legacy formula is
 * confirmed broken and callers must pass `positions` to
 * realizedPnlUsd(h, positions).
 */

import { readFileSync } from 'node:fs';
import { ThetanutsClient } from '@thetanuts-finance/thetanuts-client';
import { ethers } from 'ethers';

// .env.local loader (dotenv ignores .env.local by default)
try {
  const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const userAddress = process.argv[2];
if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
  console.error('Usage: node scripts/verify-pnl.mjs <userAddress>');
  process.exit(1);
}

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? 'https://base-mainnet.public.blastapi.io';
const client = new ThetanutsClient({
  chainId: 8453,
  provider: new ethers.JsonRpcProvider(RPC_URL),
});

const PRICE_DECIMALS = 8;

function legacyRealizedPnlUsd(h) {
  if (!h.settlement) return NaN;
  const dec = h.collateralDecimals || 6;
  const payout = Number(client.utils.formatAmount(h.settlement.payoutBuyer, dec, dec));
  const costBig = (h.amount * h.price) / 10n ** BigInt(PRICE_DECIMALS);
  const cost = Number(client.utils.formatAmount(costBig, dec, dec));
  return payout - cost;
}

function legacyCostBasisUsd(h) {
  const dec = h.collateralDecimals || 6;
  const costBig = (h.amount * h.price) / 10n ** BigInt(PRICE_DECIMALS);
  return Number(client.utils.formatAmount(costBig, dec, dec));
}

function fmtUsd(n) {
  if (!Number.isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 6,
    maximumFractionDigits: 6,
  })}`;
}

const [history, positions] = await Promise.all([
  client.api.getUserHistoryFromIndexer(userAddress),
  client.api.getUserPositionsFromIndexer(userAddress),
]);

const settles = history.filter(
  (h) =>
    (h.type === 'settle' || h.type === 'exercise') &&
    !!h.settlement &&
    h.buyer.toLowerCase() === userAddress.toLowerCase(),
);

console.log(
  `\nUser ${userAddress}: ${history.length} history rows, ${positions.length} positions, ${settles.length} buyer-side settles.\n`,
);

if (settles.length === 0) {
  console.log('No settled buyer-side trades to evaluate.');
  process.exit(0);
}

console.log('='.repeat(140));
console.log(
  'For each settled buyer-side trade, compare LEGACY formula vs INDEXER Position.pnlUsd.',
);
console.log('='.repeat(140));

const headers = [
  'txHash',
  'underlying',
  'strikes',
  'legacy cost',
  'legacy pnl',
  'indexer cost',
  'indexer pnl',
  'pnlUsd raw',
];
console.log(
  headers
    .map((h, i) => h.padEnd([14, 10, 22, 14, 14, 14, 14, 14][i]))
    .join('│ '),
);
console.log('─'.repeat(140));

for (const h of settles) {
  const legacyCost = legacyCostBasisUsd(h);
  const legacyPnl = legacyRealizedPnlUsd(h);

  // Match position by (optionAddress, buyer, side=buyer, settled)
  const optionAddr = h.option.address.toLowerCase();
  const buyer = h.buyer.toLowerCase();
  const matched = positions.find(
    (p) =>
      p.optionAddress.toLowerCase() === optionAddr &&
      p.buyer.toLowerCase() === buyer &&
      p.side === 'buyer' &&
      !!p.settlement,
  );

  let indexerPnl = NaN;
  let indexerCost = NaN;
  let pnlUsdRaw = 'n/a';
  if (matched) {
    pnlUsdRaw = matched.pnlUsd ?? 'null';
    // pnlUsd and costUsd are 8-decimal integer strings — divide by 1e8 to get USD.
    indexerPnl = matched.pnlUsd != null ? Number(matched.pnlUsd) / 1e8 : NaN;
    const buyerEntry = matched.pnlEntries?.find((e) => e.side === 'buyer');
    if (buyerEntry?.costUsd != null) {
      indexerCost = Number(buyerEntry.costUsd) / 1e8;
    } else if (matched.settlement && Number.isFinite(indexerPnl)) {
      const payout = Number(
        client.utils.fromUsdcDecimals(matched.settlement.payoutBuyer),
      );
      if (Number.isFinite(payout)) indexerCost = payout - indexerPnl;
    }
  }

  const strikes = h.strikes
    .map((s) => '$' + (Number(s) / 1e8).toLocaleString('en-US'))
    .join('/');

  console.log(
    [
      h.txHash.slice(0, 12).padEnd(14),
      h.option.underlying.padEnd(10),
      strikes.padEnd(22),
      fmtUsd(legacyCost).padEnd(14),
      fmtUsd(legacyPnl).padEnd(14),
      fmtUsd(indexerCost).padEnd(14),
      fmtUsd(indexerPnl).padEnd(14),
      String(pnlUsdRaw).slice(0, 14).padEnd(14),
    ].join('│ '),
  );
}

console.log('\n' + '='.repeat(140));
console.log('Interpretation:');
console.log(
  '  - If "legacy cost" is ~$0 and "indexer cost" is ~$1 (matching basescan), the legacy formula is broken for that trade.',
);
console.log(
  '  - The fix in src/lib/sdk/positionLogic.ts uses the indexer column when `positions` is passed to realizedPnlUsd(h, positions).',
);
console.log(
  '  - For the BTC $80k/$81k call-spread test case, expect: indexer cost ≈ $1.00, indexer pnl ≈ +$0.15, payout ≈ $1.153.',
);
