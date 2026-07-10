/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: { unoptimized: true },
  webpack: (config, { isServer }) => {
    // node-fetch (used by the openai SDK on the server) optionally imports
    // 'encoding'; it's not needed and not installed, so silence the warning.
    if (isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        encoding: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
