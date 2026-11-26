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
      { protocol: 'https', hostname: '**' },
    ],
  },
};

export default nextConfig;
