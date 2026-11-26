import { cn } from '@/lib/utils';
import { formatDA } from '@/lib/money';

export function Price({
  value,
  locale,
  currency = true,
  className,
}: {
  value: string | number;
  locale: string;
  currency?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('font-numeric tabular-nums', className)} dir="ltr">
      {formatDA(value, locale)}
    </span>
  );
}

/** Retail price with a struck-through comparison, used on promo cards. */
export function PriceStack({
  price,
  compareAt,
  locale,
  size = 'md',
}: {
  price: string | number;
  compareAt?: string | number | null;
  locale: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-sm' : 'text-lg';
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <Price value={price} locale={locale} className={cn('font-bold text-ink-900', sizeClass)} />
      {compareAt && Number(compareAt) > Number(price) && (
        <Price value={compareAt} locale={locale} className="text-xs font-medium text-ink-400 line-through" />
      )}
    </div>
  );
}
