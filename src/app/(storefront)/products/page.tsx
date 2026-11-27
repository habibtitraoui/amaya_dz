import type { Metadata } from 'next';
import Link from '@/components/ui/navigation-link';
import { SlidersHorizontal, PackageSearch, X } from 'lucide-react';
import { getLocale } from '@/lib/locale';
import { getDictionary, t as interpolate } from '@/lib/i18n';
import { getTier } from '@/lib/auth';
import { listCategories, listProducts } from '@/lib/services/catalog';
import { ProductCard, ProductGrid } from '@/components/storefront/product-card';
import { CatalogFilters } from '@/components/storefront/catalog-filters';
import { Pagination } from '@/components/storefront/pagination';
import { EmptyState } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  return { title: dict.nav.products, description: dict.catalog.subtitle };
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const tier = await getTier();

  const category = first(params.category);
  const search = first(params.q);
  const sort = (first(params.sort) ?? 'newest') as 'newest' | 'price_asc' | 'price_desc' | 'best_selling' | 'name';
  const inStockOnly = first(params.stock) === '1';
  const minPrice = first(params.min) ? Number(first(params.min)) : undefined;
  const maxPrice = first(params.max) ? Number(first(params.max)) : undefined;
  const page = Math.max(1, Number(first(params.page) ?? 1));

  const [categories, result] = await Promise.all([
    listCategories(locale),
    listProducts({
      locale,
      tier,
      category,
      search,
      sort,
      inStockOnly,
      minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
      maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
      page,
      perPage: 12,
    }),
  ]);

  const cardLabels = {
    outOfStock: dict.product.outOfStock,
    lowStock: dict.product.lowStock,
    minQty: dict.product.minQuantityHint,
  };

  const hasFilters = !!(category || search || inStockOnly || minPrice || maxPrice);

  return (
    <div className="container-page py-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <nav className="mb-2 flex items-center gap-1.5 text-[11.5px] text-ink-400">
            <Link href="/" className="hover:text-ink-700">{dict.nav.home}</Link>
            <span>/</span>
            <span className="font-medium text-ink-600">{dict.nav.products}</span>
          </nav>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">{dict.catalog.title}</h1>
          <p className="mt-1 text-[13px] text-ink-500">{dict.catalog.subtitle}</p>
        </div>
        <p className="text-[12.5px] font-semibold text-ink-500">
          {interpolate(dict.catalog.resultsCount, { count: result.total })}
        </p>
      </div>

      <div className="mt-7 grid gap-6 lg:grid-cols-[248px_1fr]">
        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="mb-3 flex items-center justify-between lg:hidden">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-bold text-ink-700">
              <SlidersHorizontal className="h-4 w-4" /> {dict.common.filter}
            </span>
          </div>
          <CatalogFilters
            categories={categories}
            activeCategory={category}
            search={search}
            inStockOnly={inStockOnly}
            minPrice={minPrice}
            maxPrice={maxPrice}
            sort={sort}
            labels={{
              filterCategory: dict.catalog.filterCategory,
              allCategories: dict.catalog.allCategories,
              filterAvailability: dict.catalog.filterAvailability,
              inStockOnly: dict.catalog.inStockOnly,
              priceRange: dict.catalog.priceRange,
              min: dict.catalog.min,
              max: dict.catalog.max,
              apply: dict.catalog.apply,
              clear: dict.common.clearFilters,
              searchPlaceholder: dict.catalog.searchPlaceholder,
              sortBy: dict.catalog.sortBy,
              sorts: {
                newest: dict.catalog.sortNewest,
                price_asc: dict.catalog.sortPriceAsc,
                price_desc: dict.catalog.sortPriceDesc,
                best_selling: dict.catalog.sortBestSelling,
                name: dict.catalog.sortName,
              },
              productsCount: dict.catalog.resultsCount,
            }}
            counts={Object.fromEntries(categories.map((c) => [c.slug, c.productCount]))}
          />
        </aside>

        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {hasFilters && (
              <Link
                href="/products"
                className="inline-flex items-center gap-1 rounded-full bg-ink-900 px-3 py-1.5 text-[11.5px] font-semibold text-white"
              >
                <X className="h-3 w-3" />
                {dict.common.clearFilters}
              </Link>
            )}
          </div>

          {result.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink-200 bg-white">
              <EmptyState
                title={dict.catalog.emptyTitle}
                description={dict.catalog.emptyText}
                icon={<PackageSearch className="h-6 w-6" />}
                action={
                  <Link href="/products" className="text-[13px] font-bold text-brand-600 hover:underline">
                    {dict.common.clearFilters}
                  </Link>
                }
              />
            </div>
          ) : (
            <ProductGrid className={cn('md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4')}>
              {result.items.map((product) => (
                <ProductCard key={product.id} product={product} locale={locale} labels={cardLabels} />
              ))}
            </ProductGrid>
          )}

          {result.totalPages > 1 && (
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              searchParams={params}
              labels={{ previous: dict.common.previous, next: dict.common.next, page: dict.catalog.page }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
