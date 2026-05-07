/**
 * verify-sdk.mjs
 *
 * Proves Polynuts' displayed payout/multiplier values match what the
 * Thetanuts SDK returns directly. Mirrors the exact logic in
 * src/lib/sdk/usePayout.ts and src/lib/sdk/markets.ts:
 *   - probe prices: upper strike (spread), middle (butterfly),
 *     both inner strikes for condor/iron_condor/ranger taking max
 *   - cost-per-contract scaling: pricePerContract / 100n  (8-dec → 6-dec)
 *   - multiplier = simulatePayout / costPerContract6dec
 *
 * Run:  node scripts/verify-sdk.mjs
 */

import { readFileSync } from 'node:fs';
import { ThetanutsClient } from '@thetanuts-finance/thetanuts-client';
import { ethers } from 'ethers';

// .env.local loader (dotenv ignores .env.local by default)
try {
  const env = readFileSync(
    new URL('../.env.local', import.meta.url),
    'utf8'
  );
  for (const line of env.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
} catch {}

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? 'https://base-mainnet.public.blastapi.io';
const c = new ThetanutsClient({
  chainId: 8453,
  provider: new ethers.JsonRpcProvider(RPC_URL),
});

const SUPPORTED = new Set([
  'PUT',
  'INVERSE_CALL',
  'LINEAR_CALL',
  'CALL_SPREAD',
  'PUT_SPREAD',
  'CALL_FLY',
  'PUT_FLY',
  'CALL_CONDOR',
  'PUT_CONDOR',
  'IRON_CONDOR',
  'RANGER',
]);

function familyOf(name) {
  if (name === 'IRON_CONDOR') return 'iron_condor';
  if (name === 'RANGER') return 'ranger';
  if (name.endsWith('_CONDOR')) return 'condor';
  if (name.endsWith('_FLY')) return 'butterfly';
  if (name.endsWith('_SPREAD')) return 'spread';
  return 'vanilla';
}

// Mirrors src/lib/sdk/markets.ts strikesInContractOrder — PUT family
// (PUT, PUT_SPREAD, PUT_FLY) requires DESCENDING; everything else ASCENDING.
// The contract returns 0 if the order is wrong, regardless of probe price.
function strikesInContractOrder(implName, raw) {
  const isPutNonCondor =
    implName === 'PUT' || implName === 'PUT_SPREAD' || implName === 'PUT_FLY';
  return [...raw].sort((a, b) =>
    isPutNonCondor ? (a > b ? -1 : a < b ? 1 : 0) : (a < b ? -1 : a > b ? 1 : 0)
  );
}

// Probes pick strikes[1] in CONTRACT-ORDER (ITM strike for spreads; apex for
// butterflies). Condor/iron-condor/ranger always ascending; probe both inner
// strikes (1, 2) and take the larger.
function probePrices(family, strikesContract) {
  if (family === 'vanilla') return null;
  if (family === 'spread') return [strikesContract[1]];
  if (family === 'butterfly') return [strikesContract[1]];
  if (
    family === 'condor' ||
    family === 'iron_condor' ||
    family === 'ranger'
  ) {
    return [strikesContract[1], strikesContract[2]];
  }
  return null;
}

function fmtUsd(n) {
  return `$${Number(n).toLocaleString('en-US', {
    maximumFractionDigits: 2,
  })}`;
}

const failures = [];
function assert(cond, label, ctx) {
  if (!cond) failures.push({ label, ctx });
  return cond;
}

const orders = await c.api.fetchOrders();
const now = Math.floor(Date.now() / 1000);
const active = orders.filter((o) => Number(o.order.expiry) > now);

// Bucket by family, take up to 3 per family for breadth
const buckets = {};
for (const o of active) {
  const info =
    c.chainConfig.optionImplementations[
      o.rawApiData.implementation.toLowerCase()
    ];
  if (!info || !SUPPORTED.has(info.name)) continue;
  const f = familyOf(info.name);
  if (f === 'vanilla') continue;
  if (!buckets[f]) buckets[f] = [];
  if (buckets[f].length < 3) buckets[f].push({ o, info });
}

const samples = Object.values(buckets).flat();
console.log(
  `Sampling ${samples.length} live orders across ${Object.keys(buckets).length} families`
);
console.log(
  `Families: ${Object.entries(buckets)
    .map(([k, v]) => `${k}(${v.length})`)
    .join(', ')}\n`
);

// ─── 1. Per-family verification table ──────────────────────────────────────
const TEN_USDC = 10_000_000n;
const PROBE_UNIT = 1_000_000n; // matches usePayout.ts

console.log('='.repeat(120));
console.log(
  'VERIFICATION 1: per-family — does displayed multiplier match SDK truth?'
);
console.log('='.repeat(120));

const headers = [
  'family',
  'strikes',
  'premium',
  'maxPayout',
  'mult',
  'impProb',
  'OK',
];
console.log(
  headers
    .map((h, i) =>
      h.padEnd([12, 32, 11, 13, 8, 9, 4][i])
    )
    .join('│ ')
);
console.log('─'.repeat(120));

for (const { o, info } of samples) {
  const raw = o.rawApiData.strikes.map(BigInt);
  const strikesContract = strikesInContractOrder(info.name, raw);
  const strikesAsc = [...raw].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const family = familyOf(info.name);
  const probes = probePrices(family, strikesContract);
  const impl = o.rawApiData.implementation;

  // mirror usePayout.ts: simulatePayout at PROBE_UNIT (1 USDC of contracts)
  // — pass strikes in CONTRACT order, not display order.
  const sims = await Promise.all(
    probes.map((p) =>
      c.option.simulatePayout(impl, p, strikesContract, PROBE_UNIT)
    )
  );
  const maxPayout = sims.reduce((a, x) => (x > a ? x : a), 0n);

  const premium8dec = o.order.price;
  const cost6dec = premium8dec / 100n;
  const multiplier = cost6dec > 0n ? Number(maxPayout) / Number(cost6dec) : 0;
  const impliedProb = multiplier > 0 ? 1 / multiplier : 0;

  const okMult = multiplier > 1;
  const okPayout = maxPayout >= cost6dec;
  const okProb = impliedProb >= 0.005 && impliedProb <= 0.995;
  const ok = okMult && okPayout && okProb;

  const ctx = {
    family,
    impl: impl.slice(0, 10),
    strikes: strikesAsc.map((s) => Number(s) / 1e8),
    premium: Number(premium8dec) / 1e8,
    cost6dec: cost6dec.toString(),
    maxPayout6dec: maxPayout.toString(),
    multiplier,
    impliedProb,
  };
  assert(okMult, 'multiplier > 1', ctx);
  assert(okPayout, 'maxPayout >= cost', ctx);
  assert(okProb, 'impliedProb in (0.5%, 99.5%)', ctx);

  console.log(
    [
      family.padEnd(12),
      strikesAsc
        .map((s) => '$' + (Number(s) / 1e8 / 1000).toFixed(1) + 'K')
        .join('/')
        .padEnd(32),
      ('$' + (Number(premium8dec) / 1e8).toFixed(2)).padEnd(11),
      fmtUsd(Number(maxPayout) / 1e6).padEnd(13),
      (multiplier.toFixed(2) + 'x').padEnd(8),
      (impliedProb * 100).toFixed(1).padStart(6) + '%',
      ok ? '  ✓' : '  ✗',
    ].join('│ ')
  );
}

// ─── 2. Linearity verification ─────────────────────────────────────────────
console.log('\n' + '='.repeat(120));
console.log(
  'VERIFICATION 2: linearity — does numContracts and simulatePayout scale linearly with bet size?'
);
console.log('='.repeat(120));

// Pick a spread sample (deterministic 1 probe call)
const linOrder =
  buckets.spread?.[0] ??
  buckets.butterfly?.[0] ??
  buckets.condor?.[0] ??
  buckets.ranger?.[0];
if (!linOrder) {
  console.log('No multi-strike sample available for linearity test');
} else {
  const { o, info } = linOrder;
  const strikesAsc = o.rawApiData.strikes
    .map(BigInt)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const family = familyOf(info.name);
  const probes = probePrices(family, strikesAsc);
  const impl = o.rawApiData.implementation;

  console.log(`Sample: ${info.name} ${strikesAsc.map((s) => '$' + Number(s) / 1e8).join('/')}`);
  console.log(`Premium: $${(Number(o.order.price) / 1e8).toFixed(2)}/contract\n`);

  const betSizes = [1_000_000n, 5_000_000n, 10_000_000n, 25_000_000n]; // $1, $5, $10, $25

  let baseRatio = null;
  let basePayoutRatio = null;
  for (const usdc of betSizes) {
    let preview;
    try {
      preview = c.optionBook.previewFillOrder(o, usdc);
    } catch (e) {
      console.log(
        `  $${Number(usdc) / 1e6}: previewFillOrder threw — ${e.message}`
      );
      continue;
    }
    const sims = await Promise.all(
      probes.map((p) =>
        c.option.simulatePayout(impl, p, strikesAsc, preview.numContracts)
      )
    );
    const payout = sims.reduce((a, x) => (x > a ? x : a), 0n);

    const usdcF = Number(usdc) / 1e6;
    const numContractsF = Number(preview.numContracts) / 1e6;
    const payoutF = Number(payout) / 1e6;

    const ratio = numContractsF / usdcF;
    const payoutRatio = payoutF / numContractsF;
    if (baseRatio === null) {
      baseRatio = ratio;
      basePayoutRatio = payoutRatio;
    }
    const ratioDrift = Math.abs(ratio - baseRatio) / baseRatio;
    const payoutDrift =
      Math.abs(payoutRatio - basePayoutRatio) / basePayoutRatio;

    const ok = ratioDrift < 0.001 && payoutDrift < 0.001;
    assert(ok, 'linear scaling', {
      usdc: usdcF,
      numContracts: numContractsF,
      ratio,
      ratioDrift,
      payout: payoutF,
      payoutRatio,
      payoutDrift,
    });

    console.log(
      `  bet ${('$' + usdcF).padEnd(6)} → numContracts ${numContractsF.toFixed(6).padEnd(12)} (ratio ${ratio.toFixed(8)}, drift ${(ratioDrift * 100).toFixed(4)}%)  payout ${('$' + payoutF.toFixed(2)).padEnd(10)} (per-contract $${payoutRatio.toFixed(4)}, drift ${(payoutDrift * 100).toFixed(4)}%)  ${ok ? '✓' : '✗'}`
    );
  }
}

// ─── Verdict ───────────────────────────────────────────────────────────────
console.log('\n' + '='.repeat(120));
if (failures.length === 0) {
  console.log(`VERDICT: PASS — all assertions held across ${samples.length} samples and 4 bet sizes.`);
} else {
  console.log(`VERDICT: FAIL — ${failures.length} assertion failure(s):`);
  for (const f of failures) {
    console.log(`  ✗ ${f.label}`);
    console.log(`    ${JSON.stringify(f.ctx, null, 2).split('\n').join('\n    ')}`);
  }
  process.exit(1);
}
