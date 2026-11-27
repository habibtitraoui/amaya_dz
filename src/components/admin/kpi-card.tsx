import Link from '@/components/ui/navigation-link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const TONES = {
  brand: 'bg-brand-50 text-brand-600 ring-brand-100',
  ink: 'bg-ink-100 text-ink-700 ring-ink-200',
  amber: 'bg-amber-50 text-amber-600 ring-amber-100',
  violet: 'bg-violet-50 text-violet-600 ring-violet-100',
  green: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
  red: 'bg-red-50 text-red-600 ring-red-100',
};

export function KpiCard({
  label,
  value,
  icon,
  tone = 'ink',
  hint,
  href,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  tone?: keyof typeof TONES;
  hint?: string;
  href?: string;
}) {
  const content = (
    <div className="group h-full rounded-2xl border border-ink-100 bg-white p-4 shadow-card transition-all hover:-translate-y-0.5 hover:border-ink-200 hover:shadow-lift">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">{label}</p>
        {icon && <span className={cn('grid h-8 w-8 place-items-center rounded-xl ring-1', TONES[tone])}>{icon}</span>}
      </div>
      <p className="mt-2.5 text-[22px] font-extrabold leading-none tracking-tight text-ink-900 tabular-nums rtl:text-right" dir="ltr">
        {value}
      </p>
      {hint && <p className="mt-2 text-[11px] text-ink-400">{hint}</p>}
    </div>
  );
  return href ? <Link href={href} className="block">{content}</Link> : content;
}
