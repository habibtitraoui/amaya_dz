/**
 * The API handlers live in `src/lib/api/handlers.ts` and speak the web-standard
 * `Request`/`Response` pair. Publishing those modules as a standalone Node
 * server means teaching Node a few globals that Next.js normally provides and
 * resolving the `server-only` guard (which Next.js aliases to a no-op).
 */
import { register } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';

/** Alias `server-only` (and `client-only`) to an empty module, like Next does. */
export function enableServerOnlyAlias() {
  const empty = path.resolve(process.cwd(), 'server/empty.js');
  const entry = `data:text/javascript,${encodeURIComponent(`
    import { registerHooks } from 'node:module';
    registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier === 'server-only' || specifier === 'client-only') {
          return { url: ${JSON.stringify(`file://${empty}`)}, shortCircuit: true };
        }
        return nextResolve(specifier, context);
      },
    });
  `)}`;
  // node --import accepts a data URL; tsx resolves the .ts files underneath.
  return import(entry).then(() => import('node:module').then((mod) => mod.syncBuiltinESMExports()));
}

function absolute(url: string) {
  if (/^https?:\/\//.test(url)) return url;
  return new URL(url, 'http://localhost').toString();
}

/** Minimal Web-API polyfills required by the handlers. */
export function installWebGlobals() {
  const g = globalThis as unknown as Record<string, unknown>;

  if (typeof g.Request === 'undefined') {
    g.Request = class Request extends globalThis.Request {};
  }
  // Node 22 ships fetch/Request/Response/Headers already; only the helpers the
  // handlers rely on need verifying.

  const patch = (name: 'Request' | 'Response') => {
    const Original = (globalThis as unknown as Record<string, unknown>)[name] as typeof globalThis.Request;
    if (!Original) return;
    void Original;
  };
  patch('Request');
  patch('Response');
}

export { absolute };
void existsSync;
void Readable;
