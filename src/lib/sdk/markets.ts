import type {
  ChainConfig,
  OrderWithSignature,
  OptionImplementationInfo,
} from '@thetanuts-finance/thetanuts-client';
import { fromBigInt } from '@thetanuts-finance/thetanuts-client';

export type Direction = 'PUMP' | 'DUMP' | 'RANGE';

/**
 * Per-implementation product family used for pricing and UI framing.
 *
 * Note: `client.utils.getProductType(order)` only returns four strings —
 * `'vanilla' | 'spread' | 'butterfly' | 'condor'` (utils.ts:752–773 in the
 * SDK source) — so it folds RANGER and IRON_CONDOR under 'condor'. We need
 * to distinguish them to (a) frame range markets correctly and (b) probe
 * the right strikes when calling `client.option.simulatePayout`. The impl
 * names themselves come from `chainConfig.optionImplementations[addr].name`,
 * which IS sourced from the SDK chain registry — so this is "from the SDK"
 * in the only sense available.
 */
export type ProductFamily =
  | 'vanilla'
  | 'spread'
  | 'butterfly'
  | 'condor'
  | 'iron_condor'
  | 'ranger';

export interface MarketView {
  id: string;
  order: OrderWithSignature;
  asset: 'ETH' | 'BTC' | string;
  direction: Direction;
  question: string;
  structureName: string;
  family: ProductFamily;
  /** strikes formatted as USD numbers (8-decimal converted) — display only */
  strikes: number[];
  /** strikes as bigints in 8-dec on-chain format, ascending — used by SDK calls */
  strikesAsc: bigint[];
  /** Implementation contract address — feed into client.option.simulatePayout */
  implementation: string;
  expiry: number;
  /** Premium per contract (8-decimal). Comes directly from order.order.price. */
  pricePerContract: bigint;
  /** Max collateral usable for this order, in USDC units (6-decimal). */
  availableUsdc: bigint;
  /** Underlying SDK implementation name — analytics + debug */
  implName: string;
}

export const SUPPORTED_IMPLS = new Set([
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

const CALL_IMPL_NAMES = new Set([
  'INVERSE_CALL',
  'LINEAR_CALL',
  'CALL_SPREAD',
  'CALL_FLY',
  'CALL_CONDOR',
]);
const PUT_IMPL_NAMES = new Set([
  'PUT',
  'PUT_SPREAD',
  'PUT_FLY',
  'PUT_CONDOR',
]);
const RANGE_IMPL_NAMES = new Set(['IRON_CONDOR', 'RANGER']);

/**
 * The SDK has no helper that returns 'PUMP' / 'DUMP' / 'RANGE' from an order
 * (audited — `client.utils.isCall` / `isPut` only classify call vs put, not
 * spread direction or range). This impl-name lookup is the canonical
 * Polynuts-side mapping.
 */
export function getDirectionFromImpl(implName: string): Direction | null {
  if (CALL_IMPL_NAMES.has(implName)) return 'PUMP';
  if (PUT_IMPL_NAMES.has(implName)) return 'DUMP';
  if (RANGE_IMPL_NAMES.has(implName)) return 'RANGE';
  return null;
}

function familyFromImpl(implName: string): ProductFamily {
  if (implName === 'IRON_CONDOR') return 'iron_condor';
  if (implName === 'RANGER') return 'ranger';
  if (implName.endsWith('_CONDOR')) return 'condor';
  if (implName.endsWith('_FLY')) return 'butterfly';
  if (implName.endsWith('_SPREAD')) return 'spread';
  return 'vanilla';
}

/**
 * Settlement prices to probe through `client.option.simulatePayout` to find
 * the maximum payout per contract. Each family pays out maximally at known
 * structural points:
 *   - spread:    payout caps at the upper strike
 *   - butterfly: peak at the middle strike
 *   - condor / iron_condor / ranger: peak in the inner-strike band — probe
 *     both inner strikes (strikes[1] and strikes[2] on ascending input) and
 *     take the larger.
 *
 * Returns null for vanilla — vanilla payoff is unbounded.
 */
export function getProbePrices(
  family: ProductFamily,
  strikesAsc: bigint[]
): bigint[] | null {
  if (family === 'vanilla') return null;
  if (family === 'spread') {
    if (strikesAsc.length < 2) return null;
    return [strikesAsc[strikesAsc.length - 1]];
  }
  if (family === 'butterfly') {
    if (strikesAsc.length < 3) return null;
    return [strikesAsc[1]];
  }
  if (family === 'condor' || family === 'iron_condor' || family === 'ranger') {
    if (strikesAsc.length < 4) return null;
    return [strikesAsc[1], strikesAsc[2]];
  }
  return null;
}

export function getAssetFromPriceFeed(
  config: ChainConfig,
  priceFeedAddr: string
): string {
  const target = priceFeedAddr.toLowerCase();
  for (const [symbol, addr] of Object.entries(config.priceFeeds)) {
    if (addr.toLowerCase() === target) return normalizeAsset(symbol);
  }
  return 'CRYPTO';
}

function normalizeAsset(symbol: string): string {
  return symbol.replace(/[\/_-]?USD$/i, '');
}

function strikeToUsd(strike: bigint): number {
  return Number(strike) / 1e8;
}

function fmtStrike(s: bigint): string {
  return `$${strikeToUsd(s).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function fmtExpiry(expirySec: number): string {
  const d = new Date(expirySec * 1000);
  const time = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  });
  const today = new Date();
  const same =
    d.getUTCDate() === today.getUTCDate() &&
    d.getUTCMonth() === today.getUTCMonth() &&
    d.getUTCFullYear() === today.getUTCFullYear();
  if (same) return `${time} UTC today`;
  const tomorrow = new Date(today.getTime() + 86400_000);
  const isTomorrow =
    d.getUTCDate() === tomorrow.getUTCDate() &&
    d.getUTCMonth() === tomorrow.getUTCMonth();
  if (isTomorrow) return `${time} UTC tomorrow`;
  return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} ${time} UTC`;
}

export function generateQuestion(
  asset: string,
  implName: string,
  strikes: bigint[],
  expirySec: number
): string {
  const time = fmtExpiry(expirySec);

  if (implName === 'INVERSE_CALL' || implName === 'LINEAR_CALL') {
    return `Will ${asset} close above ${fmtStrike(strikes[0])} by ${time}?`;
  }
  if (implName === 'PUT') {
    return `Will ${asset} drop below ${fmtStrike(strikes[0])} by ${time}?`;
  }
  if (implName === 'CALL_SPREAD') {
    return `Will ${asset} close above ${fmtStrike(strikes[0])} by ${time}?`;
  }
  if (implName === 'PUT_SPREAD') {
    return `Will ${asset} drop below ${fmtStrike(strikes[0])} by ${time}?`;
  }
  if (implName === 'CALL_FLY' || implName === 'PUT_FLY') {
    const sorted = [...strikes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const mid = sorted[Math.floor(sorted.length / 2)];
    return `Will ${asset} land near ${fmtStrike(mid)} by ${time}?`;
  }
  if (
    implName === 'CALL_CONDOR' ||
    implName === 'PUT_CONDOR' ||
    implName === 'IRON_CONDOR' ||
    implName === 'RANGER'
  ) {
    if (strikes.length >= 4) {
      const sorted = [...strikes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      const low = fmtStrike(sorted[1]);
      const high = fmtStrike(sorted[2]);
      return `Will ${asset} stay between ${low}–${high} by ${time}?`;
    }
  }
  return `${asset} bet — expires ${time}`;
}

export function getStructureLabel(implName: string): string {
  switch (implName) {
    case 'INVERSE_CALL':
    case 'LINEAR_CALL':
      return 'call';
    case 'PUT':
      return 'put';
    case 'CALL_SPREAD':
      return 'call spread';
    case 'PUT_SPREAD':
      return 'put spread';
    case 'CALL_FLY':
      return 'call fly';
    case 'PUT_FLY':
      return 'put fly';
    case 'CALL_CONDOR':
      return 'call condor';
    case 'PUT_CONDOR':
      return 'put condor';
    case 'IRON_CONDOR':
      return 'iron condor';
    case 'RANGER':
      return 'ranger';
    default:
      return implName.toLowerCase().replace(/_/g, ' ');
  }
}

export function buildMarketView(
  order: OrderWithSignature,
  config: ChainConfig
): MarketView | null {
  const raw = order.rawApiData;
  if (!raw) return null;
  const implInfo: OptionImplementationInfo | undefined =
    config.optionImplementations[raw.implementation.toLowerCase()];
  if (!implInfo) return null;
  if (!SUPPORTED_IMPLS.has(implInfo.name)) return null;

  const direction = getDirectionFromImpl(implInfo.name);
  if (direction == null) return null;

  const strikes = (raw.strikes ?? []).map((s) => BigInt(s));
  const strikesAsc = [...strikes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const expirySec = raw.orderExpiryTimestamp;
  const asset = getAssetFromPriceFeed(config, raw.priceFeed);
  const question = generateQuestion(asset, implInfo.name, strikesAsc, expirySec);
  const structureName = getStructureLabel(implInfo.name);
  const family = familyFromImpl(implInfo.name);

  const sigSuffix = order.signature.slice(-12);
  const id = `${order.order.maker}-${order.order.nonce.toString()}-${sigSuffix}`;

  let availableUsdc = 0n;
  try {
    availableUsdc = BigInt(raw.maxCollateralUsable);
  } catch {
    availableUsdc = order.availableAmount;
  }

  return {
    id,
    order,
    asset,
    direction,
    question,
    structureName,
    family,
    strikes: strikesAsc.map(strikeToUsd),
    strikesAsc,
    implementation: raw.implementation,
    expiry: expirySec,
    pricePerContract: order.order.price,
    availableUsdc,
    implName: implInfo.name,
  };
}

export function fmtUsdc(amount: bigint): string {
  return fromBigInt(amount, 6);
}
