import 'server-only';
import { prisma } from '@/lib/prisma';
import { type Locale, translate } from '@/lib/i18n';
import { type Tier } from '@/lib/pricing';
import { toProductCard, toProductView } from '@/lib/serializers';

export const PUBLIC_STATUSES = ['AVAILABLE', 'OUT_OF_STOCK'] as const;

const productInclude = {
  translations: true,
  variants: { orderBy: { createdAt: 'asc' } },
  images: { orderBy: { sortOrder: 'asc' } },
  category: { select: { slug: true, translations: true } },
} as const;

export type CatalogQuery = {
  locale: Locale;
  tier: Tier;
  category?: string;
  search?: string;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'best_selling' | 'name';
  inStockOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  perPage?: number;
  featured?: boolean;
};

export type CatalogResult = {
  items: ReturnType<typeof toProductCard>[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
};

export async function listProducts(query: CatalogQuery): Promise<CatalogResult> {
  const page = Math.max(1, query.page ?? 1);
  const perPage = Math.min(48, Math.max(1, query.perPage ?? 12));

  const where: Record<string, unknown> = {
    status: { in: [...PUBLIC_STATUSES] },
  };
  if (query.category) where.category = { slug: query.category };
  if (query.featured) where.isFeatured = true;
  if (query.inStockOnly) {
    where.variants = { some: { isActive: true, stockQuantity: { gt: 0 } } };
  }
  if (query.search && query.search.trim()) {
    const term = query.search.trim();
    where.OR = [
      { sku: { contains: term, mode: 'insensitive' } },
      { translations: { some: { name: { contains: term, mode: 'insensitive' } } } },
      { translations: { some: { description: { contains: term, mode: 'insensitive' } } } },
    ];
  }

  // Price filtering happens on the resolved tier price using the raw columns.
  const priceField =
    query.tier === 'WHOLESALE' ? 'wholesalePrice' : query.tier === 'SUPER_WHOLESALE' ? 'superWholesalePrice' : 'retailPrice';
  if (typeof query.minPrice === 'number' || typeof query.maxPrice === 'number') {
    where[priceField] = {
      ...(typeof query.minPrice === 'number' ? { gte: query.minPrice } : {}),
      ...(typeof query.maxPrice === 'number' ? { lte: query.maxPrice } : {}),
    };
  }

  const orderBy: Record<string, unknown>[] = (() => {
    switch (query.sort) {
      case 'price_asc':
        return [{ [priceField]: 'asc' }];
      case 'price_desc':
        return [{ [priceField]: 'desc' }];
      case 'best_selling':
        return [{ salesCount: 'desc' }, { createdAt: 'desc' }];
      case 'name':
        return [{ sku: 'asc' }];
      case 'newest':
      default:
        return [{ createdAt: 'desc' }];
    }
  })();

  const [rows, total] = await Promise.all([
    prisma.product.findMany({
      where: where as never,
      include: productInclude,
      orderBy: orderBy as never,
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.product.count({ where: where as never }),
  ]);

  const items = rows.map((row) => toProductCard(row as never, query.locale, query.tier));
  // Name sorting has to happen after translation resolution.
  if (query.sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name, query.locale));

  return { items, total, page, perPage, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}

export async function getProductBySlug(slug: string, locale: Locale, tier: Tier) {
  const product = await prisma.product.findFirst({
    where: { slug, status: { in: [...PUBLIC_STATUSES] } },
    include: productInclude,
  });
  if (!product) return null;
  return toProductView(product as never, locale, tier);
}

export async function getRelatedProducts(
  productId: string,
  categorySlug: string | undefined,
  locale: Locale,
  tier: Tier,
  take = 4,
) {
  const rows = await prisma.product.findMany({
    where: {
      id: { not: productId },
      status: { in: [...PUBLIC_STATUSES] },
      ...(categorySlug ? { category: { slug: categorySlug } } : {}),
    },
    include: productInclude,
    orderBy: [{ salesCount: 'desc' }, { createdAt: 'desc' }],
    take,
  });
  return rows.map((row) => toProductCard(row as never, locale, tier));
}

export async function listCategories(locale: Locale) {
  const rows = await prisma.category.findMany({
    where: { isActive: true },
    include: {
      translations: true,
      _count: { select: { products: { where: { status: { in: [...PUBLIC_STATUSES] } } } } },
    },
    orderBy: [{ sortOrder: 'asc' }],
  });
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: translate(row.translations, locale),
    description: translate(row.translations, locale, 'description'),
    image: row.image,
    productCount: row._count.products,
  }));
}

export async function getCategoryBySlug(slug: string, locale: Locale) {
  const row = await prisma.category.findFirst({
    where: { slug, isActive: true },
    include: {
      translations: true,
      _count: { select: { products: { where: { status: { in: [...PUBLIC_STATUSES] } } } } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    name: translate(row.translations, locale),
    description: translate(row.translations, locale, 'description'),
    image: row.image,
    productCount: row._count.products,
  };
}

export async function getHomepageData(locale: Locale, tier: Tier) {
  const [categories, featured, newArrivals, bestSellers] = await Promise.all([
    listCategories(locale),
    listProducts({ locale, tier, featured: true, perPage: 8, sort: 'newest' }),
    listProducts({ locale, tier, perPage: 8, sort: 'newest' }),
    listProducts({ locale, tier, perPage: 4, sort: 'best_selling' }),
  ]);
  return {
    categories: categories.slice(0, 8),
    featured: featured.items,
    newArrivals: newArrivals.items,
    bestSellers: bestSellers.items,
  };
}
