import Link from '@/components/ui/navigation-link';
import { FileText, Download, Printer, Plus } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { formatDA } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

export default async function AdminInvoicesPage() {
  const [invoices, unissued] = await Promise.all([
    prisma.invoice.findMany({
      include: { order: { select: { orderNumber: true, status: true, customerTypeSnapshot: true } } },
      orderBy: { issuedAt: 'desc' },
      take: 100,
    }),
    prisma.order.findMany({
      where: { status: { in: ['CONFIRMED', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED'] }, invoices: { none: {} } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[22px] font-extrabold tracking-tight text-ink-900">Factures</h1>
        <p className="text-[12.5px] text-ink-500">
          Toutes les factures sont générées en français au format A4 — langue indépendante de la boutique.
        </p>
      </div>

      {unissued.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">À facturer ({unissued.length})</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unissued.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-ink-800 ring-1 ring-amber-200 hover:ring-amber-400"
              >
                <Plus className="h-3 w-3 text-amber-600" />
                <span dir="ltr">{order.orderNumber}</span>
                <span className="text-ink-400" dir="ltr">{formatDA(order.totalAmount, 'fr')}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
        <div className="border-b border-ink-100 bg-ink-50/60 px-5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
          {invoices.length} facture(s) émise(s)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 text-[10px] uppercase tracking-wider text-ink-400">
                <th className="px-5 py-2 text-start font-bold">Facture</th>
                <th className="px-3 py-2 text-start font-bold">Commande</th>
                <th className="px-3 py-2 text-start font-bold">Client</th>
                <th className="px-3 py-2 text-start font-bold">Date</th>
                <th className="px-3 py-2 text-start font-bold">Statut</th>
                <th className="px-3 py-2 text-end font-bold">Total</th>
                <th className="px-5 py-2 text-end font-bold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="transition-colors hover:bg-ink-50/50">
                  <td className="px-5 py-2.5">
                    <Link href={`/invoices/${invoice.id}`} target="_blank" className="inline-flex items-center gap-1.5 text-[12px] font-bold text-ink-900 hover:text-brand-600" dir="ltr">
                      <FileText className="h-3.5 w-3.5 text-brand-500" />
                      {invoice.number}
                    </Link>
                    <p className="text-[10px] text-ink-400">v{invoice.version}</p>
                  </td>
                  <td className="px-3 py-2.5 text-[11.5px] text-ink-600" dir="ltr">{invoice.order.orderNumber}</td>
                  <td className="px-3 py-2.5 text-[11.5px] text-ink-700">{invoice.customerNameSnapshot}</td>
                  <td className="px-3 py-2.5 text-[11.5px] text-ink-500">{formatDate(invoice.issuedAt, 'fr')}</td>
                  <td className="px-3 py-2.5">
                    <Badge tone={invoice.order.status === 'CANCELLED' ? 'danger' : 'success'}>
                      {invoice.order.status === 'CANCELLED' ? 'Annulée' : 'Valide'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-end text-[11.5px] font-bold text-ink-900 tabular-nums" dir="ltr">
                    {formatDA(invoice.totalAmount, 'fr')}
                  </td>
                  <td className="px-5 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/invoices/${invoice.id}`} target="_blank" className="grid h-7 w-7 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-800" aria-label="Aperçu">
                        <Printer className="h-3.5 w-3.5" />
                      </Link>
                      <Link href={`/invoices/${invoice.id}/pdf`} target="_blank" className="grid h-7 w-7 place-items-center rounded-lg text-brand-600 hover:bg-brand-50" aria-label="Télécharger le PDF">
                        <Download className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-16 text-center text-[12px] text-ink-400">Aucune facture émise</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
