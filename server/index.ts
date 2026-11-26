/**
 * AMAYA standalone API server.
 *
 *   npm run api            # 0.0.0.0:4000 by default (PORT to override)
 *
 * The exact same handlers that back `/api/**` in Next.js are mounted here with
 * Express, so native apps, kiosks and integrations can talk to a plain Node
 * process while the storefront keeps using the Next.js runtime. There is one
 * implementation of every rule (pricing, minimum quantities, stock, invoices):
 * `src/lib/api/handlers.ts`.
 *
 * Next.js is the default runtime for the whole product — this server is the
 * optional second entry point required by the spec's Node.js + Express layer.
 */
import express from 'express';
import { Readable } from 'node:stream';

import * as handlers from '../src/lib/api/handlers';

const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);
const HOST = process.env.API_HOST ?? '0.0.0.0';
const PREFIX = '/api';

type Handler = (request: Request, ...rest: string[]) => Promise<Response>;

/** Run a web-standard handler and pipe its Response back through Express. */
async function invoke(
  handler: Handler,
  req: express.Request,
  res: express.Response,
  params: string[] = [],
) {
  const origin = `${req.protocol}://${req.get('host') ?? `localhost:${PORT}`}`;
  const url = new URL(req.originalUrl, origin);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value);
    else if (Array.isArray(value)) headers.set(key, value.join(', '));
  }

  const method = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  const body = hasBody && req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : undefined;

  const request = new Request(url, { method, headers, body, redirect: 'manual' } as RequestInit);

  let response: Response;
  try {
    response = await handler(request, ...params);
  } catch (error) {
    console.error('[api] unhandled', req.method, req.originalUrl, error);
    res.status(500).json({ ok: false, error: { code: 'INTERNAL', message: 'Unexpected error' } });
    return;
  }

  res.status(response.status);
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return;
    res.setHeader(key, value);
  });

  // Forward every Set-Cookie individually (login session, locale...).
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  if (cookies.length > 0) res.setHeader('set-cookie', cookies);

  if (!response.body) {
    res.end();
    return;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  res.send(buffer);
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '1mb' }));

// Permissive CORS for native / third-party clients; the browser storefront is
// same-origin through Next.js so it never needs this.
app.use((req, res, next) => {
  res.setHeader('access-control-allow-origin', req.headers.origin ?? '*');
  res.setHeader('vary', 'origin');
  res.setHeader('access-control-allow-credentials', 'true');
  res.setHeader('access-control-allow-headers', 'content-type, authorization');
  res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'amaya-api',
    version: '1.0.0',
    docs: 'See README.md → API',
    endpoints: [
      'GET  /api/health',
      'POST /api/auth/login',
      'GET  /api/auth/me',
      'GET  /api/categories',
      'GET  /api/products',
      'GET  /api/products/:slug',
      'POST /api/cart/quote',
      'POST /api/orders',
      'GET  /api/orders',
      'GET  /api/orders/:id',
      'PATCH /api/orders/:id/status',
      'POST /api/orders/:id/invoice',
      'GET  /api/invoices/:id/pdf',
      'GET  /api/invoices/:id/html',
      'GET  /api/admin/orders',
      'POST /api/admin/customers',
      'PATCH /api/admin/customers/:id',
      'POST /api/admin/products',
      'PUT  /api/admin/products/:id',
      'POST /api/admin/stock',
    ],
  });
});

const routes: [string, string, Handler][] = [
  ['GET', '/health', handlers.healthHandler],
  ['POST', '/auth/login', handlers.loginHandler],
  ['GET', '/auth/me', handlers.meHandler],
  ['POST', '/auth/password', handlers.changePasswordHandler],
  ['GET', '/categories', handlers.categoriesHandler],
  ['GET', '/products', handlers.productsHandler],
  ['GET', '/products/:slug', handlers.productHandler],
  ['POST', '/cart/quote', handlers.quoteHandler],
  ['GET', '/orders', handlers.myOrdersHandler],
  ['POST', '/orders', handlers.createOrderHandler],
  ['GET', '/orders/:id', handlers.myOrderHandler],
  ['PATCH', '/orders/:id/status', handlers.orderStatusHandler],
  ['POST', '/orders/:id/invoice', handlers.createInvoiceHandler],
  ['GET', '/invoices/:id/pdf', handlers.invoicePdfHandler],
  ['GET', '/invoices/:id/html', handlers.invoiceHtmlHandler],
  ['GET', '/admin/orders', handlers.adminOrdersHandler],
  ['POST', '/admin/customers', handlers.createCustomerHandler],
  ['PATCH', '/admin/customers/:id', handlers.updateCustomerHandler],
  ['POST', '/admin/products', handlers.createProductHandler],
  ['PUT', '/admin/products/:id', handlers.updateProductHandler],
  ['POST', '/admin/stock', handlers.adjustStockHandler],
];

for (const [method, path, handler] of routes) {
  const expressPath = `${PREFIX}${path.replace(/:(\w+)/g, ':$1')}`;
  const paramNames = (path.match(/:(\w+)/g) ?? []).map((token) => token.slice(1));

  app[method.toLowerCase() as 'get' | 'post' | 'patch' | 'put'](expressPath, async (req, res) => {
    const params = paramNames.map((name) => decodeURIComponent(String(req.params[name] ?? '')));
    await invoke(handler, req, res, params);
  });
}

app.use((req, res) => {
  res.status(404).json({ ok: false, error: { code: 'NOT_FOUND', message: `${req.method} ${req.path} is not an API route` } });
});

const server = app.listen(PORT, HOST, () => {
  console.log(`[amaya-api] listening on http://${HOST}:${PORT} — ${routes.length} routes mounted from src/lib/api/handlers.ts`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}

void Readable;
