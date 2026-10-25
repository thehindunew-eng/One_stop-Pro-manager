/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['@electric-sql/pglite'],
  },
  /**
   * The room can be opened with a signed token in the URL (?k=) when cookies are
   * blocked. We strip it from the address bar on load, and these headers stop it
   * travelling any further: no referrer to third parties, no MIME sniffing, and
   * no camera/geolocation access we never ask for.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ];
  },
};

export default nextConfig;
