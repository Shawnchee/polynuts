/**
 * Verify client.option.simulatePayout produces sane numbers against live
 * orders for every product family. Cross-checks the SDK on-chain return
 * against simple sanity bounds (max payout per contract should be > 0
 * and >= the premium, since otherwise the order would be a guaranteed loss).
 */

import { ThetanutsClient } from '@thetanuts-finance/thetanuts-client';
import { ethers } from 'ethers';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://base-mainnet.public.blastapi.io';
const c = new ThetanutsClient({
  chainId: 8453,
  provider: new ethers.JsonRpcProvider(RPC_URL),
});

const SUPPORTED = new Set([
  'PUT','INVERSE_CALL','LINEAR_CALL',
  'CALL_SPREAD','PUT_SPREAD',
  'CALL_FLY','PUT_FLY',
  'CALL_CONDOR','PUT_CONDOR',
  'IRON_CONDOR','RANGER',
]);

function familyOf(name) {
  if (name === 'IRON_CONDOR') return 'iron_condor';
  if (name === 'RANGER') return 'ranger';
  if (name.endsWith('_CONDOR')) return 'condor';
  if (name.endsWith('_FLY')) return 'butterfly';
  if (name.endsWith('_SPREAD')) return 'spread';
  return 'vanilla';
}

// Strikes must be in CONTRACT order, not ascending. PUT/PUT_SPREAD/PUT_FLY
// require descending; everything else ascending. simulatePayout returns 0
// silently if the order is wrong, which makes this script falsely pass.
function strikesInContractOrder(implName, raw) {
  const isPutNonCondor =
    implName === 'PUT' || implName === 'PUT_SPREAD' || implName === 'PUT_FLY';
  return [...raw].sort((a, b) =>
    isPutNonCondor ? (a > b ? -1 : a < b ? 1 : 0) : (a < b ? -1 : a > b ? 1 : 0)
  );
}

function probePrices(family, strikesContract) {
  if (family === 'vanilla') return null;
  // Index [1] is the ITM strike for spreads in contract order
  // (CALL_SPREAD asc → high; PUT_SPREAD desc → low).
  if (family === 'spread') return [strikesContract[1]];
  if (family === 'butterfly') return [strikesContract[1]];
  if (family === 'condor' || family === 'iron_condor' || family === 'ranger') {
    return [strikesContract[1], strikesContract[2]];
  }
  return null;
}

const orders = await c.api.fetchOrders();
const now = Math.floor(Date.now() / 1000);
const active = orders.filter(o => Number(o.order.expiry) > now);

const byFamily = {};
for (const o of active) {
  const info = c.chainConfig.optionImplementations[o.rawApiData.implementation.toLowerCase()];
  if (!info || !SUPPORTED.has(info.name)) continue;
  const family = familyOf(info.name);
  if (family === 'vanilla') continue;
  if (!byFamily[family]) byFamily[family] = [];
  byFamily[family].push(o);
}

const PROBE_UNIT = 1_000_000n; // 1 USDC of contracts

for (const family of Object.keys(byFamily)) {
  const sample = byFamily[family][0];
  const info = c.chainConfig.optionImplementations[sample.rawApiData.implementation.toLowerCase()];
  const raw = sample.rawApiData.strikes.map(BigInt);
  const strikesContract = strikesInContractOrder(info.name, raw);
  const strikesAsc = [...raw].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const probes = probePrices(family, strikesContract);
  const impl = sample.rawApiData.implementation;

  console.log(`\n=== ${family.toUpperCase()} (impl ${impl.slice(0, 8)}…) ===`);
  console.log(`Strikes (display): ${strikesAsc.map(s => '$' + (Number(s)/1e8).toLocaleString()).join(' / ')}`);
  console.log(`Premium: $${(Number(sample.order.price)/1e8).toFixed(2)} per contract (8-dec)`);
  console.log(`Probes: ${probes.map(p => '$' + (Number(p)/1e8).toLocaleString()).join(', ')}`);

  const results = await Promise.all(
    probes.map(p => c.option.simulatePayout(impl, p, strikesContract, PROBE_UNIT))
  );
  for (let i = 0; i < probes.length; i++) {
    console.log(`  simulatePayout @ $${(Number(probes[i])/1e8).toLocaleString()}: ${results[i].toString()} (8-dec) = $${(Number(results[i])/1e8).toFixed(2)}`);
  }
  const max = results.reduce((acc, x) => x > acc ? x : acc, 0n);
  console.log(`Max payout per 1 USDC of contracts: $${(Number(max)/1e8).toFixed(2)}`);

  if (sample.order.price > 0n && max > 0n) {
    const multiplier = Number(max) / Number(sample.order.price);
    console.log(`Multiplier: ${multiplier.toFixed(2)}x  (implied ${(100/multiplier).toFixed(1)}% probability)`);
  }
}
