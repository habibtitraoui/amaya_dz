'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NavigationIndicator } from '@/components/ui/navigation-link';
import type { Dictionary } from '@/lib/i18n';

const PRESET_KEYS = ['today', 'yesterday', '7d', '30d', 'month', 'lastMonth', 'year', 'all'] as const;

export function RangeFilter({ active, labels }: { active: string; labels: Dictionary['admin']['ranges'] }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const pathname = usePathname();
  const params = useSearchParams();

  function select(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === '30d') next.delete('range');
    else next.set('range', value);
    startTransition(() => router.push(`${pathname}${next.toString() ? `?${next.toString()}` : ''}`));
  }

  return (
    <div className="flex flex-wrap gap-1 rounded-full border border-ink-200 bg-white p-1">
      <NavigationIndicator pending={pending} />
      {PRESET_KEYS.map((value) => (
        <button
          key={value}
          type="button"
          onClick={() => select(value)}
          className={cn(
            'rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
            active === value ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800',
          )}
        >
          {labels[value]}
        </button>
      ))}
    </div>
  );
}
