'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavigationIndicator } from '@/components/ui/navigation-link';

type Category = { id: string; slug: string; name: string; productCount: number };

export function CatalogFilters({
  categories,
  activeCategory,
  search,
  inStockOnly,
  minPrice,
  maxPrice,
  sort,
  labels,
  counts,
}: {
  categories: Category[];
  activeCategory?: string;
  search?: string;
  inStockOnly: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort: string;
  counts: Record<string, number>;
  labels: {
    filterCategory: string;
    allCategories: string;
    filterAvailability: string;
    inStockOnly: string;
    priceRange: string;
    min: string;
    max: string;
    apply: string;
    clear: string;
    searchPlaceholder: string;
    sortBy: string;
    sorts: Record<string, string>;
    productsCount: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const params = useSearchParams();
  const [term, setTerm] = React.useState(search ?? '');
  const [min, setMin] = React.useState(minPrice?.toString() ?? '');
  const [max, setMax] = React.useState(maxPrice?.toString() ?? '');
  const [openSort, setOpenSort] = React.useState(false);

  function push(next: Record<string, string | undefined>) {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (!value) query.delete(key);
      else query.set(key, value);
    }
    query.delete('page');
    startTransition(() => router.push(`/products${query.toString() ? `?${query.toString()}` : ''}`));
  }

  return (
    <div className="space-y-5">
      <NavigationIndicator pending={pending} />
      {/* desktop search */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          push({ q: term || undefined });
        }}
        className="relative"
      >
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder={labels.searchPlaceholder}
          className="h-11 w-full rounded-xl border border-ink-200 bg-white ps-9 pe-3 text-[13px] focus:border-brand-300 focus:outline-none focus:ring-4 focus:ring-brand-50"
        />
      </form>

      {/* sort */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenSort((value) => !value)}
          className="flex h-11 w-full items-center justify-between rounded-xl border border-ink-200 bg-white px-3 text-[13px] font-medium text-ink-700"
        >
          <span className="text-ink-400">{labels.sortBy}:</span>
          <span className="flex items-center gap-1.5">
            {labels.sorts[sort] ?? labels.sorts.newest}
            <ChevronDown className={cn('h-3.5 w-3.5 text-ink-400 transition-transform', openSort && 'rotate-180')} />
          </span>
        </button>
        {openSort && (
          <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl border border-ink-150 bg-white p-1 shadow-xl animate-fade-in">
            {Object.entries(labels.sorts).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => {
                  setOpenSort(false);
                  push({ sort: value === 'newest' ? undefined : value });
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition-colors',
                  sort === value ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-ink-50',
                )}
              >
                {label}
                {sort === value && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* categories */}
      <div className="rounded-2xl border border-ink-100 bg-white p-4">
        <h3 className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-400">{labels.filterCategory}</h3>
        <div className="flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">
          <button
            type="button"
            onClick={() => push({ category: undefined })}
            className={cn(
              'flex items-center justify-between rounded-lg px-2.5 py-1.5 text-start text-[12.5px] transition-colors',
              !activeCategory ? 'bg-brand-50 font-bold text-brand-700' : 'text-ink-600 hover:bg-ink-50',
            )}
          >
            {labels.allCategories}
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => push({ category: category.slug })}
              className={cn(
                'flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-start text-[12.5px] transition-colors',
                activeCategory === category.slug ? 'bg-brand-50 font-bold text-brand-700' : 'text-ink-600 hover:bg-ink-50',
              )}
            >
              <span className="truncate">{category.name}</span>
              <span className={cn('shrink-0 text-[10.5px] tabular-nums', activeCategory === category.slug ? 'text-brand-500' : 'text-ink-300')}>
                {counts[category.slug] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* availability */}
      <div className="rounded-2xl border border-ink-100 bg-white p-4">
        <h3 className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-400">{labels.filterAvailability}</h3>
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] font-medium text-ink-700">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(event) => push({ stock: event.target.checked ? '1' : undefined })}
            className="h-4 w-4 rounded border-ink-300 accent-brand-500"
          />
          {labels.inStockOnly}
        </label>
      </div>

      {/* price */}
      <div className="rounded-2xl border border-ink-100 bg-white p-4">
        <h3 className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-400">{labels.priceRange}</h3>
        <div className="flex items-center gap-2">
          <input
            inputMode="numeric"
            value={min}
            onChange={(event) => setMin(event.target.value.replace(/\D/g, ''))}
            placeholder={labels.min}
            className="h-9 w-full rounded-lg border border-ink-200 px-2.5 text-[12.5px] focus:border-brand-300 focus:outline-none"
          />
          <span className="text-ink-300">–</span>
          <input
            inputMode="numeric"
            value={max}
            onChange={(event) => setMax(event.target.value.replace(/\D/g, ''))}
            placeholder={labels.max}
            className="h-9 w-full rounded-lg border border-ink-200 px-2.5 text-[12.5px] focus:border-brand-300 focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => push({ min: min || undefined, max: max || undefined })}
          className="mt-2.5 h-9 w-full rounded-lg bg-ink-900 text-[12px] font-bold text-white transition-colors hover:bg-ink-800"
        >
          {labels.apply}
        </button>
      </div>
    </div>
  );
}
