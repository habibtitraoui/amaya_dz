// Drop every AMAYA table, re-run migrations and re-seed demo data.
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:5432/amaya';

const TABLES = [
  'InvoiceItem', 'Invoice', 'OrderStatusHistory', 'OrderItem', 'Order',
  'StockMovement', 'PriceHistory', 'ProductPrice', 'ProductImage', 'ProductVariant',
  'ProductTranslation', 'Product', 'CategoryTranslation', 'Category',
  'CustomerProfile', 'AuditLog', 'SiteSetting', 'Sequence', 'User', '_amaya_migrations',
];

async function main() {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  await client.query('DROP TABLE IF EXISTS ' + TABLES.map((t) => `"${t}"`).join(', ') + ' CASCADE');
  await client.query(`
    DROP TYPE IF EXISTS "Role", "CustomerTier", "AccountStatus", "ProductStatus",
      "OrderStatus", "PriceTier", "LocaleCode", "StockMovementType" CASCADE
  `);
  await client.end();
  console.log('[reset] schema dropped.');

  const migrate = spawnSync(process.execPath, ['scripts/migrate.mjs'], { stdio: 'inherit' });
  if (migrate.status !== 0) process.exit(migrate.status ?? 1);
  const seed = spawnSync('npx', ['tsx', 'scripts/seed.mjs', '--force'], { stdio: 'inherit' });
  process.exit(seed.status ?? 0);
}

main().catch((error) => {
  console.error('[reset]', error.message);
  process.exit(1);
});
