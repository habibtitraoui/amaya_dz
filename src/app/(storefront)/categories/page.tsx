import Link from '@/components/ui/navigation-link';
import Image from 'next/image';
import { Layers, ArrowRight } from 'lucide-react';
import { getLocale } from '@/lib/locale';
import { getDictionary, t as interpolate } from '@/lib/i18n';
import { listCategories } from '@/lib/services/catalog';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const categories = await listCategories(locale);

  return (
    <div className="container-page py-10">
      <nav className="mb-2 flex items-center gap-1.5 text-[11.5px] text-ink-400">
        <Link href="/" className="hover:text-ink-700">{dict.nav.home}</Link>
        <span>/</span>
        <span className="font-medium text-ink-600">{dict.nav.categories}</span>
      </nav>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink-900 sm:text-3xl">{dict.categories.title}</h1>
      <p className="mt-1 text-[13px] text-ink-500">{dict.categories.subtitle}</p>

      {categories.length === 0 ? (
        <p className="mt-12 text-center text-sm text-ink-500">{dict.categories.empty}</p>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/categories/${category.slug}`}
              className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-ink-100 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
            >
              <div className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-ink-50">
                {category.image ? (
                  <Image src={category.image} alt={category.name} fill sizes="80px" className="object-cover transition-transform duration-500 group-hover:scale-110" />
                ) : (
                  <Layers className="h-6 w-6 text-ink-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-bold text-ink-900 group-hover:text-brand-600">{category.name}</h2>
                <p className="mt-0.5 line-clamp-2 text-[12px] text-ink-500">{category.description}</p>
                <p className="mt-1.5 text-[11px] font-semibold text-brand-600">
                  {interpolate(dict.categories.productsCount, { count: category.productCount })}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-500 rtl:rotate-180" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
