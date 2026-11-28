'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogIn, Mail, Lock } from 'lucide-react';
import { loginAction } from '@/app/actions/auth';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

export function LoginForm({
  labels,
  contactEmailHref = 'mailto:contact@amaya.dz',
}: {
  labels: {
    title: string;
    subtitle: string;
    email: string;
    emailPlaceholder: string;
    password: string;
    signIn: string;
    signingIn: string;
    invalidCredentials: string;
    suspended: string;
    noAccount: string;
    noAccountText: string;
    contactUs: string;
  };
  contactEmailHref?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await loginAction({ email, password });
      if (result.ok) {
        router.replace('/account');
        router.refresh();
      } else {
        setError(
          result.error === 'suspended' ? labels.suspended : result.error === 'credentials' ? labels.invalidCredentials : labels.invalidCredentials,
        );
      }
    } catch {
      setError(labels.invalidCredentials);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{labels.title}</h1>
      <p className="mt-1.5 text-[13px] text-ink-500">{labels.subtitle}</p>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <Field label={labels.email} required>
          <div className="relative">
            <Mail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              inputMode="email"
              dir="ltr"
              required
              className="ps-9"
              placeholder={labels.emailPlaceholder}
            />
          </div>
        </Field>
        <Field label={labels.password} required>
          <div className="relative">
            <Lock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="ps-9"
              placeholder="••••••••"
            />
          </div>
        </Field>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700">{error}</p>}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4 rtl:rotate-180" />}
          {pending ? labels.signingIn : labels.signIn}
        </Button>
      </form>

      <div className="mt-6 border-t border-ink-100 pt-4" id="pro">
        <p className="text-[12.5px] font-bold text-ink-800">{labels.noAccount}</p>
        <p className="mt-0.5 text-[12px] text-ink-500">{labels.noAccountText}</p>
        <a href={contactEmailHref} className="mt-2 inline-block text-[12px] font-bold text-brand-600 hover:underline">
          {labels.contactUs} →
        </a>
      </div>
    </div>
  );
}
