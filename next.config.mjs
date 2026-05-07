/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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
