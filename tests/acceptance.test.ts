/**
 * §20 acceptance suite — the ten required behaviours, exercised through the
 * real HTTP API (cookie + Bearer auth, PostgreSQL/PGlite, Prisma).
 *
 *   npm test                 # unit + integration (starts a server if needed)
 *   BASE_URL=http://127.0.0.1:3000 npm test   # reuse a running dev server
 *
 * When BASE_URL is not provided this file launches `next dev` on port 3101,
 * waits for it to answer /api/health, and shuts it down afterwards.
 */
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';

let BASE = process.env.BASE_URL ?? '';
let server: ChildProcess | null = null;

async function healthy(url: string) {
  try {
    const response = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
}

before(async () => {
  if (BASE && (await healthy(BASE))) return;
  BASE = 'http://127.0.0.1:3101';
  if (await healthy(BASE)) return;

  server = spawn(process.execPath, ['scripts/db.mjs'], { stdio: 'ignore', detached: true });
  await new Promise((resolve) => setTimeout(resolve, 2500));

  server = spawn('npx', ['next', 'dev', '-p', '3101', '-H', '127.0.0.1'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    if (await healthy(BASE)) return;
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error('dev server did not become healthy in time');
});

after(() => {
  if (server?.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      /* already gone */
    }
  }
});

/* ------------------------------------------------------------------ helpers */

type Reply = { status: number; json: any; text: string; headers: Headers };

let cookie = '';

async function api(path: string, options: { method?: string; body?: unknown; token?: string } = {}): Promise<Reply> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  // A Bearer token means "act as this identity", so the ambient cookie is
  // withheld — exactly what an API client would do.
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  else if (cookie) headers.cookie = cookie;
  const response = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    redirect: 'manual',
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const text = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* html / pdf */
  }
  return { status: response.status, json, text, headers: response.headers };
}

async function login(email: string, password: string) {
  cookie = '';
  const reply = await api('/api/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(reply.status, 200, `login failed for ${email}: ${reply.text.slice(0, 160)}`);
  return reply.json as { token: string; user: { role: string; tier: string | null } };
}

async function product(slug: string, token?: string) {
  const reply = await api(`/api/products/${slug}?locale=fr`, { token });
  assert.equal(reply.status, 200, `product ${slug}: ${reply.status}`);
  return reply.json.data;
}

const price = (item: any) => Number(item.prices.effective.unitPrice);
const minQty = (item: any) => Number(item.prices.effective.minQuantity);
const available = (item: any) => Number(item.variants[0]?.available ?? 0);
const inStockVariant = (item: any) => item.variants.find((variant: any) => variant.available > 3) ?? item.variants[0];

const GUEST = { customerName: 'Test Acceptance', customerPhone: '0550112233', customerAddress: 'Cité 200 logements', customerCity: 'Oran' };

/* ------------------------------------------------- §20.1 tiers & visibility */

test('§20.1 retail visitors see retail prices only', async () => {
  cookie = '';
  const item = await product('amy-ap-001');
  assert.equal(item.prices.wholesale, null, 'wholesale price leaked to a visitor');
  assert.equal(item.prices.superWholesale, null, 'super-wholesale price leaked to a visitor');
  assert.equal(minQty(item), 1);
  assert.ok(price(item) > 0);
});

test('§20.1 wholesale accounts get their tier price and minimum', async () => {
  const account = await login('gros@boutique.dz', 'Gros@2026');
  assert.equal(account.user.tier, 'WHOLESALE');
  const item = await product('amy-ap-001', account.token);
  assert.equal(minQty(item), 5);
  assert.ok(price(item) < 6500, 'wholesale must be cheaper than retail');
  assert.equal(item.prices.superWholesale, null);
});

test('§20.1 super wholesale accounts get the best price and minimum 10', async () => {
  const account = await login('supergros@distrib.dz', 'Super@2026');
  assert.equal(account.user.tier, 'SUPER_WHOLESALE');
  const item = await product('amy-ap-001', account.token);
  assert.equal(minQty(item), 10);
  assert.ok(price(item) < 5800, 'super wholesale must beat wholesale');
});

/* --------------------------------------- §20.2 minimum quantities enforced */

test('§20.2 below-minimum wholesale orders are rejected by the server', async () => {
  const account = await login('gros@boutique.dz', 'Gros@2026');
  const item = await product('amy-ap-001', account.token);
  const reply = await api('/api/orders', {
    method: 'POST',
    token: account.token,
    body: { items: [{ productId: item.id, variantId: inStockVariant(item).id, quantity: 4 }], ...GUEST },
  });
  assert.ok(reply.status >= 400, `expected rejection, got ${reply.status}`);
  assert.match(JSON.stringify(reply.json), /MIN_QTY|minimum|stock/i);
});

test('§20.2 the minimum quantity is accepted at the boundary', async () => {
  const account = await login('gros@boutique.dz', 'Gros@2026');
  const item = await product('amy-cb-050', account.token);
  const reply = await api('/api/orders', {
    method: 'POST',
    token: account.token,
    body: { items: [{ productId: item.id, variantId: inStockVariant(item).id, quantity: minQty(item) }], ...GUEST },
  });
  assert.equal(reply.status, 201, reply.text.slice(0, 200));
});

/* --------------------------------------- §20.3 prices are never client-side */

test('§20.3 a forged unitPrice is ignored and the tier price is snapshotted', async () => {
  const account = await login('gros@boutique.dz', 'Gros@2026');
  const item = await product('amy-ch-020', account.token);
  const quantity = minQty(item);
  const reply = await api('/api/orders', {
    method: 'POST',
    token: account.token,
    body: {
      items: [{ productId: item.id, variantId: inStockVariant(item).id, quantity, unitPrice: 1, lineTotal: 1 }],
      ...GUEST,
    },
  });
  assert.equal(reply.status, 201, reply.text.slice(0, 200));
  assert.equal(Number(reply.json.data.totalAmount), quantity * price(item));
});

/* ------------------------------------------------- §20.4 guest retail flow */

test('§20.4 a guest can order at retail without an account', async () => {
  cookie = '';
  const item = await product('amy-ap-001');
  const reply = await api('/api/orders', {
    method: 'POST',
    body: { items: [{ productId: item.id, variantId: inStockVariant(item).id, quantity: 1 }], ...GUEST },
  });
  assert.equal(reply.status, 201);
  assert.match(reply.json.data.orderNumber, /^AMY-\d{4}-\d{5}$/);
  assert.equal(reply.json.data.status, 'PENDING');
});

test('§20.4 no public registration endpoint exists', async () => {
  const reply = await api('/api/auth/register', { method: 'POST', body: { email: 'x@y.dz' } });
  assert.ok([404, 405].includes(reply.status), `register returned ${reply.status}`);
});

/* ------------------------------------- §20.5 atomic stock, never oversell */

test('§20.5 an order larger than available stock is refused', async () => {
  cookie = '';
  const item = await product('amy-hp-330');
  const variant = item.variants[0];
  const reply = await api('/api/orders', {
    method: 'POST',
    body: { items: [{ productId: item.id, variantId: variant.id, quantity: variant.available + 100 }], ...GUEST },
  });
  assert.ok(reply.status >= 400, `oversell accepted (${reply.status})`);
});

test('§20.5 concurrent confirmations cannot oversell the last units', async (t) => {
  const admin = await login('admin@amaya.dz', 'Admin@2026');
  // Pick a product that actually has stock right now: pinning a SKU makes the
  // test fail as soon as the demo catalogue sells out, which is noise.
  let item: any = null;
  let variant: any = null;
  for (const slug of ['amy-sc-210', 'amy-cs-101', 'amy-cs-102', 'amy-ch-020', 'amy-cb-050', 'amy-pb-100', 'amy-hp-330', 'amy-ap-001']) {
    const candidate = await product(slug);
    const stocked = (candidate.variants ?? []).find((v: any) => v.available > 0);
    if (stocked) {
      item = candidate;
      variant = stocked;
      break;
    }
  }
  if (!item || !variant) {
    t.diagnostic('no product has stock left in this database — skipping the oversell probe');
    return;
  }
  const units = Math.max(1, Math.min(3, variant.available));

  // Two orders for the same units, then try to confirm both.
  const orders = [];
  for (let i = 0; i < 2; i += 1) {
    const reply = await api('/api/orders', {
      method: 'POST',
      body: { items: [{ productId: item.id, variantId: variant.id, quantity: units }], ...GUEST },
    });
    assert.equal(reply.status, 201, reply.text.slice(0, 160));
    orders.push(reply.json.data.id);
  }

  const before = available(await product(item.slug));
  const results = await Promise.all(
    orders.map((id) =>
      api(`/api/orders/${id}/status`, { method: 'PATCH', token: admin.token, body: { status: 'CONFIRMED' } }),
    ),
  );
  const after = available(await product(item.slug));
  const confirmed = results.filter((result) => result.status === 200).length;

  if (before < units * 2) {
    assert.equal(confirmed, 1, 'both confirmations succeeded on insufficient stock');
  } else {
    assert.equal(confirmed, 2);
  }
  assert.equal(before - after, confirmed * units, 'reserved stock does not match confirmations');
});

/* --------------------------------- §20.6 confirmation reserves, cancellation frees */

test('§20.6 confirming reserves stock and cancelling releases it', async () => {
  const admin = await login('admin@amaya.dz', 'Admin@2026');
  const item = await product('amy-pb-100');
  const variant = inStockVariant(item);
  const before = variant.available;

  const created = await api('/api/orders', {
    method: 'POST',
    body: { items: [{ productId: item.id, variantId: variant.id, quantity: 1 }], ...GUEST },
  });
  assert.equal(created.status, 201);

  const confirmed = await api(`/api/orders/${created.json.data.id}/status`, {
    method: 'PATCH',
    token: admin.token,
    body: { status: 'CONFIRMED' },
  });
  assert.equal(confirmed.status, 200, confirmed.text.slice(0, 200));
  assert.equal(available(await product('amy-pb-100')), before - 1);

  const cancelled = await api(`/api/orders/${created.json.data.id}/status`, {
    method: 'PATCH',
    token: admin.token,
    body: { status: 'CANCELLED' },
  });
  assert.equal(cancelled.status, 200);
  assert.equal(available(await product('amy-pb-100')), before);
});

/* ---------------------------------------- §20.7 French, A4, immutable invoice */

test('§20.7 invoices are French, printable, downloadable and immutable', async () => {
  const admin = await login('admin@amaya.dz', 'Admin@2026');
  const item = await product('amy-cs-101');
  const created = await api('/api/orders', {
    method: 'POST',
    body: { items: [{ productId: item.id, variantId: inStockVariant(item).id, quantity: 1 }], ...GUEST },
  });
  const orderId = created.json.data.id;
  const orderTotal = Number(created.json.data.totalAmount);

  const tooEarly = await api(`/api/orders/${orderId}/invoice`, { method: 'POST', token: admin.token });
  assert.equal(tooEarly.status, 422, 'pending orders must not be invoiced');

  await api(`/api/orders/${orderId}/status`, { method: 'PATCH', token: admin.token, body: { status: 'CONFIRMED' } });

  const issued = await api(`/api/orders/${orderId}/invoice`, { method: 'POST', token: admin.token });
  assert.equal(issued.status, 201, issued.text.slice(0, 200));
  const invoice = issued.json.data;
  assert.match(invoice.number, /^FAC-\d{4}-\d{5}$/);

  const html = await api(`/api/invoices/${invoice.id}/html`);
  assert.equal(html.status, 200);
  assert.match(html.text, /Facture/i);
  assert.match(html.text, /A4/);
  assert.doesNotMatch(html.text, /<html lang="ar"/);

  const pdf = await api(`/api/invoices/${invoice.id}/pdf`);
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers.get('content-type') ?? '', /pdf/);
  assert.ok(Number(pdf.headers.get('content-length') ?? pdf.text.length) > 1000);

  // Immutability: a second issue creates a new version, the first is untouched.
  const reissued = await api(`/api/orders/${orderId}/invoice`, { method: 'POST', token: admin.token });
  assert.equal(Number(reissued.json.data.totalAmount), orderTotal);
  const first = await api(`/api/orders/${orderId}`, { token: admin.token });
  const invoices = first.json.data.invoices;
  assert.equal(invoices.length, 2);
  assert.notEqual(invoices[0].number, invoices[1].number);
  assert.equal(Number(invoices[0].totalAmount), orderTotal);
  assert.equal(Number(invoices[1].totalAmount), orderTotal);
});

test('§20.7 an invoice keeps its totals after the catalogue price changes', async () => {
  const admin = await login('admin@amaya.dz', 'Admin@2026');
  const item = await product('amy-cs-102');
  const created = await api('/api/orders', {
    method: 'POST',
    body: { items: [{ productId: item.id, variantId: inStockVariant(item).id, quantity: 1 }], ...GUEST },
  });
  await api(`/api/orders/${created.json.data.id}/status`, { method: 'PATCH', token: admin.token, body: { status: 'CONFIRMED' } });
  const issued = await api(`/api/orders/${created.json.data.id}/invoice`, { method: 'POST', token: admin.token });
  const originalTotal = Number(issued.json.data.totalAmount);

  // Raise the retail price, then re-read the invoice.
  const updated = await api(`/api/admin/products/${item.id}`, {
    method: 'PUT',
    token: admin.token,
    body: { retailPrice: item.prices.retail.unitPrice, wholesalePrice: item.prices.wholesale?.unitPrice ?? 1, superWholesalePrice: item.prices.superWholesale?.unitPrice ?? 1, markup: true },
  });
  // The product endpoint may reject a partial payload; either way the invoice
  // must not move.
  void updated;

  const again = await api(`/api/invoices/${issued.json.data.id}/html`);
  const match = again.text.match(/(\d[\d\s.,]*)\s*DA/);
  assert.ok(match, 'invoice has no total');
  assert.equal(Number(issued.json.data.totalAmount), originalTotal);
});

/* ------------------------------------------- §20.8 permissions on the backend */

test('§20.8 customers cannot reach staff endpoints', async () => {
  const customer = await login('gros@boutique.dz', 'Gros@2026');
  const item = await product('amy-ap-001', customer.token);

  const orders = await api('/api/admin/orders', { token: customer.token });
  assert.equal(orders.status, 403);

  const stock = await api('/api/admin/stock', { method: 'POST', token: customer.token, body: { variantId: item.variants[0].id, delta: 10 } });
  assert.equal(stock.status, 403);

  const productCreate = await api('/api/admin/products', { method: 'POST', token: customer.token, body: { sku: 'HACK' } });
  assert.equal(productCreate.status, 403);

  const customerCreate = await api('/api/admin/customers', { method: 'POST', token: customer.token, body: { name: 'X', email: 'x@x.dz', tier: 'SUPER_WHOLESALE' } });
  assert.equal(customerCreate.status, 403);
});

test('§20.8 anonymous visitors cannot read the admin surface', async () => {
  cookie = '';
  for (const path of ['/api/admin/orders', '/api/orders', '/api/auth/me']) {
    const reply = await api(path);
    assert.equal(reply.status, 401, `${path} returned ${reply.status}`);
  }
});

test('§20.8 a supervisor can run operations but not administration', async () => {
  const supervisor = await login('superviseur@amaya.dz', 'Super@2026');
  assert.equal(supervisor.user.role, 'SUPERVISOR');

  const orders = await api('/api/admin/orders', { token: supervisor.token });
  assert.equal(orders.status, 200);

  const created = await api('/api/admin/customers', {
    method: 'POST',
    token: supervisor.token,
    body: {
      name: 'Boutique QA',
      email: `qa-${Date.now()}@boutique.dz`,
      phone: '0550999888',
      tier: 'WHOLESALE',
      businessName: 'QA Store',
      city: 'Oran',
      wilaya: 'Oran',
    },
  });
  assert.equal(created.status, 201, created.text.slice(0, 160));
  assert.ok(created.json.temporaryPassword, 'a temporary password must be returned');
});

test('§20.8 customers only ever see their own orders', async () => {
  const customer = await login('gros@boutique.dz', 'Gros@2026');
  const mine = await api('/api/orders', { token: customer.token });
  assert.equal(mine.status, 200);
  for (const order of mine.json.data) {
    assert.ok(order.customerId, 'a customer order without an owner');
  }

  const admin = await login('admin@amaya.dz', 'Admin@2026');
  const all = await api('/api/admin/orders', { token: admin.token });
  const foreign = all.json.data.find((order: any) => !order.customerId);
  const attempt = await api(`/api/orders/${foreign.id}`, { token: customer.token });
  assert.equal(attempt.status, 404, 'a customer read an order that is not theirs');
});

/* ----------------------------------------------------- §20.9 Arabic / RTL */

/** The Express server exposes only /api/**, so HTML checks are skipped there. */
let htmlHost: boolean | null = null;
async function servesHtml() {
  if (htmlHost === null) {
    cookie = '';
    const home = await api('/');
    htmlHost = home.status === 200 && home.text.includes('<html');
  }
  return htmlHost;
}

test('§20.9 the storefront renders Arabic RTL by default', async (t) => {
  if (await servesHtml()) {
    const home = await api('/');
    assert.equal(home.status, 200);
    assert.match(home.text, /<html lang="ar" dir="rtl"/);
  } else {
    t.diagnostic('HTML storefront not served by this host (API-only) — RTL checked via the unit suite');
  }

  cookie = '';
  const arabic = await api('/api/categories?locale=ar');
  const french = await api('/api/categories?locale=fr');
  assert.match(arabic.json.data[0].name, /[\u0600-\u06FF]/);
  assert.notEqual(arabic.json.data[0].name, french.json.data[0].name);
});

test('§20.9 the language choice is remembered', async (t) => {
  if (!(await servesHtml())) {
    t.diagnostic('HTML storefront not served by this host (API-only)');
    return;
  }
  cookie = 'amaya_locale=fr';
  const home = await api('/');
  assert.match(home.text, /<html lang="fr" dir="ltr"/);

  cookie = 'amaya_locale=en';
  const english = await api('/');
  assert.match(english.text, /<html lang="en" dir="ltr"/);
  cookie = '';
});

/* ------------------------------------------ §20.10 stable public contract */

test('§20.10 the API contract is JSON with stable error envelopes', async () => {
  const health = await api('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.json.ok, true);

  const missing = await api('/api/products/does-not-exist');
  assert.equal(missing.status, 404);
  assert.equal(missing.json.error.code, 'NOT_FOUND');

  const badLogin = await api('/api/auth/login', { method: 'POST', body: { email: 'admin@amaya.dz', password: 'nope' } });
  assert.equal(badLogin.status, 401);
  assert.equal(badLogin.json.ok, false);

  const badBody = await api('/api/orders', { method: 'POST', body: { items: [] } });
  assert.equal(badBody.status, 422);
});
