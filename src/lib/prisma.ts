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
    // Fail fast on a dead socket instead of hanging for the driver default.
    connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS ?? 5_000),
    idleTimeoutMillis: 30_000,
    // Detect a peer that vanished silently (sandbox suspend, container pause).
    keepAlive: true,
  });
  return new PrismaClient({ adapter });
}

/**
 * Transient connection failures are retried once. The embedded development
 * database can drop a socket under load; a second attempt on a fresh pooled
 * connection almost always succeeds, and a real outage still surfaces.
 */
function withRetry(client: PrismaClient): PrismaClient {
  const RETRYABLE_CODES = new Set(['P1017', 'P1001', 'P1011', 'P2024']);
  // A dropped or timed-out connection surfaces from the pg driver *without* a
  // Prisma error code (e.g. "Connection terminated unexpectedly", "timeout
  // exceeded when trying to connect"), so match the message as well. Both mean
  // the socket died before the query ran, which makes a retry safe.
  const RETRYABLE_MESSAGES = [
    'connection terminated',
    'connection closed',
    'timeout exceeded when trying to connect',
    'server has closed the connection',
    'econnreset',
    'socket hang up',
  ];
  const isTransient = (error: unknown) => {
    const code = (error as { code?: string } | null)?.code;
    if (code && RETRYABLE_CODES.has(code)) return true;
    if (code && /^(P10|P2)\d\d$/.test(code) && code !== 'P2002') return true;
    const message = String((error as { message?: string } | null)?.message ?? '').toLowerCase();
    return RETRYABLE_MESSAGES.some((needle) => message.includes(needle));
  };

  return client.$extends({
    query: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (error) {
          if (!isTransient(error)) throw error;
          await new Promise((resolve) => setTimeout(resolve, 150));
          return query(args);
        }
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma = globalForPrisma.prisma ?? withRetry(createClient());

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
