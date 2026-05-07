import type {
  ChainConfig,
  OrderWithSignature,
  OptionImplementationInfo,
} from '@thetanuts-finance/thetanuts-client';
import { fromBigInt } from '@thetanuts-finance/thetanuts-client';

export type Direction = 'PUMP' | 'DUMP' | 'RANGE';

/**
 * Per-implementation product family used for pricing and UI framing.
 * - 'vanilla' has unbounded payoff vs. premium → no binary framing
 * - 'spread' / 'butterfly' / 'condor' / 'iron_condor' / 'ranger' have a
 *   bounded max payout per contract → can be framed as YES/NO odds
 */
export type ProductFamily =
  | 'vanilla'
  | 'spread'
  | 'butterfly'
  | 'condor'
  | 'iron_condor'
  | 'ranger';

export interface BinaryFraming {
  /** Max payout per contract in 8-decimal collateral units. */
  maxPayoutPerContract: bigint;
  /** Multiplier on a winning bet — payout / premium per contract. */
  multiplier: number;
  /** Implied YES probability (0..1). 1 / multiplier, clamped. */
  yesProbability: number;
}

export interface MarketView {
  id: string;
  order: OrderWithSignature;
  asset: 'ETH' | 'BTC' | string;
  direction: Direction;
  question: string;
  structureName: string;
  family: ProductFamily;
  /** strikes formatted as USD numbers (8-decimal converted) */
  strikes: number[];
  expiry: number;
  /** Premium per contract (8-decimal). Always set. */
  pricePerContract: bigint;
  /**
   * Binary framing — null for vanilla calls/puts where payoff is unbounded.
   * UI hides the odds bar / YES-NO pills when this is null.
   */
  binary: BinaryFraming | null;
  /** Max collateral usable for this order, in USDC units (6-decimal). */
  availableUsdc: bigint;
  /** Underlying implementation name (`PUT_SPREAD`, `RANGER`, …) for analytics. */
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

/**
 * Compute the max payout per contract in 8-decimal collateral units.
 * Returns null for vanilla — vanilla payoff is unbounded relative to premium.
 *
 * Spread:           strikeWidth (always positive)
 * Butterfly:        min(mid - low, high - mid) on ascending strikes
 * Condor / Ranger:  min(s[1]-s[0], s[3]-s[2]) on ascending strikes (wing widths)
 */
function computeMaxPayoutPerContract(
  family: ProductFamily,
  strikes: bigint[]
): bigint | null {
  if (family === 'vanilla') return null;
  const sorted = [...strikes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  if (family === 'spread') {
    if (sorted.length < 2) return null;
    return sorted[sorted.length - 1] - sorted[0];
  }
  if (family === 'butterfly') {
    if (sorted.length < 3) return null;
    const [low, mid, high] = sorted;
    const left = mid - low;
    const right = high - mid;
    return left < right ? left : right;
  }
  if (family === 'condor' || family === 'iron_condor' || family === 'ranger') {
    if (sorted.length < 4) return null;
    const lowerWing = sorted[1] - sorted[0];
    const upperWing = sorted[3] - sorted[2];
    return lowerWing < upperWing ? lowerWing : upperWing;
  }
  return null;
}

function computeBinaryFraming(
  family: ProductFamily,
  strikes: bigint[],
  pricePerContract: bigint
): BinaryFraming | null {
  if (family === 'vanilla') return null;
  if (pricePerContract === 0n) return null;
  const maxPayout = computeMaxPayoutPerContract(family, strikes);
  if (maxPayout == null || maxPayout <= 0n) return null;

  // Both maxPayout and pricePerContract are 8-decimal collateral units.
  const multiplier = Number(maxPayout) / Number(pricePerContract);
  if (!Number.isFinite(multiplier) || multiplier <= 1) return null;

  const yesProbability = Math.min(0.99, Math.max(0.01, 1 / multiplier));
  return { maxPayoutPerContract: maxPayout, multiplier, yesProbability };
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
  const expirySec = raw.orderExpiryTimestamp;
  const asset = getAssetFromPriceFeed(config, raw.priceFeed);
  const question = generateQuestion(asset, implInfo.name, strikes, expirySec);
  const structureName = getStructureLabel(implInfo.name);
  const family = familyFromImpl(implInfo.name);
  const binary = computeBinaryFraming(family, strikes, order.order.price);

  // Odette lists multiple orders sharing the same maker+nonce when the maker
  // re-signs the same option at different price/size tiers — observed live as
  // ~300 collisions in 355 orders. The order signature is unique by
  // construction, so use a short suffix of it for a guaranteed-unique id.
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
    strikes: strikes.map(strikeToUsd),
    expiry: expirySec,
    pricePerContract: order.order.price,
    binary,
    availableUsdc,
    implName: implInfo.name,
  };
}

export function fmtUsdc(amount: bigint): string {
  return fromBigInt(amount, 6);
}
