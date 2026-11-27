import Link from '@/components/ui/navigation-link';
import { redirect } from 'next/navigation';
import { Search, ScrollText, ShieldCheck } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { formatDateTime, cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const ACTION_TONE = (action: string) => {
  if (action.startsWith('auth.')) return 'bg-sky-50 text-sky-700 ring-sky-200';
  if (action.startsWith('order.')) return 'bg-brand-50 text-brand-700 ring-brand-200';
  if (action.includes('invoice')) return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
  if (action.startsWith('product') || action.startsWith('category')) return 'bg-violet-50 text-violet-700 ring-violet-200';
  if (action.startsWith('stock')) return 'bg-amber-50 text-amber-800 ring-amber-200';
  if (action.startsWith('customer') || action.startsWith('supervisor')) return 'bg-indigo-50 text-indigo-700 ring-indigo-200';
  return 'bg-ink-100 text-ink-700 ring-ink-200';
};

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ADMIN') redirect('/admin');

  const params = await searchParams;
  const search = Array.isArray(params.q) ? params.q[0] : params.q;
  const action = Array.isArray(params.action) ? params.action[0] : params.action;

  const where: Record<string, unknown> = {};
  if (action) where.action = { startsWith: action };
  if (search?.trim()) {
    where.OR = [
      { summary: { contains: search.trim(), mode: 'insensitive' } },
      { actorName: { contains: search.trim(), mode: 'insensitive' } },
      { entityType: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  const logs = await prisma.auditLog.findMany({
    where: where as never,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink-900">Journal d’audit</h1>
          <p className="text-[12.5px] text-ink-500">
            Toutes les actions du personnel — en lecture seule, jamais modifiables.
          </p>
        </div>
        <form action="/admin/audit" className="relative">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input name="q" defaultValue={search} placeholder="Rechercher…" className="h-10 w-64 rounded-xl border border-ink-200 bg-white ps-9 pe-3 text-[12.5px] focus:border-brand-300 focus:outline-none focus:ring-4 focus:ring-brand-50" />
        </form>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[
          { value: '', label: 'Tout' },
          { value: 'order.', label: 'Commandes' },
          { value: 'invoice', label: 'Factures' },
          { value: 'product', label: 'Produits' },
          { value: 'stock', label: 'Stock' },
          { value: 'customer', label: 'Clients' },
          { value: 'auth.', label: 'Connexions' },
        ].map((tab) => (
          <Link
            key={tab.value}
            href={tab.value ? `/admin/audit?action=${encodeURIComponent(tab.value)}` : '/admin/audit'}
            className={cn(
              'rounded-full px-3 py-1.5 text-[11.5px] font-semibold',
              (action ?? '') === tab.value ? 'bg-ink-900 text-white' : 'border border-ink-200 bg-white text-ink-600 hover:border-ink-300',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white shadow-card">
        <div className="flex items-center gap-2 border-b border-ink-100 px-5 py-2.5">
          <ScrollText className="h-3.5 w-3.5 text-ink-400" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{logs.length} entrée(s)</span>
          <span className="ms-auto inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
            <ShieldCheck className="h-3 w-3" /> append-only
          </span>
        </div>
        <ul className="divide-y divide-ink-100">
          {logs.map((log) => (
            <li key={log.id} className="flex flex-wrap items-start gap-2 px-5 py-2.5">
              <span className={cn('rounded-md px-1.5 py-0.5 font-mono text-[9.5px] font-bold ring-1 ring-inset', ACTION_TONE(log.action))}>
                {log.action}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-ink-800">{log.summary}</p>
                <p className="text-[10px] text-ink-400">
                  {formatDateTime(log.createdAt, 'fr')} · {log.actorName} · {log.entityType}
                  {log.entityId ? ` #${log.entityId.slice(-6)}` : ''}
                </p>
              </div>
            </li>
          ))}
          {logs.length === 0 && <li className="px-5 py-16 text-center text-[12px] text-ink-400">Aucune entrée</li>}
        </ul>
      </div>
    </div>
  );
}
