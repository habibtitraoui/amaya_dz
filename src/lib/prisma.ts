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
    // Stay comfortably below the embedded server's connection ceiling so a
    // burst (dashboard + reports + cron) never gets a socket refused.
    max: Number(process.env.PG_POOL_MAX ?? 5),
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
  return new PrismaClient({ adapter });
}

/**
 * Transient connection failures are retried once. The embedded development
 * database can drop a socket under load; a second attempt on a fresh pooled
 * connection almost always succeeds, and a real outage still surfaces.
 */
function withRetry(client: PrismaClient): PrismaClient {
  const RETRYABLE = new Set(['P1017', 'P1001', 'P1011', 'P2024']);
  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (error) {
          const code = (error as { code?: string }).code;
          if (!code || !RETRYABLE.has(code)) throw error;
          await new Promise((resolve) => setTimeout(resolve, 150));
          return query(args);
        }
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? withRetry(createClient());

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
