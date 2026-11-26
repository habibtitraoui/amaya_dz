// Regenerate the Prisma client into src/generated/prisma.
//
// Prisma 7 no longer ships a query engine binary for the client (it uses a
// WASM query compiler + driver adapters), but the CLI still tries to download
// a schema-engine binary. In network-restricted environments we provide a stub
// so `prisma generate` can run from the local schema.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const stub = path.join(os.tmpdir(), 'amaya-prisma-schema-engine-stub');
if (!fs.existsSync(stub)) {
  fs.writeFileSync(stub, '#!/bin/sh\nexit 1\n');
  fs.chmodSync(stub, 0o755);
}

const result = spawnSync('npx', ['prisma', 'generate'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PRISMA_SCHEMA_ENGINE_BINARY: process.env.PRISMA_SCHEMA_ENGINE_BINARY ?? stub,
    PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING: '1',
  },
});
process.exit(result.status ?? 1);
