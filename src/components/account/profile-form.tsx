'use client';

import * as React from 'react';
import { Loader2, Check } from 'lucide-react';
import { updateOwnProfileAction } from '@/app/actions/account';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { WilayaSelect } from '@/components/ui/wilaya-select';

export function ProfileForm({
  initial,
  locale,
  labels,
}: {
  initial: { name: string; phone: string; businessName: string; address: string; city: string; wilaya: string };
  locale?: string;
  labels: {
    name: string;
    phone: string;
    businessName: string;
    address: string;
    city: string;
    wilaya: string;
    selectWilaya?: string;
    save: string;
    saving: string;
    updated: string;
    error: string;
    tier: string;
    tierValue: string;
    tierNote: string;
    email: string;
    emailValue: string;
  };
}) {
  const [form, setForm] = React.useState(initial);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  function set(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const result = await updateOwnProfileAction(form);
      setMessage(result.ok ? { type: 'ok', text: labels.updated } : { type: 'error', text: labels.error });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div className="flex items-center justify-between rounded-xl bg-ink-50 px-3 py-2.5">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-400">{labels.tier}</p>
          <p className="text-[12.5px] font-bold text-ink-900">{labels.tierValue}</p>
        </div>
        <p className="max-w-[52%] text-end text-[10.5px] leading-tight text-ink-400">{labels.tierNote}</p>
      </div>

      <Field label={labels.email}>
        <Input value={labels.emailValue} disabled readOnly dir="ltr" />
      </Field>
      <Field label={labels.name} required>
        <Input value={form.name} onChange={(event) => set('name', event.target.value)} required />
      </Field>
      <Field label={labels.phone}>
        <Input value={form.phone} onChange={(event) => set('phone', event.target.value)} dir="ltr" inputMode="tel" />
      </Field>
      <Field label={labels.businessName}>
        <Input value={form.businessName} onChange={(event) => set('businessName', event.target.value)} />
      </Field>
      <Field label={labels.address}>
        <Input value={form.address} onChange={(event) => set('address', event.target.value)} />
      </Field>
      <div className="grid gap-3.5 sm:grid-cols-2">
        <Field label={labels.city}>
          <Input value={form.city} onChange={(event) => set('city', event.target.value)} />
        </Field>
        <Field label={labels.wilaya}>
          <WilayaSelect
            value={form.wilaya}
            onChange={(value) => set('wilaya', value)}
            placeholder={labels.selectWilaya}
            locale={locale}
          />
        </Field>
      </div>

      {message && (
        <p
          className={
            message.type === 'ok'
              ? 'flex items-center gap-1.5 rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700'
              : 'rounded-xl bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700'
          }
        >
          {message.type === 'ok' && <Check className="h-3.5 w-3.5" />}
          {message.text}
        </p>
      )}

      <Button type="submit" disabled={pending} size="sm">
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {pending ? labels.saving : labels.save}
      </Button>
    </form>
  );
}
