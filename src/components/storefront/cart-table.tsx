'use client';

import * as React from 'react';
import Image from 'next/image';
import Link from '@/components/ui/navigation-link';
import { Minus, Plus, Trash2, AlertTriangle, Loader2, ImageOff } from 'lucide-react';
import { useCart } from '@/components/cart-provider';
import { formatDA } from '@/lib/money';
import type { Quote } from '@/lib/services/pricing-service';
import { cn } from '@/lib/utils';

export function CartTable({
  quote,
  labels,
  locale,
}: {
  quote: Quote;
  labels: {
    item: string;
    unitPrice: string;
    quantity: string;
    lineTotal: string;
    remove: string;
    minQtyError: string;
    stockError: string;
    decreaseQuantity: string;
    increaseQuantity: string;
  };
  locale: string;
}) {
  const cart = useCart();
  const [busy, setBusy] = React.useState<string | null>(null);

  const errorFor = (productId: string, variantId: string) =>
    quote.errors.find((error) => error.productId === productId && error.variantId === variantId);

  async function update(productId: string, variantId: string, quantity: number) {
    setBusy(`${productId}:${variantId}`);
    try {
      await cart.update({ productId, variantId, quantity });
    } finally {
      setBusy(null);
    }
  }

  async function remove(productId: string, variantId: string) {
    setBusy(`${productId}:${variantId}`);
    try {
      await cart.remove({ productId, variantId });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
      <div className="hidden grid-cols-[1fr_110px_130px_110px_44px] items-center gap-3 border-b border-ink-100 bg-ink-50/60 px-4 py-2.5 text-[10.5px] font-bold uppercase tracking-wider text-ink-400 sm:grid">
        <span>{labels.item}</span>
        <span className="text-center">{labels.unitPrice}</span>
        <span className="text-center">{labels.quantity}</span>
        <span className="text-end">{labels.lineTotal}</span>
        <span />
      </div>

      <ul className="divide-y divide-ink-100">
        {quote.lines.map((line) => {
          const error = errorFor(line.productId, line.variantId);
          const key = `${line.productId}:${line.variantId}`;
          return (
            <li key={key} className="grid gap-3 p-3.5 sm:grid-cols-[1fr_110px_130px_110px_44px] sm:items-center sm:gap-3">
              <div className="flex items-center gap-3">
                <Link href={`/products/${line.slug}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-ink-50">
                  {line.image ? (
                    <Image src={line.image} alt={line.productName} fill sizes="64px" className="object-cover" />
                  ) : (
                    <span className="grid h-full place-items-center text-ink-300"><ImageOff className="h-5 w-5" /></span>
                  )}
                </Link>
                <div className="min-w-0">
                  <Link href={`/products/${line.slug}`} className="line-clamp-2 text-[13px] font-semibold text-ink-900 hover:text-brand-600">
                    {line.productName}
                  </Link>
                  <p className="mt-0.5 text-[11px] text-ink-400">
                    {line.colorLocalized} · <span dir="ltr">{line.sku}</span>
                  </p>
                  {error && (
                    <p className="mt-1 flex items-start gap-1 text-[11px] font-medium text-red-600">
                      <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                      {error.code === 'MIN_QTY'
                        ? labels.minQtyError.replace('{name}', line.productName).replace('{count}', String(quote.lines.find((l) => l.productId === line.productId)?.quantity ?? ''))
                        : error.code === 'STOCK'
                          ? labels.stockError.replace('{name}', line.productName)
                          : error.message}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-[12.5px] font-semibold text-ink-700 sm:text-center" dir="ltr">
                {formatDA(line.unitPrice, locale)}
              </div>

              <div className="flex items-center justify-start sm:justify-center">
                <div className="flex h-9 items-center rounded-full border border-ink-200">
                  <button
                    type="button"
                    onClick={() => update(line.productId, line.variantId, line.quantity - 1)}
                    disabled={busy === key}
                    className="grid h-9 w-9 place-items-center rounded-full text-ink-600 hover:bg-ink-50 disabled:opacity-40"
                    aria-label={labels.decreaseQuantity}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="grid w-8 place-items-center text-[12.5px] font-bold text-ink-900 tabular-nums" dir="ltr">
                    {busy === key ? <Loader2 className="h-3 w-3 animate-spin text-ink-400" /> : line.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => update(line.productId, line.variantId, line.quantity + 1)}
                    disabled={busy === key}
                    className="grid h-9 w-9 place-items-center rounded-full text-ink-600 hover:bg-ink-50 disabled:opacity-40"
                    aria-label={labels.increaseQuantity}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>

              <div className="text-[13px] font-bold text-ink-900 sm:text-end" dir="ltr">
                {formatDA(line.lineTotal, locale)}
              </div>

              <button
                type="button"
                onClick={() => remove(line.productId, line.variantId)}
                disabled={busy === key}
                aria-label={labels.remove}
                className={cn(
                  'grid h-9 w-9 place-items-center rounded-full text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600 sm:justify-self-end',
                )}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
