import { ThetanutsClient } from '@thetanuts-finance/thetanuts-client';
import { ethers } from 'ethers';

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://base-mainnet.public.blastapi.io';
const client = new ThetanutsClient({
  chainId: 8453,
  provider: new ethers.JsonRpcProvider(RPC_URL),
});

const SUPPORTED = new Set([
  'PUT', 'INVERSE_CALL', 'LINEAR_CALL',
  'CALL_SPREAD', 'PUT_SPREAD',
  'CALL_FLY', 'PUT_FLY',
  'CALL_CONDOR', 'PUT_CONDOR',
  'IRON_CONDOR', 'RANGER',
]);
const RANGE = new Set(['IRON_CONDOR', 'RANGER']);
const PUMP = new Set(['INVERSE_CALL', 'LINEAR_CALL', 'CALL_SPREAD', 'CALL_FLY', 'CALL_CONDOR']);
const DUMP = new Set(['PUT', 'PUT_SPREAD', 'PUT_FLY', 'PUT_CONDOR']);

function familyOf(name) {
  if (name === 'IRON_CONDOR') return 'iron_condor';
  if (name === 'RANGER') return 'ranger';
  if (name.endsWith('_CONDOR')) return 'condor';
  if (name.endsWith('_FLY')) return 'butterfly';
  if (name.endsWith('_SPREAD')) return 'spread';
  return 'vanilla';
}

function maxPayout(family, strikes) {
  if (family === 'vanilla') return null;
  const sorted = [...strikes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (family === 'spread') {
    return sorted[sorted.length - 1] - sorted[0];
  }
  if (family === 'butterfly') {
    if (sorted.length < 3) return null;
    const [low, mid, high] = sorted;
    const left = mid - low;
    const right = high - mid;
    return left < right ? left : right;
  }
  if (sorted.length < 4) return null;
  const lower = sorted[1] - sorted[0];
  const upper = sorted[3] - sorted[2];
  return lower < upper ? lower : upper;
}

const orders = await client.api.fetchOrders();
const now = Math.floor(Date.now() / 1000);
const active = orders.filter((o) => Number(o.order.expiry) > now);
const config = client.chainConfig;

const buckets = { PUMP: 0, DUMP: 0, RANGE: 0 };
const byImpl = {};
const sampleByDir = { PUMP: null, DUMP: null, RANGE: null };

for (const o of active) {
  const raw = o.rawApiData;
  if (!raw) continue;
  const info = config.optionImplementations[raw.implementation.toLowerCase()];
  if (!info) continue;
  if (!SUPPORTED.has(info.name)) continue;

  const dir = RANGE.has(info.name) ? 'RANGE' : PUMP.has(info.name) ? 'PUMP' : DUMP.has(info.name) ? 'DUMP' : null;
  if (!dir) continue;
  buckets[dir]++;
  byImpl[info.name] = (byImpl[info.name] || 0) + 1;

  if (!sampleByDir[dir]) {
    const strikes = raw.strikes.map((s) => BigInt(s));
    const family = familyOf(info.name);
    const mp = maxPayout(family, strikes);
    const mult = mp != null && o.order.price > 0n ? Number(mp) / Number(o.order.price) : null;
    sampleByDir[dir] = {
      impl: info.name,
      family,
      strikes: strikes.map((s) => `$${(Number(s) / 1e8).toLocaleString()}`),
      premium: `${(Number(o.order.price) / 1e8).toFixed(2)}`,
      maxPayoutPerContract: mp != null ? `${(Number(mp) / 1e8).toFixed(2)}` : null,
      multiplier: mult ? mult.toFixed(2) : null,
      yesProbability: mult ? (1 / mult).toFixed(3) : null,
    };
  }
}

console.log(`Active supported markets: ${buckets.PUMP + buckets.DUMP + buckets.RANGE}`);
console.log('Direction buckets:', buckets);
console.log('By implementation:', byImpl);
console.log('---Sample of each direction---');
for (const dir of ['PUMP', 'DUMP', 'RANGE']) {
  console.log(`${dir}:`, sampleByDir[dir]);
}
