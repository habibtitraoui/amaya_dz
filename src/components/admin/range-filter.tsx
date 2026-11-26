'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';

const PRESETS = [
  { value: 'today', label: 'Aujourd’hui' },
  { value: 'yesterday', label: 'Hier' },
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: 'month', label: 'Ce mois' },
  { value: 'lastMonth', label: 'Mois dernier' },
  { value: 'year', label: 'Cette année' },
  { value: 'all', label: 'Tout' },
];

export function RangeFilter({ active }: { active: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function select(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === '30d') next.delete('range');
    else next.set('range', value);
    router.push(`${pathname}${next.toString() ? `?${next.toString()}` : ''}`);
  }

  return (
    <div className="flex flex-wrap gap-1 rounded-full border border-ink-200 bg-white p-1">
      {PRESETS.map((preset) => (
        <button
          key={preset.value}
          type="button"
          onClick={() => select(preset.value)}
          className={cn(
            'rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-colors',
            active === preset.value ? 'bg-ink-900 text-white' : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800',
          )}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
