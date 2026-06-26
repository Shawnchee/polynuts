'use client';

import { ThetanutsClient, type KeyStorageProvider } from '@thetanuts-finance/thetanuts-client';
import { ethers } from 'ethers';
import { polynutsLogger } from './logger';

/**
 * Polynuts is taker-only and never exercises the SDK's RFQ flow, but the
 * ThetanutsClient constructor eagerly builds an RFQKeyManagerModule. With no
 * provider configured it falls back to LocalStorageProvider, which fires a
 * one-time console.warn about storing RFQ keys in plaintext localStorage
 * (TNU-AUDIT-0063). We never store keys — the user's wallet key stays in their
 * wallet extension and never touches our code — so we hand the SDK a
 * self-contained in-memory provider. Nothing is ever persisted, and because it
 * is not an instance of the SDK's own MemoryStorageProvider it also avoids that
 * class's "keys will be lost" warning. Net effect: zero key-storage noise.
 */
class EphemeralKeyStorage implements KeyStorageProvider {
  private mem = new Map<string, string>();
  get(keyId: string) {
    return this.mem.get(keyId) ?? null;
  }
  set(keyId: string, privateKey: string) {
    this.mem.set(keyId, privateKey);
  }
  remove(keyId: string) {
    this.mem.delete(keyId);
  }
  has(keyId: string) {
    return this.mem.has(keyId);
  }
}

const KEY_STORAGE = new EphemeralKeyStorage();

const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 8453);
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? 'https://base-mainnet.public.blastapi.io';
const REFERRER = process.env.NEXT_PUBLIC_REFERRER_ADDRESS;

// Route the SDK's order-book reads (client.api.fetchOrders / getMarketData)
// through our own same-origin proxy instead of the MM worker directly. The
// worker CORS-allowlists only specific origins, so a direct browser fetch is
// blocked on our deployed domains; the proxy makes it a same-origin request.
// Relative on purpose — resolves against whatever origin serves the app
// (localhost, *.vercel.app, polynuts.xyz) with zero per-domain config. These
// clients are browser-only ('use client'), so the relative URL is only ever
// resolved in the browser.
// See src/app/api/orderbook/[[...path]]/route.ts.
const ORDERBOOK_PROXY_URL = '/api/orderbook';

// The indexer (user positions/history + protocol/daily stats) is CORS-
// allowlisted exactly like the worker and is ALSO read from the browser, so it
// needs the same same-origin proxy — otherwise these reads break on every
// deployed domain (they only work in local dev because the indexer allowlists
// localhost). Unlike ORDERBOOK_PROXY_URL these must be ABSOLUTE: the SDK shares
// one axios instance with `baseURL: apiBaseUrl` (the order-book proxy), and it
// only ignores that baseURL for absolute request URLs — a relative indexer path
// would get mangled into /api/orderbook/api/indexer/... Browser-only
// ('use client'), so window.location.origin is defined when a client is built.
// See src/app/api/indexer/[[...path]]/route.ts.
const ORIGIN = typeof window !== 'undefined' ? window.location.origin : '';
// stateApiUrl backs *FromRfq + book-stats reads; indexerApiUrl backs the
// /api/v1/book user positions/history reads. Both upstream to the same indexer
// host, so a single proxy at /api/indexer forwards either path prefix.
const INDEXER_STATE_PROXY_URL = `${ORIGIN}/api/indexer`;
const INDEXER_BOOK_PROXY_URL = `${ORIGIN}/api/indexer/api/v1/book`;

const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
const REFERRER_MISSING = !REFERRER || REFERRER.toLowerCase() === ZERO_ADDR;

if (REFERRER_MISSING) {
  if (process.env.NODE_ENV === 'production') {
    // Real-money production build with no referrer wallet — every fill would
    // route referrer fees to the zero address and burn them. Fail the build
    // loudly (this runs at `next build` time) instead of shipping a deploy
    // that silently leaks fees forever.
    throw new Error(
      '[polynuts] NEXT_PUBLIC_REFERRER_ADDRESS is missing or set to the zero address in a production build. ' +
        'Referrer fees would be burned. Set it to your fee-earning address (e.g. a Gnosis Safe / multisig) ' +
        'in your deploy platform env (e.g. Vercel) and rebuild.'
    );
  }

  if (typeof window !== 'undefined') {
    // Non-production: dev must still run with no referrer. Warn once at module
    // init so it's visible during a smoke test. Browser-only so SSR isn't noisy.
    console.warn(
      '[polynuts] NEXT_PUBLIC_REFERRER_ADDRESS not set (or zero) — all referrer fees will be burned. Set this to your Gnosis Safe / multisig before launch.'
    );
  }
}

// ── Partner fee broker (opt-in) ─────────────────────────────────────────────
// When NEXT_PUBLIC_PARTNER_BROKER_ADDRESS points at a deployed PartnerFeeBroker,
// fills route THROUGH that broker (tx sent to the broker, broker approved for
// premium + fee) instead of straight to OptionBook, so the broker skims its
// immutable feeBps and forwards the position to the taker. Left unset (or zero)
// the app keeps the default OptionBook path — taker pays premium only, no added
// fee. Deliberate opt-in: production stays no-taker-fee unless this is set.
const PARTNER_BROKER = process.env.NEXT_PUBLIC_PARTNER_BROKER_ADDRESS;
export const PARTNER_BROKER_ADDRESS =
  PARTNER_BROKER && PARTNER_BROKER.toLowerCase() !== ZERO_ADDR ? PARTNER_BROKER : null;

let _readClient: ThetanutsClient | null = null;

export function getReadClient(): ThetanutsClient {
  if (_readClient) return _readClient;
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  _readClient = new ThetanutsClient({
    chainId: CHAIN_ID as 8453,
    provider,
    referrer: REFERRER,
    apiBaseUrl: ORDERBOOK_PROXY_URL,
    stateApiUrl: INDEXER_STATE_PROXY_URL,
    indexerApiUrl: INDEXER_BOOK_PROXY_URL,
    logger: polynutsLogger,
    keyStorageProvider: KEY_STORAGE,
  });
  return _readClient;
}

export function createSignerClient(signer: ethers.Signer): ThetanutsClient {
  return new ThetanutsClient({
    chainId: CHAIN_ID as 8453,
    provider: signer.provider!,
    signer,
    referrer: REFERRER,
    apiBaseUrl: ORDERBOOK_PROXY_URL,
    stateApiUrl: INDEXER_STATE_PROXY_URL,
    indexerApiUrl: INDEXER_BOOK_PROXY_URL,
    logger: polynutsLogger,
    keyStorageProvider: KEY_STORAGE,
  });
}

export const REFERRER_ADDRESS = REFERRER;
export const POLYNUTS_CHAIN_ID = CHAIN_ID;
