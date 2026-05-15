/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
