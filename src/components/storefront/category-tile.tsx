import Link from 'next/link';
import Image from 'next/image';
import { Layers } from 'lucide-react';

export function CategoryTile({
  category,
  countLabel,
}: {
  category: { slug: string; name: string; image: string | null; productCount: number };
  countLabel: string;
}) {
  return (
    <Link
      href={`/categories/${category.slug}`}
      className="group flex flex-col items-center gap-2.5 rounded-2xl border border-ink-100 bg-white p-3 text-center transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card"
    >
      <div className="relative grid aspect-square w-full place-items-center overflow-hidden rounded-xl bg-ink-50">
        {category.image ? (
          <Image
            src={category.image}
            alt={category.name}
            fill
            sizes="120px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <Layers className="h-6 w-6 text-ink-300" />
        )}
      </div>
      <div>
        <p className="line-clamp-2 text-[12px] font-bold leading-tight text-ink-900 group-hover:text-brand-600">
          {category.name}
        </p>
        <p className="mt-0.5 text-[10.5px] text-ink-400">{countLabel.replace('{count}', String(category.productCount))}</p>
      </div>
    </Link>
  );
}
