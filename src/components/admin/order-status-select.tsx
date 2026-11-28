'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { updateOrderStatusAction } from '@/app/actions/admin';
import { ORDER_STATUSES, ORDER_STATUS_TONE, canTransition, nextStatuses, type OrderStatus } from '@/lib/pricing';
import { tones, type Tone } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Status dropdown embedded in the orders table row: picks a new status and
 * persists it straight away via `updateOrderStatusAction`. Only transitions
 * allowed by the order workflow are selectable — the rest are shown disabled
 * so the full lifecycle stays visible. Terminal statuses (delivered/cancelled)
 * render a disabled select since no further transition exists.
 */
export function OrderStatusSelect({
  orderId,
  status,
  statusLabels,
  ariaLabel,
  errorLabel,
}: {
  orderId: string;
  status: string;
  statusLabels: Record<OrderStatus, string>;
  ariaLabel: string;
  errorLabel: string;
}) {
  const router = useRouter();
  const current = status as OrderStatus;
  const tone: Tone = ((ORDER_STATUS_TONE as Record<string, Tone>)[status] ?? 'neutral') as Tone;

  const [value, setValue] = React.useState(status);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Re-sync after a successful save refreshes the server row.
  React.useEffect(() => setValue(status), [status]);

  React.useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(timer);
  }, [error]);

  const disabled = pending || nextStatuses(current).length === 0;

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const to = event.target.value as OrderStatus;
    if (to === current) return;
    setValue(to);
    setPending(true);
    setError(null);
    try {
      const result = await updateOrderStatusAction({ orderId, status: to });
      if (result.ok) {
        router.refresh();
      } else {
        setValue(status);
        setError(result.error || errorLabel);
      }
    } catch {
      setValue(status);
      setError(errorLabel);
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="relative inline-flex">
        <select
          value={value}
          onChange={handleChange}
          disabled={disabled}
          aria-label={ariaLabel}
          aria-busy={pending || undefined}
          className={cn(
            'cursor-pointer appearance-none rounded-full border-0 py-1 ps-2.5 pe-6 text-[11px] font-semibold',
            'bg-[url(data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20width=%2716%27%20height=%2716%27%20fill=%27none%27%20stroke=%27%236b6e7b%27%20stroke-width=%272%27%20stroke-linecap=%27round%27%3E%3Cpath%20d=%27m4%206%204%204%204-4%27/%3E%3C/svg%3E)] bg-[length:11px] bg-[position:right_7px_center] rtl:bg-[position:left_7px_center] bg-no-repeat',
            'ring-1 ring-inset focus:outline-none focus:ring-2 focus:ring-brand-400/50',
            tones[tone],
            error && 'ring-2 ring-red-300',
            disabled && 'cursor-default opacity-70',
          )}
        >
          {ORDER_STATUSES.map((option) => (
            <option key={option} value={option} disabled={option !== current && !canTransition(current, option)}>
              {statusLabels[option] ?? option}
            </option>
          ))}
        </select>
        {pending && (
          <Loader2 className="pointer-events-none absolute end-1.5 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-current" />
        )}
      </span>
      {error && (
        <span role="alert" className="max-w-[180px] text-[10px] font-medium leading-tight text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
