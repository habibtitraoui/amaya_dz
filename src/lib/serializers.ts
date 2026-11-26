import type { Tier } from '@/lib/pricing';
import { priceRuleFor, publicPrices } from '@/lib/pricing';
import { translate } from '@/lib/i18n';
import type { Locale } from '@/lib/i18n';

/**
 * Prisma rows → serialisable view models for client components.
 * Decimal columns become fixed-2 strings so they survive the RSC boundary
 * without floating point surprises.
 */

type DbTranslation = { locale: string; name: string; description?: string | null };
type DbVariant = {
  id: string;
  sku: string;
  colorNameFr: string;
  colorNameAr: string;
  colorNameEn: string;
  colorCode: string;
  image: string | null;
  stockQuantity: number;
  reservedQuantity: number;
  isActive: boolean;
};
type DbImage = { url: string; alt: string | null; sortOrder: number };
type DbProduct = {
  id: string;
  slug: string;
  sku: string;
  status: string;
  retailPrice: unknown;
  wholesalePrice: unknown;
  superWholesalePrice: unknown;
  wholesaleMinQty: number;
  superWholesaleMinQty: number;
  isFeatured: boolean;
  salesCount: number;
  createdAt: Date;
  category?: { slug: string; translations: DbTranslation[] } | null;
  translations: DbTranslation[];
  variants: DbVariant[];
  images: DbImage[];
};

export type ProductView = {
  id: string;
  slug: string;
  sku: string;
  name: string;
  description: string;
  status: string;
  isFeatured: boolean;
  salesCount: number;
  createdAt: string;
  image: string | null;
  category: { slug: string; name: string } | null;
  prices: {
    retail: { unitPrice: string; minQuantity: number };
    wholesale: { unitPrice: string; minQuantity: number } | null;
    superWholesale: { unitPrice: string; minQuantity: number } | null;
    effective: { unitPrice: string; minQuantity: number };
  };
  variants: {
    id: string;
    sku: string;
    colorName: string;
    colorCode: string;
    image: string | null;
    available: number;
    isActive: boolean;
  }[];
  totalAvailable: number;
};

export function variantColorName(variant: DbVariant, locale: Locale): string {
  if (locale === 'ar') return variant.colorNameAr || variant.colorNameFr || variant.colorNameEn;
  if (locale === 'en') return variant.colorNameEn || variant.colorNameFr || variant.colorNameAr;
  return variant.colorNameFr || variant.colorNameEn || variant.colorNameAr;
}

function sortImages(images: DbImage[]) {
  return [...images].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function toProductView(product: DbProduct, locale: Locale, tier: Tier): ProductView {
  const images = sortImages(product.images);
  const variants = product.variants.filter((v) => v.isActive);
  const prices = publicPrices(
    {
      retailPrice: Number(product.retailPrice),
      wholesalePrice: Number(product.wholesalePrice),
      superWholesalePrice: Number(product.superWholesalePrice),
      wholesaleMinQty: product.wholesaleMinQty,
      superWholesaleMinQty: product.superWholesaleMinQty,
    },
    tier,
  );
  const firstVariantImage = variants.find((v) => v.image)?.image ?? null;
  return {
    id: product.id,
    slug: product.slug,
    sku: product.sku,
    name: translate(product.translations, locale),
    description: translate(product.translations, locale, 'description'),
    status: product.status,
    isFeatured: product.isFeatured,
    salesCount: product.salesCount,
    createdAt: product.createdAt.toISOString(),
    image: images[0]?.url ?? firstVariantImage ?? null,
    category: product.category
      ? { slug: product.category.slug, name: translate(product.category.translations, locale) }
      : null,
    prices,
    variants: variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      colorName: variantColorName(v, locale),
      colorCode: v.colorCode,
      image: v.image ?? images[0]?.url ?? null,
      available: Math.max(0, v.stockQuantity - v.reservedQuantity),
      isActive: v.isActive,
    })),
    totalAvailable: variants.reduce((sum, v) => sum + Math.max(0, v.stockQuantity - v.reservedQuantity), 0),
  };
}

/** Minimal product card payload (keeps RSC props small). */
export function toProductCard(product: DbProduct, locale: Locale, tier: Tier) {
  const view = toProductView(product, locale, tier);
  return {
    id: view.id,
    slug: view.slug,
    name: view.name,
    image: view.image,
    status: view.status,
    categoryName: view.category?.name ?? null,
    prices: view.prices,
    totalAvailable: view.totalAvailable,
    isFeatured: view.isFeatured,
  };
}

export type ProductCardView = ReturnType<typeof toProductCard>;

export function productPriceFor(product: DbProduct, tier: Tier) {
  return priceRuleFor(
    {
      retailPrice: Number(product.retailPrice),
      wholesalePrice: Number(product.wholesalePrice),
      superWholesalePrice: Number(product.superWholesalePrice),
      wholesaleMinQty: product.wholesaleMinQty,
      superWholesaleMinQty: product.superWholesaleMinQty,
    },
    tier,
  );
}
