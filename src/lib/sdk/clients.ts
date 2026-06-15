'use client';

import { ThetanutsClient } from '@thetanuts-finance/thetanuts-client';
import { ethers } from 'ethers';
import { polynutsLogger } from './logger';

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

let _readClient: ThetanutsClient | null = null;

export function getReadClient(): ThetanutsClient {
  if (_readClient) return _readClient;
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  _readClient = new ThetanutsClient({
    chainId: CHAIN_ID as 8453,
    provider,
    referrer: REFERRER,
    apiBaseUrl: ORDERBOOK_PROXY_URL,
    logger: polynutsLogger,
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
    logger: polynutsLogger,
  });
}

export const REFERRER_ADDRESS = REFERRER;
export const POLYNUTS_CHAIN_ID = CHAIN_ID;
