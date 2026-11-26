import Link from 'next/link';
import Image from 'next/image';
import { ImageOff } from 'lucide-react';
import { Price } from '@/components/ui/price';
import { Badge } from '@/components/ui/badge';
import type { ProductCardView } from '@/lib/serializers';
import type { Locale } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export function ProductCard({
  product,
  locale,
  labels,
  className,
}: {
  product: ProductCardView;
  locale: Locale;
  labels: { outOfStock: string; lowStock: string; minQty: string };
  className?: string;
}) {
  const isOut = product.totalAvailable <= 0 || product.status === 'OUT_OF_STOCK';
  const isLow = !isOut && product.totalAvailable <= 5;
  const effective = product.prices.effective;
  const hasTierPrice =
    Number(effective.unitPrice) < Number(product.prices.retail.unitPrice) ||
    product.prices.wholesale !== null ||
    product.prices.superWholesale !== null;

  return (
    <Link
      href={`/products/${product.slug}`}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white transition-all duration-300 hover:-translate-y-0.5 hover:border-ink-200 hover:shadow-[0_18px_40px_-20px_rgba(23,24,29,0.28)]',
        className,
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-ink-50/70">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="grid h-full place-items-center text-ink-300">
            <ImageOff className="h-8 w-8" />
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          {isOut ? (
            <Badge tone="neutral" className="bg-ink-900/85 text-white ring-0 backdrop-blur">{labels.outOfStock}</Badge>
          ) : isLow ? (
            <Badge tone="warning" className="bg-white/95 ring-0 backdrop-blur">{labels.lowStock.replace('{count}', String(product.totalAvailable))}</Badge>
          ) : (
            <span />
          )}
          {product.isFeatured && (
            <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
              ★
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        {product.categoryName && (
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            {product.categoryName}
          </span>
        )}
        <h3 className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-ink-900 transition-colors group-hover:text-brand-600">
          {product.name}
        </h3>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <div>
            <Price value={effective.unitPrice} locale={locale} className="text-[15px] font-bold text-ink-900" />
            {hasTierPrice && (
              <p className="mt-0.5 text-[10.5px] font-medium text-brand-600">
                {labels.minQty.replace('{count}', String(effective.minQuantity))}
              </p>
            )}
          </div>
          {product.prices.wholesale && (
            <span className="text-[10px] font-semibold text-ink-400" dir="ltr">
              {product.prices.wholesale.unitPrice}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ProductGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4', className)}>{children}</div>
  );
}
