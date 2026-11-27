import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/locale';
import { getDictionary, translate } from '@/lib/i18n';
import { CategoryManager } from '@/components/admin/category-manager';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  const categories = await prisma.category.findMany({
    include: { translations: true, _count: { select: { products: true } } },
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <CategoryManager
      locale={locale}
      labels={dict.admin.categories}
      categories={categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        image: category.image ?? '',
        isActive: category.isActive,
        sortOrder: category.sortOrder,
        productCount: category._count.products,
        nameLocalized: translate(category.translations, locale),
        translations: ['FR', 'AR', 'EN'].map((code) => {
          const found = category.translations.find((t) => t.locale === code);
          return { locale: code as 'FR' | 'AR' | 'EN', name: found?.name ?? '', description: found?.description ?? '' };
        }),
      }))}
    />
  );
}
