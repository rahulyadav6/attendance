/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Only mongoose needs server-side external bundling.
    // face-api.js is client-only (dynamic import inside "use client"), so DO NOT list it here.
    serverComponentsExternalPackages: ["mongoose"],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Stub Node.js built-ins so client-side bundles (including face-api.js) don't break.
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        stream: false,
        buffer: false,
        http: false,
        https: false,
        zlib: false,
        net: false,
        tls: false,
        child_process: false,
        os: false,
      };
    }

    // Stub canvas for environments where it's not available (browser).
    config.externals = [...(config.externals || []), { canvas: "canvas" }];
    return config;
  },
};

module.exports = nextConfig;
