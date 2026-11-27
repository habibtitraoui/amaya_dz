'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { CART_COOKIE, MAX_LINE_QUANTITY, parseCart, serializeCart, type CartLine } from '@/lib/cart';
import { quoteCart, type Quote } from '@/lib/services/pricing-service';
import { getTier } from '@/lib/auth';
import { getLocale } from '@/lib/locale';
import type { ActionState } from '@/lib/errors';

async function readCart(): Promise<CartLine[]> {
  const store = await cookies();
  return parseCart(store.get(CART_COOKIE)?.value);
}

async function writeCart(lines: CartLine[]) {
  const store = await cookies();
  const compact = lines.map(({ productId, variantId, quantity, slug, name, color, image }) => ({
    productId,
    variantId,
    quantity,
    slug,
    name,
    color,
    image,
  }));
  store.set(CART_COOKIE, serializeCart(compact), {
    httpOnly: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

/**
 * Add / update a line. Prices and minimums are validated here so the UI can
 * show the exact reason a line was refused, but nothing is final until the
 * quote that precedes order creation.
 */
export async function addToCartAction(input: {
  productId: string;
  variantId: string;
  quantity: number;
}): Promise<ActionState> {
  const quantity = Math.max(1, Math.min(MAX_LINE_QUANTITY, Math.floor(input.quantity)));
  const product = await prisma.product.findFirst({
    where: { id: input.productId, status: { in: ['AVAILABLE', 'OUT_OF_STOCK'] } },
    include: { translations: true, variants: true, images: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!product) return { ok: false, error: 'Product not available' };

  const variant = product.variants.find((v) => v.id === input.variantId && v.isActive);
  if (!variant) return { ok: false, error: 'Colour not available' };

  const tier = await getTier();
  const fr = product.translations.find((t) => t.locale === 'FR')?.name ?? product.sku;

  const lines = await readCart();
  const existing = lines.find((l) => l.productId === product.id && l.variantId === variant.id);
  if (existing) existing.quantity = Math.min(MAX_LINE_QUANTITY, existing.quantity + quantity);
  else
    lines.push({
      productId: product.id,
      variantId: variant.id,
      quantity,
      slug: product.slug,
      name: fr,
      color: variant.colorNameFr,
      image: variant.image ?? product.images[0]?.url ?? null,
    });
  await writeCart(lines);

  const locale = await getLocale();
  const quote = await quoteCart(
    lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
    tier,
    { locale },
  );
  revalidatePath('/', 'layout');
  const lineErrors = quote.errors.filter((e) => e.productId === product.id);
  if (lineErrors.length > 0) {
    return { ok: true, message: lineErrors[0].message, data: { count: lines.reduce((s, l) => s + l.quantity, 0) } };
  }
  return { ok: true, data: { count: lines.reduce((s, l) => s + l.quantity, 0) } };
}

export async function updateCartLineAction(input: {
  productId: string;
  variantId: string;
  quantity: number;
}): Promise<ActionState> {
  const lines = await readCart();
  const line = lines.find((l) => l.productId === input.productId && l.variantId === input.variantId);
  if (!line) return { ok: false, error: 'Line not found' };
  if (input.quantity <= 0) {
    await writeCart(lines.filter((l) => l !== line));
  } else {
    line.quantity = Math.min(MAX_LINE_QUANTITY, Math.floor(input.quantity));
    await writeCart(lines);
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function removeCartLineAction(input: { productId: string; variantId: string }): Promise<ActionState> {
  const lines = await readCart();
  await writeCart(lines.filter((l) => !(l.productId === input.productId && l.variantId === input.variantId)));
  revalidatePath('/', 'layout');
  return { ok: true };
}

export async function clearCartAction(): Promise<ActionState> {
  await writeCart([]);
  revalidatePath('/', 'layout');
  return { ok: true };
}

export type CartView = {
  lines: CartLine[];
  quote: Quote | null;
  count: number;
};

/** Server-side view of the cart with the tier-correct quote attached. */
export async function getCartView(): Promise<CartView> {
  const lines = await readCart();
  const tier = await getTier();
  const count = lines.reduce((sum, l) => sum + l.quantity, 0);
  if (lines.length === 0) return { lines, quote: null, count };
  const locale = await getLocale();
  const quote = await quoteCart(
    lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
    tier,
    { locale },
  );
  return { lines, quote, count };
}

/** Reads the cart cookie from a server component. */
export async function readCartCookie(): Promise<CartLine[]> {
  return readCart();
}
