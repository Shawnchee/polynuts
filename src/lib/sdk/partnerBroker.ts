import { Contract, type Provider } from 'ethers';
import { PARTNER_BROKER_ADDRESS } from './clients';

// Minimal read ABI — the broker exposes its immutable fee rate.
const BROKER_ABI = ['function feeBps() view returns (uint256)'];

// feeBps is immutable per broker, so read it once and cache for the session.
let _feeBps: bigint | null = null;

/**
 * Read the configured PartnerFeeBroker's fee rate (bps). Cached after the first
 * call since the value is immutable. Throws if no broker is configured.
 */
export async function getPartnerBrokerFeeBps(provider: Provider): Promise<bigint> {
  if (!PARTNER_BROKER_ADDRESS) {
    throw new Error('partner broker not configured');
  }
  if (_feeBps != null) return _feeBps;
  const broker = new Contract(PARTNER_BROKER_ADDRESS, BROKER_ABI, provider);
  _feeBps = (await broker.feeBps()) as bigint;
  return _feeBps;
}

/**
 * Compute the partner fee the broker will charge on a fill, in 6-dec USDC.
 *
 * MUST match the broker's on-chain math exactly — the two-step truncation
 * (spend → numContracts → re-derived premium → feeBps of it) from the Thetanuts
 * /partner integration guide. An under-estimate makes the fill revert on
 * insufficient allowance; an over-estimate just over-approves the broker.
 *
 * @param usdcAmount what the taker spends (6-dec USDC)
 * @param price      order price, 8-dec (order.order.price)
 * @param feeBps     the broker's fee rate
 */
export function computePartnerFee(usdcAmount: bigint, price: bigint, feeBps: bigint): bigint {
  if (price <= 0n || feeBps <= 0n) return 0n;
  const PRICE_DECIMALS = 10n ** 8n;
  const numContracts = (usdcAmount * PRICE_DECIMALS) / price;
  const premium = (price * numContracts) / PRICE_DECIMALS;
  return (premium * feeBps) / 10_000n;
}

/** Test-only: reset the cached feeBps for deterministic assertions. */
export function _resetPartnerBrokerCache(): void {
  _feeBps = null;
}
