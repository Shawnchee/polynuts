// Derive the configured RPC origin so the CSP can allow the browser read
// client + wagmi public client to reach it. Falls back to the public Base RPC.
const rpcOrigin = (() => {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_RPC_URL ?? 'https://base-mainnet.public.blastapi.io',
    ).origin;
  } catch {
    return 'https://base-mainnet.public.blastapi.io';
  }
})();

// Content-Security-Policy. Shipped REPORT-ONLY first: the browser reports what
// WOULD be blocked (console + report endpoint) without breaking anything, so we
// can promote to an enforcing `Content-Security-Policy` once the deployed site
// shows zero reports. connect-src is the high-value directive (an injected
// script can't exfiltrate if it can't reach an attacker host) — the order book
// and indexer are same-origin proxies now, so 'self' covers them; the only
// real outbound calls are the RPC, Supabase, Deribit (live price feed) and the
// wallet relays (WalletConnect / Coinbase). The TradingView spot chart is an
// iframe → frame-src. To ENFORCE: script-src still allows 'unsafe-inline'
// /'unsafe-eval' for Next's bootstrap + inline theme-boot script (layout.tsx)
// + wallet wasm — switch that to a per-request nonce via proxy.ts before
// flipping to enforcing. Even as-is it already blocks loading external scripts.
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https:`,
  `font-src 'self' data:`,
  `connect-src 'self' ${rpcOrigin} https://www.deribit.com wss://www.deribit.com https://*.supabase.co wss://*.supabase.co https://*.walletconnect.com https://*.walletconnect.org wss://relay.walletconnect.com wss://relay.walletconnect.org https://explorer-api.walletconnect.com https://pulse.walletconnect.org https://api.web3modal.org https://*.coinbase.com`,
  `frame-src 'self' https://s.tradingview.com https://www.tradingview.com https://verify.walletconnect.com https://verify.walletconnect.org https://*.coinbase.com`,
  `worker-src 'self' blob:`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `object-src 'none'`,
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The Thetanuts SDK's axios client joins its baseURL with "/" for the
  // order-book root call, so it requests `/api/orderbook/` (trailing slash).
  // With the default trailing-slash redirect, that 308s to `/api/orderbook` on
  // every poll (prices ~5s, orders ~30s) — an uncached extra round-trip on the
  // hot path. Skipping the redirect lets the proxy serve the trailing form
  // directly. This app's canonical URLs are explicit (sitemap/OG use
  // non-trailing polynuts.xyz paths), so serving both forms is harmless here.
  skipTrailingSlashRedirect: true,
  // Baseline security headers for a real-money app. frame-ancestors 'none'
  // blocks clickjacking of the bet button; nosniff prevents MIME confusion
  // attacks on the OG/win-card route; Referrer-Policy avoids leaking the
  // user's market URL (which can contain a wallet hint in V2) to outbound
  // share-card unfurlers.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // Report-only for now — see the `csp` comment above for the path to enforcing.
          { key: 'Content-Security-Policy-Report-Only', value: csp },
        ],
      },
    ];
  },
  webpack: (config, { isServer }) => {
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    // The MetaMask SDK pulls in @react-native-async-storage/async-storage as
    // a soft dependency for React Native; alias to false so webpack stubs it
    // out rather than inlining the (non-identifier) package name into the bundle.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
    };
    if (!isServer) {
      // Thetanuts SDK uses dynamic imports of node:fs for optional file-based
      // RFQ key storage; we only need in-browser ECDH so stub these out.
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        'fs/promises': false,
        path: false,
        crypto: false,
        stream: false,
      };
    }
    return config;
  },
};

export default nextConfig;
