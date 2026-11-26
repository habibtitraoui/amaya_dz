import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Phone, MapPin, User, FileText, History, AlertTriangle } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { formatDA } from '@/lib/money';
import { formatDateTime } from '@/lib/utils';
import { OrderStatusBadge, Badge } from '@/components/ui/badge';
import { OrderActions } from '@/components/admin/order-actions';
import { InvoicePanel } from '@/components/admin/invoice-panel';

export const dynamic = 'force-dynamic';

const STATUS_FR: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  PREPARING: 'Préparation',
  READY: 'Prête',
  SHIPPED: 'Expédiée',
  DELIVERED: 'Livrée',
  CANCELLED: 'Annulée',
};

const TIER_FR: Record<string, string> = { RETAIL: 'Détail', WHOLESALE: 'Gros', SUPER_WHOLESALE: 'Super Gros' };

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { variant: true, product: { include: { translations: true } } } },
      statusHistory: { orderBy: { createdAt: 'asc' }, include: { changedBy: true } },
      invoices: { orderBy: { issuedAt: 'desc' } },
      customer: { include: { profile: true } },
    },
  });
  if (!order) notFound();

  // Live stock check shown to staff before confirming.
  const stockIssues = order.items
    .filter((item) => item.variant)
    .filter((item) => Math.max(0, (item.variant!.stockQuantity - item.variant!.reservedQuantity)) < item.quantity);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/orders" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-500 hover:text-ink-900">
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
          Commandes
        </Link>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} label={STATUS_FR[order.status]} />
          <Badge tone={order.customerTypeSnapshot === 'SUPER_WHOLESALE' ? 'violet' : order.customerTypeSnapshot === 'WHOLESALE' ? 'blue' : 'neutral'}>
            {TIER_FR[order.customerTypeSnapshot]}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {/* header card */}
          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">Commande</p>
                <h1 className="text-xl font-extrabold text-ink-900" dir="ltr">{order.orderNumber}</h1>
                <p className="text-[11.5px] text-ink-400">{formatDateTime(order.createdAt, 'fr')}</p>
              </div>
              <div className="text-end">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">Total</p>
                <p className="text-xl font-extrabold text-brand-600 tabular-nums" dir="ltr">{formatDA(order.totalAmount, 'fr')}</p>
                <p className="text-[11px] text-ink-400">
                  {order.items.reduce((sum, item) => sum + item.quantity, 0)} article(s)
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 border-t border-ink-100 pt-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  <User className="h-3 w-3" /> Client
                </p>
                <p className="text-[13px] font-semibold text-ink-900">{order.customerNameSnapshot}</p>
                <p className="flex items-center gap-1.5 text-[12px] text-ink-600" dir="ltr">
                  <Phone className="h-3 w-3 text-ink-400" />
                  <a href={`tel:${order.customerPhoneSnapshot}`} className="hover:text-brand-600">{order.customerPhoneSnapshot}</a>
                </p>
                {order.customer?.profile?.businessName && (
                  <p className="mt-0.5 text-[11.5px] text-ink-500">{order.customer.profile.businessName}</p>
                )}
                {order.customer && (
                  <Link href={`/admin/customers/${order.customer.id}`} className="mt-1 inline-block text-[11px] font-bold text-brand-600 hover:underline">
                    Voir la fiche client →
                  </Link>
                )}
              </div>
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  <MapPin className="h-3 w-3" /> Livraison
                </p>
                <p className="text-[12.5px] text-ink-700">{order.customerAddressSnapshot}</p>
                {order.customerCitySnapshot && <p className="text-[12px] text-ink-500">{order.customerCitySnapshot}</p>}
                <p className="mt-1 text-[11px] text-ink-400">
                  {order.deliveryMethod === 'PICKUP' ? 'Retrait en boutique' : 'Livraison à domicile'}
                </p>
              </div>
            </div>

            {order.notes && (
              <div className="mt-3 rounded-xl bg-ink-50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">Note du client</p>
                <p className="text-[12px] text-ink-700">{order.notes}</p>
              </div>
            )}
          </div>

          {/* items */}
          <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
            <div className="border-b border-ink-100 px-5 py-3">
              <h2 className="text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Articles</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-[10px] uppercase tracking-wider text-ink-400">
                    <th className="px-5 py-2 text-start font-bold">Produit</th>
                    <th className="px-3 py-2 text-start font-bold">Réf.</th>
                    <th className="px-3 py-2 text-center font-bold">Qté</th>
                    <th className="px-3 py-2 text-end font-bold">P.U.</th>
                    <th className="px-5 py-2 text-end font-bold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {order.items.map((item) => {
                    const isShort = stockIssues.some((issue) => issue.id === item.id);
                    return (
                      <tr key={item.id}>
                        <td className="px-5 py-2.5">
                          <p className="text-[12.5px] font-semibold text-ink-900">{item.productNameFrSnapshot ?? item.productNameSnapshot}</p>
                          <p className="text-[10.5px] text-ink-400">{item.colorSnapshot}</p>
                          {isShort && (
                            <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-red-600">
                              <AlertTriangle className="h-2.5 w-2.5" /> stock insuffisant
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-ink-500" dir="ltr">{item.skuSnapshot}</td>
                        <td className="px-3 py-2.5 text-center text-[12px] font-bold text-ink-900 tabular-nums">{item.quantity}</td>
                        <td className="px-3 py-2.5 text-end text-[11.5px] text-ink-600 tabular-nums" dir="ltr">{formatDA(item.unitPriceSnapshot, 'fr')}</td>
                        <td className="px-5 py-2.5 text-end text-[12px] font-bold text-ink-900 tabular-nums" dir="ltr">{formatDA(item.lineTotal, 'fr')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <dl className="space-y-1.5 border-t border-ink-100 px-5 py-3 text-[12.5px]">
              <div className="flex justify-between"><dt className="text-ink-500">Sous-total</dt><dd className="font-semibold tabular-nums" dir="ltr">{formatDA(order.subtotal, 'fr')}</dd></div>
              {Number(order.deliveryFee) > 0 && (
                <div className="flex justify-between"><dt className="text-ink-500">Livraison</dt><dd className="font-semibold tabular-nums" dir="ltr">{formatDA(order.deliveryFee, 'fr')}</dd></div>
              )}
              {Number(order.discount) > 0 && (
                <div className="flex justify-between"><dt className="text-ink-500">Remise</dt><dd className="font-semibold text-emerald-600 tabular-nums" dir="ltr">−{formatDA(order.discount, 'fr')}</dd></div>
              )}
              <div className="flex justify-between border-t border-ink-100 pt-2 text-[14px]">
                <dt className="font-bold text-ink-900">Total</dt>
                <dd className="font-extrabold text-brand-600 tabular-nums" dir="ltr">{formatDA(order.totalAmount, 'fr')}</dd>
              </div>
            </dl>
          </div>

          {/* history */}
          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <h2 className="mb-3 flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">
              <History className="h-3.5 w-3.5" /> Historique
            </h2>
            <ol className="space-y-3">
              {order.statusHistory.map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500 ring-4 ring-brand-50" />
                  <div>
                    <p className="text-[12px] font-semibold text-ink-900">
                      {entry.fromStatus ? `${STATUS_FR[entry.fromStatus]} → ` : ''}
                      {STATUS_FR[entry.toStatus]}
                    </p>
                    <p className="text-[10.5px] text-ink-400">
                      {formatDateTime(entry.createdAt, 'fr')}
                      {entry.changedBy ? ` · ${entry.changedBy.name}` : ''}
                    </p>
                    {entry.note && <p className="text-[11px] text-ink-500">{entry.note}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* side rail */}
        <div className="space-y-4">
          <OrderActions
            orderId={order.id}
            status={order.status}
            stockIssues={stockIssues.length}
            labels={{
              title: 'Actions',
              confirm: 'Confirmer la commande',
              cancel: 'Annuler la commande',
              next: 'Passer à',
              note: 'Note (facultatif)',
              stockWarning: 'Stock insuffisant pour certains articles — la confirmation sera refusée.',
              error: 'Action impossible',
            }}
          />

          <InvoicePanel
            orderId={order.id}
            orderStatus={order.status}
            invoices={order.invoices.map((invoice) => ({
              id: invoice.id,
              number: invoice.number,
              version: invoice.version,
              issuedAt: invoice.issuedAt.toISOString(),
              totalAmount: String(invoice.totalAmount),
            }))}
            labels={{
              title: 'Facture (français)',
              generate: 'Générer la facture',
              reissue: 'Rééditer une version',
              preview: 'Aperçu',
              pdf: 'PDF',
              print: 'Imprimer',
              empty: 'Aucune facture émise. Les factures sont toujours en français, au format A4.',
              pending: 'Confirmez la commande avant d’émettre une facture.',
              immutable: 'Les factures émises ne changent jamais, même après une modification des prix.',
            }}
          />
        </div>
      </div>
    </div>
  );
}
