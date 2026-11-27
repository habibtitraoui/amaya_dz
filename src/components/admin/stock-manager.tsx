'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, History, Search } from 'lucide-react';
import { adjustStockAction } from '@/app/actions/admin';
import { Badge } from '@/components/ui/badge';
import type { Dictionary, Locale } from '@/lib/i18n';
import { formatDateTime, cn } from '@/lib/utils';

export function StockManager({
  variants,
  movements,
  locale = 'fr',
  labels,
  searchAriaLabel = 'Search',
}: {
  variants: {
    id: string;
    sku: string;
    productName: string;
    colorName: string;
    colorCode: string;
    stockQuantity: number;
    reservedQuantity: number;
    recentMovements: { id: string; type: string; quantity: number; resulting: number; createdAt: string; user: string; reason: string | null }[];
  }[];
  movements: { id: string; type: string; quantity: number; resulting: number; createdAt: string; variantSku: string; productName: string; user: string; reason: string | null }[];
  locale?: Locale;
  labels: Dictionary['admin']['stock'];
  searchAriaLabel?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState('');
  const [delta, setDelta] = React.useState<Record<string, string>>({});
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const filtered = variants.filter((variant) =>
    `${variant.productName} ${variant.sku} ${variant.colorName}`.toLowerCase().includes(search.toLowerCase()),
  );

  async function adjust(variantId: string) {
    const value = Number(delta[variantId] ?? 0);
    if (!Number.isFinite(value) || value === 0) return;
    setPending(variantId);
    setError(null);
    try {
      const result = await adjustStockAction({ variantId, delta: value, reason: labels.manualReason });
      if (result.ok) {
        setDelta((current) => ({ ...current, [variantId]: '' }));
        router.refresh();
      } else {
        setError(result.error);
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink-900">{labels.title}</h1>
          <p className="text-[12.5px] text-ink-500">
            {labels.subtitle.replace('{count}', String(variants.length))}
          </p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={labels.searchPlaceholder}
            aria-label={searchAriaLabel}
            className="h-10 w-64 rounded-xl border border-ink-200 bg-white ps-9 pe-3 text-[12.5px] focus:border-brand-300 focus:outline-none focus:ring-4 focus:ring-brand-50"
          />
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{error}</p>}

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/60 text-[10px] uppercase tracking-wider text-ink-400">
                  <th className="px-4 py-2.5 text-start font-bold">{labels.colProduct}</th>
                  <th className="px-3 py-2.5 text-center font-bold">{labels.colStock}</th>
                  <th className="px-3 py-2.5 text-center font-bold">{labels.colReserved}</th>
                  <th className="px-3 py-2.5 text-center font-bold">{labels.colAvailable}</th>
                  <th className="px-4 py-2.5 text-end font-bold">{labels.colAdjust}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {filtered.map((variant) => {
                  const available = Math.max(0, variant.stockQuantity - variant.reservedQuantity);
                  return (
                    <tr key={variant.id}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="h-5 w-5 shrink-0 rounded-full ring-1 ring-inset ring-black/10" style={{ backgroundColor: variant.colorCode }} />
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-semibold text-ink-900">{variant.productName}</p>
                            <p className="text-[10px] text-ink-400">
                              {variant.colorName} · <span dir="ltr">{variant.sku}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-center text-[12px] font-bold text-ink-900 tabular-nums">{variant.stockQuantity}</td>
                      <td className="px-3 py-2.5 text-center text-[11.5px] text-amber-700 tabular-nums">{variant.reservedQuantity}</td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge tone={available === 0 ? 'danger' : available <= 5 ? 'warning' : 'success'}>{available}</Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="number"
                            value={delta[variant.id] ?? ''}
                            onChange={(event) => setDelta((current) => ({ ...current, [variant.id]: event.target.value }))}
                            placeholder="±0"
                            dir="ltr"
                            className="h-8 w-16 rounded-lg border border-ink-200 px-2 text-center text-[11.5px] focus:border-brand-300 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => adjust(variant.id)}
                            disabled={pending === variant.id || !delta[variant.id]}
                            className="grid h-8 w-8 place-items-center rounded-lg bg-ink-900 text-white transition-colors hover:bg-ink-800 disabled:opacity-30"
                            aria-label={labels.applyAria}
                          >
                            {pending === variant.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-[12px] text-ink-400">{labels.noVariants}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-3 flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">
            <History className="h-3.5 w-3.5" /> {labels.recentMovements}
          </h2>
          <ul className="space-y-2.5">
            {movements.map((movement) => (
              <li key={movement.id} className="border-b border-ink-50 pb-2 last:border-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-[11.5px] font-semibold text-ink-800">{movement.productName}</p>
                    <p className="text-[10px] text-ink-400" dir="ltr">{movement.variantSku}</p>
                  </div>
                  <span dir="ltr" className={cn('shrink-0 text-[11.5px] font-bold tabular-nums', movement.quantity > 0 ? 'text-emerald-600' : 'text-red-600')}>
                    {movement.quantity > 0 ? '+' : ''}{movement.quantity}
                  </span>
                </div>
                <p className="text-[10px] text-ink-400">
                  {labels.movements[movement.type as keyof typeof labels.movements] ?? movement.type} · {formatDateTime(movement.createdAt, locale)} · {movement.user}
                </p>
              </li>
            ))}
            {movements.length === 0 && <li className="text-[11.5px] text-ink-400">{labels.noMovements}</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
