'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck, Truck, Store } from 'lucide-react';
import { formatDA } from '@/lib/money';
import { placeOrderAction, finishCheckoutAction } from '@/app/actions/checkout';
import type { Quote } from '@/lib/services/pricing-service';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { WilayaSelect } from '@/components/ui/wilaya-select';
import { cn } from '@/lib/utils';

type Labels = {
  customerInfo: string;
  fullName: string;
  fullNamePlaceholder: string;
  phone: string;
  phonePlaceholder: string;
  address: string;
  addressPlaceholder: string;
  city: string;
  cityPlaceholder: string;
  selectWilaya: string;
  notes: string;
  notesPlaceholder: string;
  deliveryMethod: string;
  deliveryHome: string;
  pickup: string;
  orderSummary: string;
  placeOrder: string;
  placing: string;
  subtotal: string;
  delivery: string;
  deliveryFree: string;
  total: string;
  quantity: string;
  invalidPhone: string;
  errorGeneric: string;
  agreeTerms: string;
  required: string;
};

export function CheckoutForm({
  quote,
  user,
  labels,
  locale,
}: {
  quote: Quote;
  user: { name: string; email: string; phone: string | null; address?: string | null; wilaya?: string | null } | null;
  locale: string;
  labels: Labels;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldError, setFieldError] = React.useState<Record<string, string>>({});
  const [deliveryMethod, setDeliveryMethod] = React.useState<'DELIVERY' | 'PICKUP'>('DELIVERY');

  const [form, setForm] = React.useState({
    name: user?.name ?? '',
    phone: user?.phone ?? '',
    address: user?.address ?? '',
    city: user?.wilaya ?? '',
    notes: '',
  });

  const deliveryFee = deliveryMethod === 'PICKUP' ? '0.00' : quote.deliveryFee;
  const total = (Number(quote.subtotal) - Number(quote.discount) + Number(deliveryFee)).toFixed(2);

  function set(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const nextErrors: Record<string, string> = {};
    if (form.name.trim().length < 2) nextErrors.name = labels.required;
    if (!/^[0-9+\s().-]{8,}$/.test(form.phone.trim())) nextErrors.phone = labels.invalidPhone;
    if (form.address.trim().length < 4) nextErrors.address = labels.required;
    if (Object.keys(nextErrors).length > 0) {
      setFieldError(nextErrors);
      return;
    }
    setFieldError({});
    setPending(true);
    try {
      const result = await placeOrderAction({ ...form, deliveryMethod });
      if (result.ok) {
        await finishCheckoutAction({ orderNumber: result.orderNumber, name: form.name, phone: form.phone });
      } else {
        setError(result.code === 'STOCK' || result.code === 'MIN_QTY' ? result.error : labels.errorGeneric);
        router.refresh();
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : labels.errorGeneric);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-4 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.12em] text-ink-400">
            <ShieldCheck className="h-4 w-4 text-brand-500" />
            {labels.customerInfo}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={labels.fullName} required error={fieldError.name}>
              <Input
                value={form.name}
                onChange={(event) => set('name', event.target.value)}
                placeholder={labels.fullNamePlaceholder}
                autoComplete="name"
                required
              />
            </Field>
            <Field label={labels.phone} required error={fieldError.phone}>
              <Input
                value={form.phone}
                onChange={(event) => set('phone', event.target.value)}
                placeholder={labels.phonePlaceholder}
                autoComplete="tel"
                inputMode="tel"
                dir="ltr"
                required
              />
            </Field>
            <Field label={labels.address} required error={fieldError.address} className="sm:col-span-2">
              <Input
                value={form.address}
                onChange={(event) => set('address', event.target.value)}
                placeholder={labels.addressPlaceholder}
                autoComplete="street-address"
                required
              />
            </Field>
            <Field label={labels.city}>
              <WilayaSelect
                value={form.city}
                onChange={(value) => set('city', value)}
                placeholder={labels.selectWilaya}
                locale={locale}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label={labels.notes}>
              <Textarea
                value={form.notes}
                onChange={(event) => set('notes', event.target.value)}
                placeholder={labels.notesPlaceholder}
                rows={2}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-3 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[0.12em] text-ink-400">
            <Truck className="h-4 w-4 text-brand-500" />
            {labels.deliveryMethod}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { value: 'DELIVERY' as const, icon: Truck, label: labels.deliveryHome },
              { value: 'PICKUP' as const, icon: Store, label: labels.pickup },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setDeliveryMethod(option.value)}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] font-semibold transition-all',
                  deliveryMethod === option.value
                    ? 'border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-100'
                    : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300',
                )}
              >
                <option.icon className="h-4 w-4" />
                {option.label}
              </button>
            ))}
          </div>
        </section>
      </div>

      <aside className="lg:sticky lg:top-28 lg:self-start">
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-ink-400">{labels.orderSummary}</h2>
          <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto pe-1">
            {quote.lines.map((line) => (
              <li key={`${line.productId}:${line.variantId}`} className="flex gap-3">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-[12.5px] font-semibold text-ink-900">{line.productName}</p>
                  <p className="text-[11px] text-ink-400">
                    {line.colorLocalized} × {line.quantity}
                  </p>
                </div>
                <span className="text-[12px] font-bold text-ink-800 tabular-nums" dir="ltr">
                  {formatDA(line.lineTotal, locale)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-4 space-y-2 border-t border-ink-100 pt-4 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-ink-500">{labels.subtotal}</dt>
              <dd className="font-semibold tabular-nums" dir="ltr">{formatDA(quote.subtotal, locale)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-500">{labels.delivery}</dt>
              <dd className="font-semibold tabular-nums" dir="ltr">
                {Number(deliveryFee) === 0 ? labels.deliveryFree : formatDA(deliveryFee, locale)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-ink-100 pt-3 text-[15px]">
              <dt className="font-bold">{labels.total}</dt>
              <dd className="font-extrabold text-brand-600 tabular-nums" dir="ltr">{formatDA(total, locale)}</dd>
            </div>
          </dl>

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{error}</p>
          )}

          <Button type="submit" size="lg" className="mt-5 w-full" disabled={pending}>
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {pending ? labels.placing : labels.placeOrder}
          </Button>
          <p className="mt-3 text-center text-[10.5px] leading-relaxed text-ink-400">{labels.agreeTerms}</p>
        </div>
      </aside>
    </form>
  );
}
