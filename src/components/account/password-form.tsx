'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { changePasswordAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

export function PasswordForm({
  labels,
}: {
  labels: { current: string; next: string; confirm: string; save: string; mismatch: string; tooShort: string; wrong: string; changed: string };
}) {
  const [form, setForm] = React.useState({ current: '', next: '', confirm: '' });
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: 'ok' | 'error'; text: string } | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (form.next !== form.confirm) {
      setMessage({ type: 'error', text: labels.mismatch });
      return;
    }
    if (form.next.length < 8) {
      setMessage({ type: 'error', text: labels.tooShort });
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const result = await changePasswordAction(form);
      if (result.ok) {
        setMessage({ type: 'ok', text: labels.changed });
        setForm({ current: '', next: '', confirm: '' });
      } else if (result.error === 'mismatch') {
        setMessage({ type: 'error', text: labels.mismatch });
      } else if (result.error === 'wrong') {
        setMessage({ type: 'error', text: labels.wrong });
      } else {
        setMessage({ type: 'error', text: labels.tooShort });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3.5">
      <Field label={labels.current} required>
        <Input
          type="password"
          value={form.current}
          onChange={(event) => setForm((c) => ({ ...c, current: event.target.value }))}
          autoComplete="current-password"
          required
        />
      </Field>
      <Field label={labels.next} required>
        <Input
          type="password"
          value={form.next}
          onChange={(event) => setForm((c) => ({ ...c, next: event.target.value }))}
          autoComplete="new-password"
          required
        />
      </Field>
      <Field label={labels.confirm} required>
        <Input
          type="password"
          value={form.confirm}
          onChange={(event) => setForm((c) => ({ ...c, confirm: event.target.value }))}
          autoComplete="new-password"
          required
        />
      </Field>
      {message && (
        <p className={message.type === 'ok' ? 'rounded-xl bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700' : 'rounded-xl bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700'}>
          {message.text}
        </p>
      )}
      <Button type="submit" size="sm" variant="dark" disabled={pending}>
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {labels.save}
      </Button>
    </form>
  );
}
