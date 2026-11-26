import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PackageSearch } from 'lucide-react';
import { getLocale } from '@/lib/locale';
import { getDictionary, t as interpolate } from '@/lib/i18n';
import { getTier } from '@/lib/auth';
import { getCategoryBySlug, listProducts } from '@/lib/services/catalog';
import { ProductCard, ProductGrid } from '@/components/storefront/product-card';
import { EmptyState } from '@/components/ui/table';

export const dynamic = 'force-dynamic';

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = await searchParams;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const tier = await getTier();

  const [category, result] = await Promise.all([
    getCategoryBySlug(slug, locale),
    listProducts({
      locale,
      tier,
      category: slug,
      sort: (Array.isArray(query.sort) ? query.sort[0] : query.sort ?? 'newest') as never,
      page: Number(Array.isArray(query.page) ? query.page[0] : query.page ?? 1),
      perPage: 12,
    }),
  ]);
  if (!category) notFound();

  return (
    <div className="container-page py-10">
      <nav className="mb-2 flex items-center gap-1.5 text-[11.5px] text-ink-400">
        <Link href="/" className="hover:text-ink-700">{dict.nav.home}</Link>
        <span>/</span>
        <Link href="/categories" className="hover:text-ink-700">{dict.nav.categories}</Link>
        <span>/</span>
        <span className="font-medium text-ink-600">{category.name}</span>
      </nav>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">{category.name}</h1>
          <p className="mt-1 max-w-xl text-[13px] text-ink-500">{category.description}</p>
        </div>
        <p className="text-[12.5px] font-semibold text-ink-500">
          {interpolate(dict.categories.productsCount, { count: category.productCount })}
        </p>
      </div>

      {result.items.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-ink-200 bg-white">
          <EmptyState
            title={dict.catalog.emptyTitle}
            description={dict.catalog.emptyText}
            icon={<PackageSearch className="h-6 w-6" />}
          />
        </div>
      ) : (
        <ProductGrid className="mt-7 md:grid-cols-2 lg:grid-cols-4">
          {result.items.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              locale={locale}
              labels={{ outOfStock: dict.product.outOfStock, lowStock: dict.product.lowStock, minQty: dict.product.minQuantityHint }}
            />
          ))}
        </ProductGrid>
      )}
    </div>
  );
}
