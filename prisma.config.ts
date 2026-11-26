import { defineConfig, env } from 'prisma/config';
import 'dotenv/config';

// Prisma CLI configuration (Prisma 7). The schema mirrors the SQL migration
// under prisma/migrations, which is what gets applied on deploy.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
  migrations: {
    path: 'prisma/migrations',
  },
});
