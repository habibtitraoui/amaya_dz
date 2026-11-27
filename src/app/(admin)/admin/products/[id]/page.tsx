import Link from '@/components/ui/navigation-link';
import { notFound } from 'next/navigation';
import { ArrowLeft, History } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { ProductForm } from '@/components/admin/product-form';
import { translate } from '@/lib/i18n';
import { formatDateTime } from '@/lib/utils';
import { formatDA } from '@/lib/money';

export const dynamic = 'force-dynamic';

const TIER_FR: Record<string, string> = { RETAIL: 'Détail', WHOLESALE: 'Gros', SUPER_WHOLESALE: 'Super Gros' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        translations: true,
        images: { orderBy: { sortOrder: 'asc' } },
        variants: { orderBy: { createdAt: 'asc' }, where: { isActive: true } },
        priceHistory: { orderBy: { createdAt: 'desc' }, take: 8, include: { changedBy: true } },
      },
    }),
    prisma.category.findMany({ include: { translations: true }, orderBy: { sortOrder: 'asc' } }),
  ]);
  if (!product) notFound();

  return (
    <div className="space-y-4">
      <Link href="/admin/products" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
        Produits
      </Link>
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink-900">
          {translate(product.translations, 'fr')}
        </h1>
        <p className="text-[12.5px] text-ink-500" dir="ltr">{product.sku}</p>
      </div>

      <ProductForm
        slug={product.slug}
        categories={categories.map((category) => ({ id: category.id, name: translate(category.translations, 'fr') }))}
        initial={{
          id: product.id,
          sku: product.sku,
          categoryId: product.categoryId,
          retailPrice: String(product.retailPrice),
          wholesalePrice: String(product.wholesalePrice),
          superWholesalePrice: String(product.superWholesalePrice),
          wholesaleMinQty: product.wholesaleMinQty,
          superWholesaleMinQty: product.superWholesaleMinQty,
          status: product.status,
          isFeatured: product.isFeatured,
          translations: [
            { locale: 'FR' as const, name: '', description: '' },
            { locale: 'AR' as const, name: '', description: '' },
            { locale: 'EN' as const, name: '', description: '' },
          ].map((entry) => {
            const found = product.translations.find((t) => t.locale === entry.locale);
            return { locale: entry.locale, name: found?.name ?? '', description: found?.description ?? '' };
          }),
          images: product.images.map((image) => ({ url: image.url, alt: image.alt ?? '' })),
          variants: product.variants.map((variant) => ({
            id: variant.id,
            sku: variant.sku,
            colorNameFr: variant.colorNameFr,
            colorNameAr: variant.colorNameAr,
            colorNameEn: variant.colorNameEn,
            colorCode: variant.colorCode,
            image: variant.image ?? '',
            stockQuantity: variant.stockQuantity,
          })),
        }}
      />

      {product.priceHistory.length > 0 && (
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-3 flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">
            <History className="h-3.5 w-3.5" /> Historique des prix
          </h2>
          <ul className="divide-y divide-ink-100">
            {product.priceHistory.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 py-2 text-[11.5px]">
                <div>
                  <p className="font-semibold text-ink-800">
                    {TIER_FR[entry.tier]} · {formatDA(entry.oldPrice ?? '0', 'fr')} → {formatDA(entry.newPrice, 'fr')}
                  </p>
                  <p className="text-[10px] text-ink-400">
                    {formatDateTime(entry.createdAt, 'fr')} · {entry.changedBy?.name ?? 'système'}
                  </p>
                </div>
                <span className="text-[10px] text-ink-400">
                  min {entry.oldMinQuantity ?? '—'} → {entry.newMinQuantity}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
