// Embedded PostgreSQL (PGlite) server for local development & previews.
//
// PGlite is real PostgreSQL compiled to WebAssembly. This script exposes it
// over the wire protocol so the application (and Prisma through node-postgres)
// can talk to it exactly like a real Postgres server. Data lives in .pgdata/.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import net from 'node:net';
import path from 'node:path';

const PORT = Number(process.env.PGLITE_PORT ?? 5432);
const HOST = process.env.PGLITE_HOST ?? '127.0.0.1';
const DATA_DIR = process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), '.pgdata');

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
  const server = new PGLiteSocketServer({ db, port: PORT, host: HOST, maxConnections: 12 });
  await server.start();
  console.log(`[db] Embedded PostgreSQL ready on postgresql://postgres:postgres@${HOST}:${PORT}/amaya`);

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
