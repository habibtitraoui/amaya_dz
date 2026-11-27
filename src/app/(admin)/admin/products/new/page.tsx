import Link from '@/components/ui/navigation-link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/locale';
import { getDictionary, translate } from '@/lib/i18n';
import { ProductForm } from '@/components/admin/product-form';

export const dynamic = 'force-dynamic';

export default async function NewProductPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const copy = dict.admin.products;

  const categories = await prisma.category.findMany({ include: { translations: true }, orderBy: { sortOrder: 'asc' } });

  return (
    <div className="space-y-4">
      <Link href="/admin/products" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
        {copy.backToProducts}
      </Link>
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink-900">{copy.newProduct}</h1>
        <p className="text-[12.5px] text-ink-500">{copy.newSubtitle}</p>
      </div>
      <ProductForm
        locale={locale}
        labels={copy.form}
        productStatusLabels={dict.productStatus}
        currencyLabel={dict.common.currency}
        categories={categories.map((category) => ({ id: category.id, name: translate(category.translations, locale) }))}
        initial={{
          sku: '',
          categoryId: categories[0]?.id ?? '',
          retailPrice: '',
          wholesalePrice: '',
          superWholesalePrice: '',
          wholesaleMinQty: 5,
          superWholesaleMinQty: 10,
          status: 'AVAILABLE',
          isFeatured: false,
          translations: [
            { locale: 'FR', name: '', description: '' },
            { locale: 'AR', name: '', description: '' },
            { locale: 'EN', name: '', description: '' },
          ],
          images: [],
          variants: [],
        }}
      />
    </div>
  );
}
