// Aliases `server-only` / `client-only` to an empty module so the shared API
// handlers can run in plain Node (outside the Next.js bundler).
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const empty = pathToFileURL(path.resolve(process.cwd(), 'server/empty.js')).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only' || specifier === 'client-only') {
      return { url: empty, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
