// Boot the embedded database, apply migrations and seed demo data, then run
// the requested process (next dev / next start / api server).
import { spawn } from 'node:child_process';
import net from 'node:net';

const mode = process.argv[2] ?? 'dev';

function portInUse(port, host = '127.0.0.1') {
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

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`))));
    child.on('error', reject);
  });
}

let dbProcess = null;

async function ensureDatabase() {
  if (!(await portInUse(5432))) {
    dbProcess = spawn(process.execPath, ['scripts/db.mjs'], { stdio: 'inherit' });
    for (let i = 0; i < 120; i += 1) {
      if (await portInUse(5432)) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  await run(process.execPath, ['scripts/migrate.mjs']);
}

async function main() {
  await ensureDatabase();

  // Seed only when the database is empty (first boot).
  const { Client } = await import('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const { rows } = await client.query('SELECT count(*)::int AS n FROM "User"');
  await client.end();
  if (rows[0].n === 0) {
    await run('npx', ['tsx', 'scripts/seed.mjs']);
  }

  const command =
    mode === 'dev'
      ? spawn('npx', ['next', 'dev', '-p', process.env.PORT ?? '3000', '-H', '0.0.0.0'], { stdio: 'inherit' })
      : mode === 'api'
        ? spawn('npx', ['tsx', '--import', './server/register.mjs', 'server/index.ts'], { stdio: 'inherit' })
        : spawn('npx', ['next', 'start', '-p', process.env.PORT ?? '3000', '-H', '0.0.0.0'], { stdio: 'inherit' });

  const shutdown = (signal) => {
    command.kill(signal);
    if (dbProcess) dbProcess.kill(signal);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  command.on('exit', (code) => {
    if (dbProcess) dbProcess.kill('SIGTERM');
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error('[with-db]', error.message);
  if (dbProcess) dbProcess.kill('SIGTERM');
  process.exit(1);
});
