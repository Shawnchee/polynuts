import type {
  ChainConfig,
  OrderWithSignature,
  OptionImplementationInfo,
} from '@thetanuts-finance/thetanuts-client';
import { fromBigInt } from '@thetanuts-finance/thetanuts-client';

export type Direction = 'PUMP' | 'DUMP' | 'RANGE';

export interface MarketView {
  /** unique key (maker + nonce) */
  id: string;
  order: OrderWithSignature;
  asset: 'ETH' | 'BTC' | string;
  direction: Direction;
  question: string;
  structureName: string;
  /** strikes formatted as USD numbers (8-decimal converted) */
  strikes: number[];
  expiry: number;
  /** human-readable price per contract in collateral units */
  pricePerContract: bigint;
  /** payout multiplier on a winning bet, derived from price (8 dec) */
  multiplier: number;
  /** implied YES probability (0..1) */
  yesProbability: number;
  /** max collateral usable */
  availableUsdc: bigint;
}

/** Cash-settled implementation types we surface as Polynuts markets.
 *  Physical-settled and RFQ-only types are excluded — they aren't fillable
 *  via OptionBook.fillOrder and would only lead to confused users. */
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
const RANGE_IMPL_NAMES = new Set(['IRON_CONDOR']);

export function getDirectionFromImpl(implName: string): Direction {
  if (CALL_IMPL_NAMES.has(implName)) return 'PUMP';
  if (PUT_IMPL_NAMES.has(implName)) return 'DUMP';
  if (RANGE_IMPL_NAMES.has(implName)) return 'RANGE';
  return 'RANGE';
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
  // ETH/USD → ETH · BTC/USD → BTC · already-clean symbols pass through
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
  const dir = getDirectionFromImpl(implName);

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
    const mid = strikes[Math.floor(strikes.length / 2)];
    return `Will ${asset} land near ${fmtStrike(mid)} by ${time}?`;
  }
  if (
    implName === 'CALL_CONDOR' ||
    implName === 'PUT_CONDOR' ||
    implName === 'IRON_CONDOR' ||
    implName === 'RANGER'
  ) {
    if (strikes.length >= 4) {
      const low = fmtStrike(strikes[1]);
      const high = fmtStrike(strikes[2]);
      return `Will ${asset} stay between ${low}–${high} by ${time}?`;
    }
  }

  if (dir === 'PUMP') return `Will ${asset} pump by ${time}?`;
  if (dir === 'DUMP') return `Will ${asset} dump by ${time}?`;
  return `Will ${asset} stay in range by ${time}?`;
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
 * For "binary" framing: payout multiplier ≈ maxSpread / pricePerContract
 * (caller pays `price` USDC per contract, can win up to maxSpread USDC.)
 *
 * For vanilla call/put we use the strike or 1e18 reference — since these
 * orders trade in non-binary fashion, we surface multiplier as a hint only.
 */
function computeMultiplier(
  implName: string,
  strikes: bigint[],
  pricePerContract: bigint
): number {
  if (pricePerContract === 0n) return 0;

  // For spreads/condors maxPayout = widest spread (in 8 decimals)
  if (implName === 'CALL_SPREAD' || implName === 'PUT_SPREAD') {
    if (strikes.length < 2) return 0;
    const spread = strikes[0] > strikes[1] ? strikes[0] - strikes[1] : strikes[1] - strikes[0];
    return Number(spread) / Number(pricePerContract);
  }
  if (
    implName === 'CALL_CONDOR' ||
    implName === 'PUT_CONDOR' ||
    implName === 'IRON_CONDOR' ||
    implName === 'CALL_FLY' ||
    implName === 'PUT_FLY'
  ) {
    if (strikes.length < 2) return 0;
    const sorted = [...strikes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const span = sorted[sorted.length - 1] - sorted[0];
    const half = span / 2n;
    return Number(half) / Number(pricePerContract);
  }
  // Vanilla — multiplier loosely = strike / price
  if (strikes.length > 0) {
    return Number(strikes[0]) / Number(pricePerContract);
  }
  return 0;
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

  const strikes = (raw.strikes ?? []).map((s) => BigInt(s));
  const expirySec = raw.orderExpiryTimestamp;
  const asset = getAssetFromPriceFeed(config, raw.priceFeed);
  const direction = getDirectionFromImpl(implInfo.name);
  const question = generateQuestion(asset, implInfo.name, strikes, expirySec);
  const structureName = getStructureLabel(implInfo.name);
  const multiplier = computeMultiplier(implInfo.name, strikes, order.order.price);
  // implied probability that YES pays out, capped 0..0.99
  const yesProbability = multiplier > 0 ? Math.min(0.99, Math.max(0.01, 1 / multiplier)) : 0.5;

  const id = `${order.order.maker}-${order.order.nonce.toString()}`;

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
    strikes: strikes.map(strikeToUsd),
    expiry: expirySec,
    pricePerContract: order.order.price,
    multiplier,
    yesProbability,
    availableUsdc,
  };
}

export function fmtUsdc(amount: bigint): string {
  return fromBigInt(amount, 6);
}
