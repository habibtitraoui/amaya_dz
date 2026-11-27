import Link from '@/components/ui/navigation-link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Phone, MapPin, User, History, AlertTriangle } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/locale';
import { getDictionary, translate, t as interpolate } from '@/lib/i18n';
import { formatDA } from '@/lib/money';
import { formatDateTime } from '@/lib/utils';
import { OrderStatusBadge, Badge } from '@/components/ui/badge';
import { OrderActions } from '@/components/admin/order-actions';
import { InvoicePanel } from '@/components/admin/invoice-panel';

export const dynamic = 'force-dynamic';

export default async function AdminOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const copy = dict.admin.orders;

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
          {copy.backToOrders}
        </Link>
        <div className="flex items-center gap-2">
          <OrderStatusBadge status={order.status} label={dict.status[order.status as keyof typeof dict.status]} />
          <Badge tone={order.customerTypeSnapshot === 'SUPER_WHOLESALE' ? 'violet' : order.customerTypeSnapshot === 'WHOLESALE' ? 'blue' : 'neutral'}>
            {dict.tier[order.customerTypeSnapshot as keyof typeof dict.tier]}
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {/* header card */}
          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">{copy.orderEyebrow}</p>
                <h1 className="text-xl font-extrabold text-ink-900" dir="ltr">{order.orderNumber}</h1>
                <p className="text-[11.5px] text-ink-400">{formatDateTime(order.createdAt, locale)}</p>
              </div>
              <div className="text-end">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">{copy.totalEyebrow}</p>
                <p className="text-xl font-extrabold text-brand-600 tabular-nums" dir="ltr">{formatDA(order.totalAmount, locale)}</p>
                <p className="text-[11px] text-ink-400">
                  {interpolate(copy.itemsCount, { count: order.items.reduce((sum, item) => sum + item.quantity, 0) })}
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-4 border-t border-ink-100 pt-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  <User className="h-3 w-3" /> {copy.customerSection}
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
                    {copy.viewCustomer}
                  </Link>
                )}
              </div>
              <div>
                <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  <MapPin className="h-3 w-3" /> {copy.deliverySection}
                </p>
                <p className="text-[12.5px] text-ink-700">{order.customerAddressSnapshot}</p>
                {order.customerCitySnapshot && <p className="text-[12px] text-ink-500">{order.customerCitySnapshot}</p>}
                <p className="mt-1 text-[11px] text-ink-400">
                  {order.deliveryMethod === 'PICKUP' ? copy.pickup : copy.homeDelivery}
                </p>
              </div>
            </div>

            {order.notes && (
              <div className="mt-3 rounded-xl bg-ink-50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{copy.customerNote}</p>
                <p className="text-[12px] text-ink-700">{order.notes}</p>
              </div>
            )}
          </div>

          {/* items */}
          <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
            <div className="border-b border-ink-100 px-5 py-3">
              <h2 className="text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">{copy.itemsTitle}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-[10px] uppercase tracking-wider text-ink-400">
                    <th className="px-5 py-2 text-start font-bold">{copy.colProduct}</th>
                    <th className="px-3 py-2 text-start font-bold">{copy.colRef}</th>
                    <th className="px-3 py-2 text-center font-bold">{copy.colQty}</th>
                    <th className="px-3 py-2 text-end font-bold">{copy.colUnitPrice}</th>
                    <th className="px-5 py-2 text-end font-bold">{copy.colTotal}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {order.items.map((item) => {
                    const isShort = stockIssues.some((issue) => issue.id === item.id);
                    const localizedProductName = item.product
                      ? translate(item.product.translations, locale) || item.productNameSnapshot
                      : item.productNameFrSnapshot ?? item.productNameSnapshot;
                    const localizedColor = item.variant
                      ? (locale === 'ar' ? item.variant.colorNameAr : locale === 'en' ? item.variant.colorNameEn : item.variant.colorNameFr) || item.colorSnapshot
                      : item.colorSnapshot;
                    return (
                      <tr key={item.id}>
                        <td className="px-5 py-2.5">
                          <p className="text-[12.5px] font-semibold text-ink-900">{localizedProductName}</p>
                          <p className="text-[10.5px] text-ink-400">{localizedColor}</p>
                          {isShort && (
                            <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-bold text-red-600">
                              <AlertTriangle className="h-2.5 w-2.5" /> {copy.insufficientStock}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-[11px] text-ink-500" dir="ltr">{item.skuSnapshot}</td>
                        <td className="px-3 py-2.5 text-center text-[12px] font-bold text-ink-900 tabular-nums">{item.quantity}</td>
                        <td className="px-3 py-2.5 text-end text-[11.5px] text-ink-600 tabular-nums" dir="ltr">{formatDA(item.unitPriceSnapshot, locale)}</td>
                        <td className="px-5 py-2.5 text-end text-[12px] font-bold text-ink-900 tabular-nums" dir="ltr">{formatDA(item.lineTotal, locale)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <dl className="space-y-1.5 border-t border-ink-100 px-5 py-3 text-[12.5px]">
              <div className="flex justify-between"><dt className="text-ink-500">{copy.subtotal}</dt><dd className="font-semibold tabular-nums" dir="ltr">{formatDA(order.subtotal, locale)}</dd></div>
              {Number(order.deliveryFee) > 0 && (
                <div className="flex justify-between"><dt className="text-ink-500">{copy.delivery}</dt><dd className="font-semibold tabular-nums" dir="ltr">{formatDA(order.deliveryFee, locale)}</dd></div>
              )}
              {Number(order.discount) > 0 && (
                <div className="flex justify-between"><dt className="text-ink-500">{copy.discount}</dt><dd className="font-semibold text-emerald-600 tabular-nums" dir="ltr">−{formatDA(order.discount, locale)}</dd></div>
              )}
              <div className="flex justify-between border-t border-ink-100 pt-2 text-[14px]">
                <dt className="font-bold text-ink-900">{copy.total}</dt>
                <dd className="font-extrabold text-brand-600 tabular-nums" dir="ltr">{formatDA(order.totalAmount, locale)}</dd>
              </div>
            </dl>
          </div>

          {/* history */}
          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <h2 className="mb-3 flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">
              <History className="h-3.5 w-3.5" /> {copy.historyTitle}
            </h2>
            <ol className="space-y-3">
              {order.statusHistory.map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-500 ring-4 ring-brand-50" />
                  <div>
                    <p className="text-[12px] font-semibold text-ink-900">
                      {entry.fromStatus ? `${dict.status[entry.fromStatus as keyof typeof dict.status]} → ` : ''}
                      {dict.status[entry.toStatus as keyof typeof dict.status]}
                    </p>
                    <p className="text-[10.5px] text-ink-400">
                      {formatDateTime(entry.createdAt, locale)}
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
            statusLabels={dict.status}
            labels={{
              title: copy.actionsTitle,
              confirm: copy.confirmOrder,
              cancel: copy.cancelOrder,
              next: copy.moveTo,
              note: copy.notePlaceholder,
              stockWarning: copy.stockWarning,
              error: copy.actionError,
              finalStatus: copy.finalStatus,
            }}
          />

          <InvoicePanel
            orderId={order.id}
            orderStatus={order.status}
            locale={locale}
            invoices={order.invoices.map((invoice) => ({
              id: invoice.id,
              number: invoice.number,
              version: invoice.version,
              issuedAt: invoice.issuedAt.toISOString(),
              totalAmount: String(invoice.totalAmount),
            }))}
            labels={{
              title: copy.invoicePanelTitle,
              generate: copy.invoiceGenerate,
              reissue: copy.invoiceReissue,
              preview: copy.invoicePreview,
              pdf: copy.invoicePdf,
              print: copy.invoicePrint,
              empty: copy.invoiceEmpty,
              pending: copy.invoicePending,
              immutable: copy.invoiceImmutable,
            }}
          />
        </div>
      </div>
    </div>
  );
}
