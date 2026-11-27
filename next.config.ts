import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Default (non-standalone) output: `next build` + `next start` is the
  // supported production path, and Vercel's Next.js runtime expects it.
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
