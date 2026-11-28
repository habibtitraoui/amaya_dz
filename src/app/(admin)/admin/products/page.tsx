import Link from '@/components/ui/navigation-link';
import Image from 'next/image';
import { Plus, Search, Package, Star, ImageOff } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/locale';
import { getDictionary, translate, t as interpolate } from '@/lib/i18n';
import { formatDA } from '@/lib/money';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { DeleteConfirmButton } from '@/components/admin/delete-confirm-button';

export const dynamic = 'force-dynamic';

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = Array.isArray(params.q) ? params.q[0] : params.q;
  const status = Array.isArray(params.status) ? params.status[0] : params.status;

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const copy = dict.admin.products;

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (search?.trim()) {
    where.OR = [
      { sku: { contains: search.trim(), mode: 'insensitive' } },
      { translations: { some: { name: { contains: search.trim(), mode: 'insensitive' } } } },
    ];
  }

  const products = await prisma.product.findMany({
    where: where as never,
    include: {
      translations: true,
      images: { orderBy: { sortOrder: 'asc' }, take: 1 },
      category: { include: { translations: true } },
      variants: { select: { stockQuantity: true, reservedQuantity: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink-900">{copy.title}</h1>
          <p className="text-[12.5px] text-ink-500">{interpolate(copy.subtitle, { count: products.length })}</p>
        </div>
        <div className="flex items-center gap-2">
          <form action="/admin/products" className="relative">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              name="q"
              defaultValue={search}
              placeholder={copy.searchPlaceholder}
              aria-label={dict.common.search}
              className="h-10 w-56 rounded-xl border border-ink-200 bg-white ps-9 pe-3 text-[12.5px] focus:border-brand-300 focus:outline-none focus:ring-4 focus:ring-brand-50"
            />
          </form>
          <ButtonLink href="/admin/products/new" size="sm">
            <Plus className="h-3.5 w-3.5" />
            {copy.newProduct}
          </ButtonLink>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[
          { value: '', label: copy.tabAll },
          { value: 'AVAILABLE', label: copy.tabAvailable },
          { value: 'OUT_OF_STOCK', label: copy.tabOutOfStock },
          { value: 'HIDDEN', label: copy.tabHidden },
          { value: 'ARCHIVED', label: copy.tabArchived },
        ].map((tab) => (
          <Link
            key={tab.value}
            href={tab.value ? `/admin/products?status=${tab.value}` : '/admin/products'}
            className={
              (status ?? '') === tab.value
                ? 'rounded-full bg-ink-900 px-3 py-1.5 text-[11.5px] font-semibold text-white'
                : 'rounded-full border border-ink-200 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-ink-600 hover:border-ink-300'
            }
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-[10px] uppercase tracking-wider text-ink-400">
                <th className="px-4 py-2.5 text-start font-bold">{copy.colProduct}</th>
                <th className="px-4 py-2.5 text-start font-bold">{copy.colCategory}</th>
                <th className="px-4 py-2.5 text-end font-bold">{copy.colRetail}</th>
                <th className="px-4 py-2.5 text-end font-bold">{copy.colWholesale}</th>
                <th className="px-4 py-2.5 text-end font-bold">{copy.colSuperWholesale}</th>
                <th className="px-4 py-2.5 text-center font-bold">{copy.colStock}</th>
                <th className="px-4 py-2.5 text-start font-bold">{copy.colStatus}</th>
                <th className="px-4 py-2.5 text-end font-bold">{copy.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {products.map((product) => {
                const stock = product.variants.reduce(
                  (sum, variant) => sum + Math.max(0, variant.stockQuantity - variant.reservedQuantity),
                  0,
                );
                return (
                  <tr key={product.id} className="transition-colors hover:bg-ink-50/50">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-ink-50">
                          {product.images[0] ? (
                            <Image src={product.images[0].url} alt="" fill sizes="40px" className="object-cover" />
                          ) : (
                            <span className="grid h-full place-items-center text-ink-300"><ImageOff className="h-4 w-4" /></span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link href={`/admin/products/${product.id}`} className="flex items-center gap-1 text-[12.5px] font-semibold text-ink-900 hover:text-brand-600">
                            <span className="truncate">{translate(product.translations, locale) || product.sku}</span>
                            {product.isFeatured && <Star className="h-3 w-3 shrink-0 fill-brand-400 text-brand-400" />}
                          </Link>
                          <p className="text-[10.5px] text-ink-400" dir="ltr">{product.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-[11.5px] text-ink-600">
                      {translate(product.category.translations, locale)}
                    </td>
                    <td className="px-4 py-2.5 text-end text-[11.5px] font-medium text-ink-700 tabular-nums" dir="ltr">{formatDA(product.retailPrice, locale)}</td>
                    <td className="px-4 py-2.5 text-end text-[11.5px] font-medium text-ink-700 tabular-nums" dir="ltr">{formatDA(product.wholesalePrice, locale)}</td>
                    <td className="px-4 py-2.5 text-end text-[11.5px] font-medium text-ink-700 tabular-nums" dir="ltr">{formatDA(product.superWholesalePrice, locale)}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`text-[11.5px] font-bold tabular-nums ${stock === 0 ? 'text-red-600' : stock <= 5 ? 'text-amber-600' : 'text-ink-700'}`}>
                        {stock}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={product.status === 'AVAILABLE' ? 'success' : product.status === 'OUT_OF_STOCK' ? 'danger' : 'neutral'}>
                        {dict.productStatus[product.status as keyof typeof dict.productStatus]}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end">
                        <DeleteConfirmButton
                          entity="product"
                          entityId={product.id}
                          entityName={translate(product.translations, locale) || product.sku}
                          labels={{
                            ariaLabel: copy.deleteAria,
                            title: copy.deleteTitle,
                            message: copy.deleteMessage,
                            confirm: copy.deleteConfirm,
                            cancel: copy.deleteCancel,
                            deleting: copy.deletePending,
                            error: copy.deleteError,
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <Package className="mx-auto h-7 w-7 text-ink-300" />
                    <p className="mt-2 text-[12.5px] text-ink-400">{copy.empty}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
