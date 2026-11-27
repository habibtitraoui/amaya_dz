import 'server-only';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { type Tier, priceRuleFor } from '@/lib/pricing';
import { toDecimalString } from '@/lib/money';
import { getDictionary, isLocale, t as interpolate, type Locale } from '@/lib/i18n';

/**
 * Server-side quoting.
 *
 * The cart lives in the browser, but it only ever holds product/variant ids and
 * quantities. Prices, minimum quantities and stock are recalculated here — from
 * the authenticated tier — before anything is written to the database.
 */
export type CartLineInput = { productId: string; variantId: string; quantity: number };

export type QuotedLine = {
  productId: string;
  variantId: string;
  productName: string;
  productNameFr: string;
  sku: string;
  colorFr: string;
  colorLocalized: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  available: number;
  image: string | null;
  slug: string;
};

export type Quote = {
  tier: Tier;
  lines: QuotedLine[];
  subtotal: string;
  deliveryFee: string;
  discount: string;
  total: string;
  errors: { code: string; message: string; productId?: string; variantId?: string }[];
};

const DELIVERY_FEE_CENTIMES = 70000; // 700 DA flat delivery, waived above 5 000 DA

export function deliveryFeeFor(subtotalStr: string): string {
  const cents = Math.round(Number(subtotalStr) * 100);
  if (cents <= 0) return '0.00';
  return cents >= 500000 ? '0.00' : (DELIVERY_FEE_CENTIMES / 100).toFixed(2);
}

export async function quoteCart(
  items: CartLineInput[],
  tier: Tier,
  options: { locale?: string; deliveryMethod?: 'DELIVERY' | 'PICKUP'; discount?: string } = {},
): Promise<Quote> {
  const errors: Quote['errors'] = [];
  const lines: QuotedLine[] = [];

  const rawLocale = (options.locale ?? 'fr').toLowerCase();
  const locale: Locale = isLocale(rawLocale) ? rawLocale : 'fr';
  const dict = await getDictionary(locale);

  const merged = new Map<string, CartLineInput>();
  for (const item of items) {
    const key = `${item.productId}:${item.variantId}`;
    const existing = merged.get(key);
    if (existing) existing.quantity += item.quantity;
    else merged.set(key, { ...item });
  }

  const productIds = [...new Set([...merged.values()].map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: {
      translations: true,
      variants: true,
      images: { orderBy: { sortOrder: 'asc' } },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  for (const item of merged.values()) {
    const product = byId.get(item.productId);
    if (!product) {
      errors.push({ code: 'NOT_FOUND', message: dict.product.notFound, productId: item.productId });
      continue;
    }
    if (product.status !== 'AVAILABLE' && product.status !== 'OUT_OF_STOCK') {
      errors.push({ code: 'UNAVAILABLE', message: dict.cart.lineUnavailable, productId: product.id });
      continue;
    }
    const variant = product.variants.find((v) => v.id === item.variantId);
    if (!variant || !variant.isActive) {
      errors.push({ code: 'VARIANT', message: dict.cart.lineUnavailable, productId: product.id });
      continue;
    }

    const rule = priceRuleFor(
      {
        retailPrice: Number(product.retailPrice),
        wholesalePrice: Number(product.wholesalePrice),
        superWholesalePrice: Number(product.superWholesalePrice),
        wholesaleMinQty: product.wholesaleMinQty,
        superWholesaleMinQty: product.superWholesaleMinQty,
      },
      tier,
    );

    if (item.quantity < rule.minQuantity) {
      errors.push({
        code: 'MIN_QTY',
        message: interpolate(dict.product.quantityBelowMin, { count: rule.minQuantity }),
        productId: product.id,
        variantId: variant.id,
      });
    }

    const available = Math.max(0, variant.stockQuantity - variant.reservedQuantity);
    if (item.quantity > available) {
      errors.push({
        code: 'STOCK',
        message: interpolate(dict.product.lowStock, { count: available }),
        productId: product.id,
        variantId: variant.id,
      });
    }

    const lineCents = Math.round(Number(rule.unitPrice) * 100) * item.quantity;
    const frName = product.translations.find((t) => t.locale === 'FR')?.name ?? product.sku;
    const localeName =
      product.translations.find((t) => t.locale?.toUpperCase() === locale.toUpperCase())?.name ?? frName;
    const colorLocalized =
      locale === 'ar'
        ? variant.colorNameAr || variant.colorNameFr
        : locale === 'en'
          ? variant.colorNameEn || variant.colorNameFr
          : variant.colorNameFr;

    lines.push({
      productId: product.id,
      variantId: variant.id,
      productName: localeName,
      productNameFr: frName,
      sku: variant.sku,
      colorFr: variant.colorNameFr,
      colorLocalized,
      quantity: item.quantity,
      unitPrice: rule.unitPrice,
      lineTotal: (lineCents / 100).toFixed(2),
      available,
      image: variant.image ?? product.images[0]?.url ?? null,
      slug: product.slug,
    });
  }

  const subtotalCents = lines.reduce((sum, line) => sum + Math.round(Number(line.lineTotal) * 100), 0);
  const subtotal = (subtotalCents / 100).toFixed(2);
  const deliveryFee =
    options.deliveryMethod === 'PICKUP' ? '0.00' : deliveryFeeFor(subtotal);
  const discountCents = Math.round(Number(options.discount ?? 0) * 100);
  const total = ((subtotalCents - discountCents + Math.round(Number(deliveryFee) * 100)) / 100).toFixed(2);

  return {
    tier,
    lines,
    subtotal,
    deliveryFee,
    discount: toDecimalString(options.discount ?? 0),
    total,
    errors,
  };
}

/** Guard used by every mutation that receives a price from the browser. */
export function assertPriceMatches(expected: string, received: string) {
  if (toDecimalString(expected) !== toDecimalString(received)) {
    throw new AppError('CONFLICT', 'Price changed since the cart was loaded. Please refresh.', 409);
  }
}
