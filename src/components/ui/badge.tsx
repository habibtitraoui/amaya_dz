import * as React from 'react';
import { cn } from '@/lib/utils';
import { ORDER_STATUS_TONE } from '@/lib/pricing';

type Tone = 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'dark' | 'amber' | 'blue' | 'cyan' | 'indigo' | 'green' | 'red';

const tones: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-700 ring-brand-200',
  neutral: 'bg-ink-100 text-ink-700 ring-ink-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  cyan: 'bg-cyan-50 text-cyan-800 ring-cyan-200',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  dark: 'bg-ink-900 text-white ring-ink-900',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
  dot,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset whitespace-nowrap',
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

export function OrderStatusBadge({ status, label }: { status: string; label: string }) {
  const tone = (ORDER_STATUS_TONE as Record<string, Tone>)[status] ?? 'neutral';
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

export function TierBadge({ tier, label }: { tier: string; label: string }) {
  const tone: Tone = tier === 'SUPER_WHOLESALE' ? 'violet' : tier === 'WHOLESALE' ? 'info' : 'neutral';
  return <Badge tone={tone}>{label}</Badge>;
}
