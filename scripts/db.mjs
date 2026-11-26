// Embedded PostgreSQL (PGlite) server for local development & previews.
//
// PGlite is real PostgreSQL compiled to WebAssembly. This script exposes it
// over the wire protocol so the application (and Prisma through node-postgres)
// can talk to it exactly like a real Postgres server. Data lives in .pgdata/.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import net from 'node:net';
import http from 'node:http';
import path from 'node:path';

const PORT = Number(process.env.PGLITE_PORT ?? 5432);
const HOST = process.env.PGLITE_HOST ?? '127.0.0.1';
const DATA_DIR = process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), '.pgdata');
// The socket server rejects (and closes) connections beyond this ceiling, which
// surfaces to clients as "Server has closed the connection". Keep it well above
// the sum of every pool (Next.js, Prisma CLI, seed scripts).
const MAX_CONNECTIONS = Number(process.env.PGLITE_MAX_CONNECTIONS ?? 32);
const STATS_PORT = Number(process.env.PGLITE_STATS_PORT ?? 0);

function portInUse(port, host) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    socket.setTimeout(500);
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function main() {
  if (await portInUse(PORT, HOST)) {
    console.log(`[db] PostgreSQL already listening on ${HOST}:${PORT} — reusing it.`);
    return;
  }

  const db = await PGlite.create({ dataDir: DATA_DIR });
  const server = new PGLiteSocketServer({ db, port: PORT, host: HOST, maxConnections: MAX_CONNECTIONS });
  await server.start();
  console.log(`[db] Embedded PostgreSQL ready on postgresql://postgres:postgres@${HOST}:${PORT}/amaya (max ${MAX_CONNECTIONS} connections)`);

  // Optional diagnostics endpoint: GET /__stats → pool/queue counters.
  if (STATS_PORT > 0) {
    http
      .createServer((request, response) => {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: true, ...server.getStats(), uptime: process.uptime() }));
      })
      .listen(STATS_PORT, HOST, () => {
        console.log(`[db] stats on http://${HOST}:${STATS_PORT}/__stats`);
      });
  }

  const shutdown = async (signal) => {
    console.log(`[db] ${signal} received — stopping.`);
    try {
      await server.stop();
      await db.close();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[db] Failed to start embedded PostgreSQL:', error);
  process.exit(1);
});
