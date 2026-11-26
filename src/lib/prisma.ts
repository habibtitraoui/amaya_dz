import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

/**
 * Single Prisma client for the Node.js server runtime.
 * Prisma 7 uses the WASM query compiler plus the node-postgres driver adapter,
 * which works against both a managed PostgreSQL and the embedded PGlite server
 * used for local development / previews.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  const connectionString =
    process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/amaya';
  const adapter = new PrismaPg({
    connectionString,
    max: Number(process.env.PG_POOL_MAX ?? 8),
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
