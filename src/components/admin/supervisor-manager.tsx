'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2, ShieldCheck, X, Mail, UserCog, Power } from 'lucide-react';
import { createSupervisorAction, updateSupervisorPermissionsAction } from '@/app/actions/admin';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { formatDate, cn } from '@/lib/utils';

const PERMISSIONS: { key: string; label: string; description: string }[] = [
  { key: 'manageOrders', label: 'Commandes', description: 'Confirmer, préparer, expédier, annuler' },
  { key: 'issueInvoices', label: 'Factures', description: 'Émettre des factures françaises A4' },
  { key: 'manageStock', label: 'Stock', description: 'Ajuster les quantités par variante' },
  { key: 'manageCustomers', label: 'Clients', description: 'Créer les comptes grossistes' },
  { key: 'manageProducts', label: 'Produits', description: 'Créer et modifier le catalogue' },
  { key: 'manageCategories', label: 'Catégories', description: 'Organiser la navigation' },
  { key: 'managePrices', label: 'Prix', description: 'Modifier les trois paliers tarifaires' },
  { key: 'viewReports', label: 'Rapports', description: 'Consulter les statistiques' },
];

type Supervisor = {
  id: string;
  name: string;
  email: string;
  status: 'ACTIVE' | 'SUSPENDED';
  permissions: Record<string, boolean> | null;
  createdAt: string;
  lastLoginAt: string | null;
  actionCount: number;
  invoiceCount: number;
};

export function SupervisorManager({ supervisors }: { supervisors: Supervisor[] }) {
  const router = useRouter();
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<Supervisor | null>(null);
  const [form, setForm] = React.useState({ name: '', email: '', password: '' });
  const [draft, setDraft] = React.useState<Record<string, boolean>>({});
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function openCreate() {
    setForm({ name: '', email: '', password: '' });
    setError(null);
    setCreating(true);
  }

  function openEdit(supervisor: Supervisor) {
    setDraft(
      Object.fromEntries(PERMISSIONS.map((permission) => [permission.key, supervisor.permissions?.[permission.key] ?? true])),
    );
    setError(null);
    setEditing(supervisor);
  }

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await createSupervisorAction(form);
      if (result.ok) {
        setCreating(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  async function save() {
    if (!editing) return;
    setPending(true);
    setError(null);
    try {
      const result = await updateSupervisorPermissionsAction({ id: editing.id, permissions: draft });
      if (result.ok) {
        setEditing(null);
        router.refresh();
      } else {
        setError(result.error);
      }
    } finally {
      setPending(false);
    }
  }

  async function toggleStatus(supervisor: Supervisor) {
    await updateSupervisorPermissionsAction({
      id: supervisor.id,
      permissions: supervisor.permissions ?? {},
      status: supervisor.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
    });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink-900">Superviseurs</h1>
          <p className="text-[12.5px] text-ink-500">
            Le personnel superviseur gère le quotidien ; seuls les administrateurs voient cette page.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> Nouveau superviseur
        </Button>
      </div>

      <div className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
        <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-brand-900">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
          Les permissions sont vérifiées côté serveur à chaque action. Masquer un bouton ne suffit jamais.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {supervisors.map((supervisor) => {
          const granted = PERMISSIONS.filter((permission) => supervisor.permissions?.[permission.key] ?? true);
          return (
            <div key={supervisor.id} className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-ink-900">{supervisor.name}</p>
                  <p className="truncate text-[10.5px] text-ink-400" dir="ltr">{supervisor.email}</p>
                </div>
                <Badge tone={supervisor.status === 'ACTIVE' ? 'success' : 'danger'} dot>
                  {supervisor.status === 'ACTIVE' ? 'Actif' : 'Suspendu'}
                </Badge>
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {granted.slice(0, 5).map((permission) => (
                  <span key={permission.key} className="rounded-md bg-ink-50 px-1.5 py-0.5 text-[9.5px] font-bold text-ink-600">
                    {permission.label}
                  </span>
                ))}
                {granted.length > 5 && (
                  <span className="rounded-md bg-ink-50 px-1.5 py-0.5 text-[9.5px] font-bold text-ink-500">+{granted.length - 5}</span>
                )}
                {granted.length === 0 && <span className="text-[10px] text-red-500">Aucune permission</span>}
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 border-t border-ink-100 pt-2.5 text-[10.5px]">
                <div>
                  <dt className="text-ink-400">Dernière connexion</dt>
                  <dd className="font-semibold text-ink-700">{supervisor.lastLoginAt ? formatDate(supervisor.lastLoginAt, 'fr') : 'jamais'}</dd>
                </div>
                <div>
                  <dt className="text-ink-400">Factures émises</dt>
                  <dd className="font-semibold text-ink-700">{supervisor.invoiceCount}</dd>
                </div>
              </dl>

              <div className="mt-3 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => openEdit(supervisor)}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-ink-100 py-1.5 text-[10.5px] font-bold text-ink-700 hover:bg-ink-200"
                >
                  <UserCog className="h-3 w-3" /> Permissions
                </button>
                <button
                  type="button"
                  onClick={() => toggleStatus(supervisor)}
                  className={cn(
                    'inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-[10.5px] font-bold',
                    supervisor.status === 'ACTIVE' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100',
                  )}
                >
                  <Power className="h-3 w-3" />
                </button>
              </div>
            </div>
          );
        })}
        {supervisors.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-ink-200 py-12 text-center">
            <Mail className="mx-auto h-6 w-6 text-ink-300" />
            <p className="mt-2 text-[12px] text-ink-400">Aucun superviseur — créez le premier compte.</p>
          </div>
        )}
      </div>

      {/* create modal */}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 backdrop-blur-sm">
          <form onSubmit={create} className="my-8 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <h2 className="text-[15px] font-extrabold text-ink-900">Nouveau superviseur</h2>
              <button type="button" onClick={() => setCreating(false)} className="grid h-7 w-7 place-items-center rounded-lg text-ink-400 hover:bg-ink-50"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 space-y-3">
              <Field label="Nom complet" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
              <Field label="Email" required><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required dir="ltr" /></Field>
              <Field label="Mot de passe" required hint="8 caractères minimum"><Input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} dir="ltr" /></Field>
            </div>
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11.5px] text-red-700">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setCreating(false)} className="rounded-full px-4 py-2 text-[12px] font-semibold text-ink-500 hover:bg-ink-50">Annuler</button>
              <Button type="submit" size="sm" disabled={pending}>
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Créer
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* permissions modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-950/50 p-4 backdrop-blur-sm">
          <div className="my-8 w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-[15px] font-extrabold text-ink-900">Permissions</h2>
                <p className="text-[11px] text-ink-400">{editing.name}</p>
              </div>
              <button type="button" onClick={() => setEditing(null)} className="grid h-7 w-7 place-items-center rounded-lg text-ink-400 hover:bg-ink-50"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 space-y-1">
              {PERMISSIONS.map((permission) => (
                <label key={permission.key} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-ink-50">
                  <span>
                    <span className="block text-[12px] font-semibold text-ink-900">{permission.label}</span>
                    <span className="block text-[10px] text-ink-400">{permission.description}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={draft[permission.key] ?? true}
                    onChange={(event) => setDraft({ ...draft, [permission.key]: event.target.checked })}
                    className="h-4 w-4 accent-brand-500"
                  />
                </label>
              ))}
            </div>
            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-[11.5px] text-red-700">{error}</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="rounded-full px-4 py-2 text-[12px] font-semibold text-ink-500 hover:bg-ink-50">Annuler</button>
              <Button type="button" size="sm" onClick={save} disabled={pending}>
                {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Enregistrer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
