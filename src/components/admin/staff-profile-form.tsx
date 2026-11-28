'use client';

import * as React from 'react';
import { Loader2, Check } from 'lucide-react';
import { updateOwnStaffProfileAction } from '@/app/actions/account';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

export function StaffProfileForm({
  initial,
  labels,
}: {
  initial: { name: string; email: string; role: string };
  labels: {
    role: string;
    name: string;
    email: string;
    save: string;
    saving: string;
    updated: string;
    error: string;
  };
}) {
  const [name, setName] = React.useState(initial.name);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const result = await updateOwnStaffProfileAction({ name });
      setMessage(result.ok ? { type: 'ok', text: labels.updated } : { type: 'error', text: labels.error });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <div className="rounded-xl bg-ink-50 px-3 py-2.5">
        <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-400">{labels.role}</p>
        <p className="text-[12.5px] font-bold text-ink-900">{initial.role}</p>
      </div>

      <Field label={labels.email}>
        <Input value={initial.email} disabled readOnly dir="ltr" />
      </Field>
      <Field label={labels.name} required>
        <Input value={name} onChange={(event) => setName(event.target.value)} required />
      </Field>

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
