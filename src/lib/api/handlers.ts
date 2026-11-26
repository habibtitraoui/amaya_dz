import 'server-only';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword, hashPassword } from '@/lib/password';
import { fail, json, readJson } from '@/lib/api/http';
import { userFromRequest } from '@/lib/api/session';
import { can } from '@/lib/auth';
import { sessionTokenFor } from '@/lib/api/session';
import { logAudit } from '@/lib/audit';
import { quoteCart, type CartLineInput } from '@/lib/services/pricing-service';
import { placeOrder, changeOrderStatus } from '@/lib/services/orders';
import { issueInvoice } from '@/lib/services/orders';
import { toProductView } from '@/lib/serializers';
import { listCategories, listProducts } from '@/lib/services/catalog';
import { createCustomer, updateCustomer } from '@/lib/services/customers';
import { createProduct, updateProduct } from '@/lib/services/products';
import { adjustStock } from '@/lib/services/inventory';
import { renderInvoicePdf } from '@/lib/invoice-pdf';
import { renderInvoiceHtml } from '@/lib/invoice-template';
import { AppError, toActionState } from '@/lib/errors';
import { isLocale, type Locale } from '@/lib/i18n';
import { ORDER_STATUSES, type Tier } from '@/lib/pricing';
import { SESSION_COOKIE } from '@/lib/session';

const PUBLIC_STATUSES = ['AVAILABLE', 'OUT_OF_STOCK'] as const;

const productInclude = {
  translations: true,
  variants: { orderBy: { createdAt: 'asc' } },
  images: { orderBy: { sortOrder: 'asc' } },
  category: { select: { slug: true, translations: true } },
} as const;

function localeFrom(request: Request): Locale {
  const url = new URL(request.url);
  const requested = url.searchParams.get('locale');
  if (isLocale(requested)) return requested;
  return 'ar';
}

/** Wrap a handler: catches domain errors and maps them to JSON + status. */
function guard<T extends unknown[]>(handler: (...args: T) => Promise<Response>) {
  return async (...args: T): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof AppError) {
        return fail(error.status, error.code, error.message, error.details);
      }
      const state = toActionState(error);
      return fail(500, 'INTERNAL', state.ok ? 'Unexpected error' : state.error);
    }
  };
}

async function requireUser(request: Request) {
  const user = await userFromRequest(request);
  if (!user) throw new AppError('UNAUTHORIZED', 'Authentication required', 401);
  return user;
}

/**
 * Staff guard for the HTTP API. Resolves the user from the request itself
 * (cookie *or* Bearer token) so it works for browsers and native clients
 * alike — never from ambient Next.js cookies.
 */
async function requireStaff(request: Request, permission?: Parameters<typeof can>[1]) {
  const user = await requireUser(request);
  if (user.role !== 'ADMIN' && user.role !== 'SUPERVISOR') {
    throw new AppError('FORBIDDEN', 'Staff access required', 403);
  }
  if (permission && !can(user, permission)) {
    throw new AppError('FORBIDDEN', 'You do not have permission for this action', 403);
  }
  return user;
}

/* ------------------------------------------------------------------ health */

export const healthHandler = guard(async () => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1 AS ok');
    return json({ ok: true, service: 'amaya-api', database: 'up', time: new Date().toISOString() });
  } catch {
    return json({ ok: false, service: 'amaya-api', database: 'down' }, { status: 503 });
  }
});

/* -------------------------------------------------------------------- auth */

const loginBody = z.object({ email: z.string().trim().email(), password: z.string().min(1) });

export const loginHandler = guard(async (request: Request) => {
  const body = await readJson<unknown>(request);
  const parsed = loginBody.safeParse(body);
  if (!parsed.success) return fail(422, 'VALIDATION', 'Email and password are required');

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
  if (!user) return fail(401, 'CREDENTIALS', 'Invalid email or password');
  const valid = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!valid) return fail(401, 'CREDENTIALS', 'Invalid email or password');
  if (user.status !== 'ACTIVE') return fail(403, 'SUSPENDED', 'This account is suspended');

  const token = await sessionTokenFor({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    tier: user.tier,
  });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await logAudit({
    actorId: user.id,
    actorName: user.name,
    action: 'auth.login',
    entityType: 'User',
    entityId: user.id,
    summary: `API login ${user.email}`,
  });

  return json(
    {
      ok: true,
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, tier: user.tier },
    },
    {
      headers: {
        'set-cookie': `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${7 * 86400}; SameSite=Lax; HttpOnly${
          process.env.NODE_ENV === 'production' ? '; Secure' : ''
        }`,
      },
    },
  );
});

export const meHandler = guard(async (request: Request) => {
  const user = await requireUser(request);
  const full = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, email: true, phone: true, role: true, tier: true, profile: true },
  });
  return json({ ok: true, user: full });
});

export const changePasswordHandler = guard(async (request: Request) => {
  const user = await requireUser(request);
  const body = await readJson<{ current?: string; next?: string }>(request);
  if (!body?.current || !body?.next || body.next.length < 8) {
    return fail(422, 'VALIDATION', 'current and next (min 8 chars) are required');
  }
  const record = await prisma.user.findUnique({ where: { id: user.id } });
  if (!record || !(await verifyPassword(body.current, record.passwordHash))) {
    return fail(403, 'PASSWORD', 'Current password is incorrect');
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.next) } });
  return json({ ok: true });
});

/* ---------------------------------------------------------------- catalogue */

export const categoriesHandler = guard(async (request: Request) => {
  const locale = localeFrom(request);
  const categories = await listCategories(locale);
  return json({ ok: true, data: categories });
});

export const productsHandler = guard(async (request: Request) => {
  const url = new URL(request.url);
  const locale = localeFrom(request);
  const user = await userFromRequest(request);
  const tier: Tier = user?.tier ?? 'RETAIL';
  const result = await listProducts({
    locale,
    tier,
    category: url.searchParams.get('category') ?? undefined,
    search: url.searchParams.get('q') ?? undefined,
    sort: (url.searchParams.get('sort') as never) ?? 'newest',
    inStockOnly: url.searchParams.get('stock') === '1',
    page: Number(url.searchParams.get('page') ?? 1),
    perPage: Number(url.searchParams.get('perPage') ?? 12),
  });
  return json({ ok: true, tier, ...result });
});

export const productHandler = guard(async (request: Request, slug: string) => {
  const locale = localeFrom(request);
  const user = await userFromRequest(request);
  const tier: Tier = user?.tier ?? 'RETAIL';
  const product = await prisma.product.findFirst({
    where: { slug, status: { in: [...PUBLIC_STATUSES] } },
    include: productInclude,
  });
  if (!product) return fail(404, 'NOT_FOUND', 'Product not found');
  return json({ ok: true, tier, data: toProductView(product as never, locale, tier) });
});

/* --------------------------------------------------------------------- cart */

const cartBody = z.object({
  items: z.array(z.object({ productId: z.string(), variantId: z.string(), quantity: z.number().int().positive() })),
  locale: z.string().optional(),
  deliveryMethod: z.enum(['DELIVERY', 'PICKUP']).optional(),
});

export const quoteHandler = guard(async (request: Request) => {
  const body = await readJson<unknown>(request);
  const parsed = cartBody.safeParse(body);
  if (!parsed.success) return fail(422, 'VALIDATION', 'items[] with productId, variantId, quantity required');
  const user = await userFromRequest(request);
  const tier: Tier = user?.tier ?? 'RETAIL';
  const quote = await quoteCart(parsed.data.items as CartLineInput[], tier, {
    locale: parsed.data.locale,
    deliveryMethod: parsed.data.deliveryMethod,
  });
  return json({ ok: true, tier, data: quote });
});

const orderBody = cartBody.extend({
  customerName: z.string().trim().min(2),
  customerPhone: z.string().trim().min(8),
  customerAddress: z.string().trim().min(4),
  customerCity: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const createOrderHandler = guard(async (request: Request) => {
  const body = await readJson<unknown>(request);
  const parsed = orderBody.safeParse(body);
  if (!parsed.success) return fail(422, 'VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid order');
  const user = await userFromRequest(request);
  const order = await placeOrder({
    items: parsed.data.items as CartLineInput[],
    customerName: parsed.data.customerName,
    customerPhone: parsed.data.customerPhone,
    customerAddress: parsed.data.customerAddress,
    customerCity: parsed.data.customerCity,
    notes: parsed.data.notes,
    deliveryMethod: parsed.data.deliveryMethod,
    tier: user?.tier ?? 'RETAIL',
    customerId: user?.role === 'CUSTOMER' ? user.id : null,
    createdById: user?.id ?? null,
    locale: parsed.data.locale,
  });
  return json({ ok: true, data: order }, { status: 201 });
});

/* ------------------------------------------------------------------- orders */

export const myOrdersHandler = guard(async (request: Request) => {
  const user = await requireUser(request);
  if (user.role !== 'CUSTOMER') return fail(403, 'FORBIDDEN', 'Customer account required');
  const orders = await prisma.order.findMany({
    where: { customerId: user.id },
    include: { items: true, invoices: { select: { id: true, number: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return json({ ok: true, data: orders });
});

export const myOrderHandler = guard(async (request: Request, id: string) => {
  const user = await requireUser(request);
  // Customers are always scoped to their own orders. Guest orders (customerId
  // null) are staff-only: no customer may read someone else's order by id.
  const order = await prisma.order.findFirst({
    where: user.role === 'CUSTOMER' ? { id, customerId: user.id } : { id },
    include: { items: true, statusHistory: { orderBy: { createdAt: 'asc' } }, invoices: true },
  });
  if (!order) return fail(404, 'NOT_FOUND', 'Order not found');
  return json({ ok: true, data: order });
});

export const adminOrdersHandler = guard(async (request: Request) => {
  await requireStaff(request, 'manageOrders');
  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('q');
  const where: Record<string, unknown> = {};
  if (status && ORDER_STATUSES.includes(status as never)) where.status = status;
  if (search?.trim()) {
    where.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { customerNameSnapshot: { contains: search, mode: 'insensitive' } },
      { customerPhoneSnapshot: { contains: search, mode: 'insensitive' } },
    ];
  }
  const orders = await prisma.order.findMany({
    where: where as never,
    include: { items: true, invoices: { select: { id: true, number: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return json({ ok: true, data: orders });
});

const statusBody = z.object({
  status: z.enum(ORDER_STATUSES as unknown as [string, ...string[]]),
  note: z.string().optional(),
});

export const orderStatusHandler = guard(async (request: Request, id: string) => {
  const user = await requireStaff(request, 'manageOrders');
  const body = await readJson<unknown>(request);
  const parsed = statusBody.safeParse(body);
  if (!parsed.success) return fail(422, 'VALIDATION', 'status is required');
  const order = await changeOrderStatus({
    orderId: id,
    to: parsed.data.status as never,
    actor: { id: user.id, name: user.name },
    note: parsed.data.note,
  });
  return json({ ok: true, data: order });
});

/* ----------------------------------------------------------------- invoices */

export const createInvoiceHandler = guard(async (request: Request, orderId: string) => {
  const user = await requireStaff(request, 'issueInvoices');
  const invoice = await issueInvoice(orderId, { id: user.id, name: user.name });
  return json({ ok: true, data: invoice }, { status: 201 });
});

export const invoicePdfHandler = guard(async (request: Request, id: string) => {
  const user = await requireUser(request);
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { items: true, order: true } });
  if (!invoice) return fail(404, 'NOT_FOUND', 'Invoice not found');
  const staff = user.role === 'ADMIN' || user.role === 'SUPERVISOR';
  if (!staff && invoice.order.customerId !== user.id) return fail(403, 'FORBIDDEN', 'Not your invoice');

  const pdf = await renderInvoicePdf({
    number: invoice.number,
    version: invoice.version,
    issuedAt: invoice.issuedAt,
    customerName: invoice.customerNameSnapshot,
    customerPhone: invoice.customerPhoneSnapshot,
    customerAddress: invoice.customerAddressSnapshot,
    subtotal: String(invoice.subtotal),
    discount: String(invoice.discount),
    deliveryFee: String(invoice.deliveryFee),
    totalAmount: String(invoice.totalAmount),
    notes: invoice.notes,
    orderNumber: invoice.order.orderNumber,
    orderStatus: invoice.order.status,
    customerType: invoice.order.customerTypeSnapshot,
    items: invoice.items.map((item) => ({
      reference: item.reference,
      designation: item.designation,
      color: item.color,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice),
      lineTotal: String(item.lineTotal),
    })),
  });
  return new Response(pdf as unknown as BodyInit, {
    headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${invoice.number}.pdf"` },
  });
});

export const invoiceHtmlHandler = guard(async (request: Request, id: string) => {
  const user = await requireUser(request);
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { items: true, order: true } });
  if (!invoice) return fail(404, 'NOT_FOUND', 'Invoice not found');
  const staff = user.role === 'ADMIN' || user.role === 'SUPERVISOR';
  if (!staff && invoice.order.customerId !== user.id) return fail(403, 'FORBIDDEN', 'Not your invoice');
  const html = renderInvoiceHtml({
    number: invoice.number,
    version: invoice.version,
    issuedAt: invoice.issuedAt,
    customerName: invoice.customerNameSnapshot,
    customerPhone: invoice.customerPhoneSnapshot,
    customerAddress: invoice.customerAddressSnapshot,
    subtotal: String(invoice.subtotal),
    discount: String(invoice.discount),
    deliveryFee: String(invoice.deliveryFee),
    totalAmount: String(invoice.totalAmount),
    notes: invoice.notes,
    orderNumber: invoice.order.orderNumber,
    orderStatus: invoice.order.status,
    customerType: invoice.order.customerTypeSnapshot,
    items: invoice.items.map((item) => ({
      reference: item.reference,
      designation: item.designation,
      color: item.color,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice),
      lineTotal: String(item.lineTotal),
    })),
  });
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
});

/* ---------------------------------------------------------------- customers */

const customerBody = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().optional(),
  tier: z.enum(['WHOLESALE', 'SUPER_WHOLESALE']),
  businessName: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  wilaya: z.string().trim().optional(),
  password: z.string().min(8).optional(),
  notes: z.string().trim().optional(),
});

export const createCustomerHandler = guard(async (request: Request) => {
  const user = await requireStaff(request, 'manageCustomers');
  const body = await readJson<unknown>(request);
  const parsed = customerBody.safeParse(body);
  if (!parsed.success) return fail(422, 'VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid customer');
  const result = await createCustomer(parsed.data, { id: user.id, name: user.name });
  return json(
    { ok: true, user: { id: result.user.id, email: result.user.email, name: result.user.name, tier: result.user.tier }, temporaryPassword: result.temporaryPassword },
    { status: 201 },
  );
});

export const updateCustomerHandler = guard(async (request: Request, id: string) => {
  const user = await requireStaff(request, 'manageCustomers');
  const body = await readJson<unknown>(request);
  const parsed = customerBody.partial().extend({ resetPassword: z.boolean().optional() }).safeParse(body);
  if (!parsed.success) return fail(422, 'VALIDATION', parsed.error.issues[0]?.message ?? 'Invalid customer');
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return fail(404, 'NOT_FOUND', 'Customer not found');
  const result = await updateCustomer(
    id,
    {
      name: parsed.data.name ?? existing.name,
      email: parsed.data.email ?? existing.email,
      phone: parsed.data.phone,
      tier: (parsed.data.tier ?? existing.tier) as 'WHOLESALE' | 'SUPER_WHOLESALE',
      businessName: parsed.data.businessName,
      address: parsed.data.address,
      city: parsed.data.city,
      wilaya: parsed.data.wilaya,
      notes: parsed.data.notes,
      resetPassword: parsed.data.resetPassword,
    },
    { id: user.id, name: user.name },
  );
  return json({ ok: true, user: result.user, temporaryPassword: result.temporaryPassword });
});

/* ----------------------------------------------------------------- products */

export const createProductHandler = guard(async (request: Request) => {
  const user = await requireStaff(request, 'manageProducts');
  const body = await readJson<never>(request);
  const product = await createProduct(body as never, { id: user.id, name: user.name });
  return json({ ok: true, data: product }, { status: 201 });
});

export const updateProductHandler = guard(async (request: Request, id: string) => {
  const user = await requireStaff(request, 'manageProducts');
  const body = await readJson<never>(request);
  const product = await updateProduct(id, body as never, { id: user.id, name: user.name });
  return json({ ok: true, data: product });
});

/* -------------------------------------------------------------------- stock */

export const adjustStockHandler = guard(async (request: Request) => {
  const user = await requireStaff(request, 'manageStock');
  const body = await readJson<{ variantId?: string; delta?: number; reason?: string }>(request);
  if (!body?.variantId || typeof body.delta !== 'number') {
    return fail(422, 'VALIDATION', 'variantId and delta (integer) are required');
  }
  const variant = await adjustStock({
    variantId: body.variantId,
    delta: Math.trunc(body.delta),
    reason: body.reason,
    actor: { id: user.id, name: user.name },
  });
  return json({ ok: true, data: variant });
});

