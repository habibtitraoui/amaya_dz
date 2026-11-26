'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, KeyRound, Copy, Check, UserX, UserCheck } from 'lucide-react';
import { createCustomerAction, suspendCustomerAction, updateCustomerAction } from '@/app/actions/admin';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { cn } from '@/lib/utils';

export type CustomerFormValues = {
  id?: string;
  name: string;
  email: string;
  phone: string;
  tier: 'WHOLESALE' | 'SUPER_WHOLESALE';
  businessName: string;
  address: string;
  city: string;
  wilaya: string;
  notes: string;
  status?: 'ACTIVE' | 'SUSPENDED';
};

export function CustomerForm({ initial }: { initial: CustomerFormValues }) {
  const router = useRouter();
  const [form, setForm] = React.useState(initial);
  const [password, setPassword] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [temporary, setTemporary] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  function set<K extends keyof CustomerFormValues>(key: K, value: CustomerFormValues[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const payload = { ...form, password: form.id ? undefined : password, resetPassword: Boolean(form.id && password) };
      const result = form.id ? await updateCustomerAction(payload) : await createCustomerAction(payload);
      if (result.ok) {
        const data = result.data as { id?: string; temporaryPassword?: string } | undefined;
        if (data?.temporaryPassword) {
          setTemporary(data.temporaryPassword);
          setPassword('');
        }
        if (!form.id && data?.id) {
          router.push(`/admin/customers/${data.id}`);
        } else {
          router.refresh();
        }
      } else {
        setError(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  async function toggleStatus() {
    if (!form.id) return;
    const next = form.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const result = await suspendCustomerAction({ id: form.id, status: next });
    if (result.ok) {
      set('status', next);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-4 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Identité</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nom complet" required>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} required />
            </Field>
            <Field label="Email (identifiant)" required>
              <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} required dir="ltr" />
            </Field>
            <Field label="Téléphone">
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} dir="ltr" placeholder="05xx xx xx xx" />
            </Field>
            <Field label="Raison sociale">
              <Input value={form.businessName} onChange={(e) => set('businessName', e.target.value)} placeholder="Boutique…" />
            </Field>
          </div>
        </section>

        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-4 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Adresse</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Adresse">
              <Input value={form.address} onChange={(e) => set('address', e.target.value)} />
            </Field>
            <Field label="Ville">
              <Input value={form.city} onChange={(e) => set('city', e.target.value)} />
            </Field>
            <Field label="Wilaya">
              <Input value={form.wilaya} onChange={(e) => set('wilaya', e.target.value)} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Notes internes">
              <Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} />
            </Field>
          </div>
        </section>
      </div>

      <aside className="space-y-4">
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-3 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Tarification</h2>
          <Field label="Palier de prix">
            <Select value={form.tier} onChange={(e) => set('tier', e.target.value as CustomerFormValues['tier'])}>
              <option value="WHOLESALE">Gros — quantité min. 5</option>
              <option value="SUPER_WHOLESALE">Super gros — quantité min. 10</option>
            </Select>
          </Field>
          <p className="mt-2 rounded-lg bg-ink-50 px-3 py-2 text-[10.5px] leading-relaxed text-ink-500">
            Le palier détermine les prix et quantités minimums appliqués côté serveur à chaque commande.
          </p>

          <div className="mt-4 border-t border-ink-100 pt-4">
            <Field label={form.id ? 'Réinitialiser le mot de passe' : 'Mot de passe'} hint={form.id ? 'Laisser vide pour conserver' : 'Ou générer automatiquement'}>
              <Input type="text" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={form.id ? '••••••••' : 'auto si vide'} dir="ltr" />
            </Field>
          </div>
        </section>

        {temporary && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-700">Mot de passe temporaire</p>
            <div className="mt-1.5 flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-white px-2.5 py-1.5 text-[13px] font-bold text-ink-900" dir="ltr">{temporary}</code>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(temporary); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="grid h-8 w-8 place-items-center rounded-lg bg-white text-emerald-600 hover:bg-emerald-100"
                aria-label="Copy"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-emerald-700">
              Communiquez-le au client — il n’est plus affiché ensuite.
            </p>
          </div>
        )}

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-[11.5px] font-medium text-red-700">{error}</p>}

        <div className="space-y-2">
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {initial.id ? 'Enregistrer' : 'Créer le compte'}
          </Button>
          {initial.id && (
            <button
              type="button"
              onClick={toggleStatus}
              className={cn(
                'flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-[12px] font-semibold transition-colors',
                form.status === 'ACTIVE'
                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
              )}
            >
              {form.status === 'ACTIVE' ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
              {form.status === 'ACTIVE' ? 'Suspendre le compte' : 'Réactiver le compte'}
            </button>
          )}
          {!initial.id && (
            <p className="flex items-start gap-1.5 text-[10px] leading-relaxed text-ink-400">
              <KeyRound className="mt-0.5 h-3 w-3 shrink-0" />
              Aucune inscription publique : seuls les comptes créés par le personnel peuvent commander au tarif de gros.
            </p>
          )}
        </div>
      </aside>
    </form>
  );
}
