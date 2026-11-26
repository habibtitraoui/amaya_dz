// Apply pending SQL migrations from prisma/migrations to the database.
// Kept dependency-light on purpose: production Postgres and the embedded
// PGlite server both understand this protocol through node-postgres.
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const MIGRATIONS_DIR = path.join(process.cwd(), 'prisma', 'migrations');
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/amaya';

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _amaya_migrations (
        id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    const { rows } = await client.query('SELECT id FROM _amaya_migrations');
    const applied = new Set(rows.map((row) => row.id));

    const entries = (await fs.readdir(MIGRATIONS_DIR, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    let count = 0;
    for (const name of entries) {
      if (applied.has(name)) continue;
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _amaya_migrations (id) VALUES ($1)', [name]);
        await client.query('COMMIT');
        console.log(`[migrate] applied ${name}`);
        count += 1;
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${name} failed: ${error.message}`);
      }
    }
    console.log(count === 0 ? '[migrate] database is up to date.' : `[migrate] ${count} migration(s) applied.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[migrate]', error.message);
  process.exit(1);
});
