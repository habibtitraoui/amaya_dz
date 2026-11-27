import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Standalone output keeps the production bundle small and self-contained.
  output: 'standalone',
  serverExternalPackages: ['pg', '@prisma/adapter-pg', 'pdfkit', '@electric-sql/pglite'],
  experimental: {
    // The embedded demo database must initialise before the first request.
    serverActions: { bodySizeLimit: '6mb' },
  },
  images: {
    remotePatterns: [
      // Object Storage URLs (Neon serves them over HTTPS).
      { protocol: 'https', hostname: '**' },
      // Local development against a mock S3 on loopback.
      { protocol: 'http', hostname: '127.0.0.1' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
};

export default nextConfig;
