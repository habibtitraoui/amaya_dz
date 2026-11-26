'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2, ArrowRight, AlertTriangle, Truck, PackageCheck } from 'lucide-react';
import { updateOrderStatusAction } from '@/app/actions/admin';
import { nextStatuses, type OrderStatus } from '@/lib/pricing';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LABELS: Record<OrderStatus, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PREPARING: 'En préparation',
  READY: 'Prête',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
};

export function OrderActions({
  orderId,
  status,
  stockIssues,
  labels,
}: {
  orderId: string;
  status: string;
  stockIssues: number;
  labels: { title: string; confirm: string; cancel: string; next: string; note: string; stockWarning: string; error: string };
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const current = status as OrderStatus;
  const options = nextStatuses(current);

  async function change(to: OrderStatus) {
    setPending(to);
    setError(null);
    try {
      const result = await updateOrderStatusAction({ orderId, status: to, note: note || undefined });
      if (result.ok) {
        setNote('');
        router.refresh();
      } else {
        setError(result.error);
      }
    } finally {
      setPending(null);
    }
  }

  if (options.length === 0) {
    return (
      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <h2 className="text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">{labels.title}</h2>
        <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-500">
          <PackageCheck className="h-4 w-4 text-emerald-500" />
          {LABELS[current]} — statut final
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
      <h2 className="mb-3 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">{labels.title}</h2>

      {current === 'PENDING' && (
        <Button
          type="button"
          className="w-full"
          onClick={() => change('CONFIRMED')}
          disabled={pending !== null || stockIssues > 0}
        >
          {pending === 'CONFIRMED' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          {labels.confirm}
        </Button>
      )}

      {stockIssues > 0 && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-[11px] font-medium text-red-700">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {labels.stockWarning}
        </p>
      )}

      <div className="mt-3 space-y-1.5">
        {options
          .filter((option) => option !== 'CANCELLED' && !(current === 'PENDING' && option === 'CONFIRMED'))
          .map((option) => {
            const Icon = option === 'SHIPPED' ? Truck : option === 'DELIVERED' ? PackageCheck : ArrowRight;
            return (
              <button
                key={option}
                type="button"
                onClick={() => change(option)}
                disabled={pending !== null}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-[12px] font-semibold text-ink-700 transition-colors hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 disabled:opacity-50',
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5" />
                  {labels.next} {LABELS[option]}
                </span>
                {pending === option && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              </button>
            );
          })}
      </div>

      <div className="mt-3">
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={labels.note}
          rows={2}
          className="w-full rounded-xl border border-ink-200 px-3 py-2 text-[12px] focus:border-brand-300 focus:outline-none focus:ring-4 focus:ring-brand-50"
        />
      </div>

      {options.includes('CANCELLED') && (
        <button
          type="button"
          onClick={() => change('CANCELLED')}
          disabled={pending !== null}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
        >
          {pending === 'CANCELLED' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
          {labels.cancel}
        </button>
      )}

      {error && <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-2 text-[11px] font-medium text-red-700">{error}</p>}
    </div>
  );
}
