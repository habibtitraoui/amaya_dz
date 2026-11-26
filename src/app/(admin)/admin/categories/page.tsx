import { prisma } from '@/lib/prisma';
import { translate } from '@/lib/i18n';
import { CategoryManager } from '@/components/admin/category-manager';

export const dynamic = 'force-dynamic';

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    include: { translations: true, _count: { select: { products: true } } },
    orderBy: { sortOrder: 'asc' },
  });

  return (
    <CategoryManager
      categories={categories.map((category) => ({
        id: category.id,
        slug: category.slug,
        image: category.image ?? '',
        isActive: category.isActive,
        sortOrder: category.sortOrder,
        productCount: category._count.products,
        nameFr: translate(category.translations, 'fr'),
        translations: ['FR', 'AR', 'EN'].map((locale) => {
          const found = category.translations.find((t) => t.locale === locale);
          return { locale: locale as 'FR' | 'AR' | 'EN', name: found?.name ?? '', description: found?.description ?? '' };
        }),
      }))}
    />
  );
}
