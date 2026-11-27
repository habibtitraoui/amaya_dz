import Link from '@/components/ui/navigation-link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin, Phone, User, Package, FileText, Printer } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getLocale } from '@/lib/locale';
import { getDictionary, t as interpolate } from '@/lib/i18n';
import { formatDA } from '@/lib/money';
import { formatDate, formatDateTime } from '@/lib/utils';
import { OrderStatusBadge, Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { CancelOrderButton } from '@/components/account/cancel-order-button';

export const dynamic = 'force-dynamic';

export default async function AccountOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return null;
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  // Scoping by customerId is the isolation guarantee: another customer's order
  // simply does not exist for this query.
  const order = await prisma.order.findFirst({
    where: { id, customerId: user.id },
    include: {
      items: true,
      statusHistory: { orderBy: { createdAt: 'asc' } },
      invoices: { orderBy: { issuedAt: 'desc' } },
    },
  });
  if (!order) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/account/orders" className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-500 hover:text-ink-900">
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
          {dict.account.myOrders}
        </Link>
        <div className="flex items-center gap-2">
          {order.invoices[0] && (
            <ButtonLink href={`/invoices/${order.invoices[0].id}`} variant="outline" size="sm" target="_blank">
              <Printer className="h-3.5 w-3.5" />
              {dict.common.print}
            </ButtonLink>
          )}
          {order.status === 'PENDING' && (
            <CancelOrderButton
              orderId={order.id}
              labels={{ cancel: dict.common.cancel, confirm: dict.common.confirm, error: dict.common.error }}
            />
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 bg-ink-50/60 px-5 py-4">
          <div>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">{dict.account.orderNumber}</p>
            <p className="text-lg font-extrabold text-ink-900" dir="ltr">{order.orderNumber}</p>
            <p className="text-[11.5px] text-ink-400">{interpolate(dict.account.placedOn, { date: formatDateTime(order.createdAt, locale) })}</p>
          </div>
          <div className="flex items-center gap-2">
            <OrderStatusBadge status={order.status} label={dict.status[order.status as keyof typeof dict.status]} />
            <Badge tone="neutral">{dict.tier[order.customerTypeSnapshot as keyof typeof dict.tier]}</Badge>
          </div>
        </div>

        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">
              <User className="h-3.5 w-3.5" /> {dict.checkout.customerInfo}
            </p>
            <p className="text-[13px] font-semibold text-ink-900">{order.customerNameSnapshot}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-ink-600" dir="ltr">
              <Phone className="h-3.5 w-3.5 text-ink-400" /> {order.customerPhoneSnapshot}
            </p>
          </div>
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">
              <MapPin className="h-3.5 w-3.5" /> {dict.account.deliveryTo}
            </p>
            <p className="text-[13px] text-ink-700">{order.customerAddressSnapshot}</p>
            {order.customerCitySnapshot && <p className="text-[12.5px] text-ink-500">{order.customerCitySnapshot}</p>}
          </div>
        </div>

        <ul className="divide-y divide-ink-100 border-t border-ink-100">
          {order.items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 px-5 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink-50 text-ink-400">
                  <Package className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink-900">{item.productNameFrSnapshot ?? item.productNameSnapshot}</p>
                  <p className="text-[11px] text-ink-400">
                    {item.colorSnapshot} · <span dir="ltr">{item.skuSnapshot}</span> · ×{item.quantity}
                  </p>
                </div>
              </div>
              <div className="text-end">
                <p className="text-[12.5px] font-bold text-ink-900 tabular-nums" dir="ltr">{formatDA(item.lineTotal, locale)}</p>
                <p className="text-[10.5px] text-ink-400 tabular-nums" dir="ltr">{formatDA(item.unitPriceSnapshot, locale)} / u</p>
              </div>
            </li>
          ))}
        </ul>

        <dl className="space-y-1.5 border-t border-ink-100 px-5 py-4 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-ink-500">{dict.cart.subtotal}</dt>
            <dd className="font-semibold tabular-nums" dir="ltr">{formatDA(order.subtotal, locale)}</dd>
          </div>
          {Number(order.deliveryFee) > 0 && (
            <div className="flex justify-between">
              <dt className="text-ink-500">{dict.cart.delivery}</dt>
              <dd className="font-semibold tabular-nums" dir="ltr">{formatDA(order.deliveryFee, locale)}</dd>
            </div>
          )}
          {Number(order.discount) > 0 && (
            <div className="flex justify-between">
              <dt className="text-ink-500">{dict.cart.discount}</dt>
              <dd className="font-semibold tabular-nums text-emerald-600" dir="ltr">−{formatDA(order.discount, locale)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-ink-100 pt-2 text-[15px]">
            <dt className="font-bold text-ink-900">{dict.cart.total}</dt>
            <dd className="font-extrabold text-brand-600 tabular-nums" dir="ltr">{formatDA(order.totalAmount, locale)}</dd>
          </div>
        </dl>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h3 className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">{dict.common.status}</h3>
          <ol className="space-y-3">
            {order.statusHistory.map((entry, index) => (
              <li key={entry.id} className="flex gap-3">
                <span className="mt-1 flex h-2 w-2 shrink-0 rounded-full bg-brand-500 ring-4 ring-brand-50" />
                <div>
                  <p className="text-[12.5px] font-semibold text-ink-900">
                    {dict.status[entry.toStatus as keyof typeof dict.status]}
                  </p>
                  <p className="text-[11px] text-ink-400">{formatDateTime(entry.createdAt, locale)}</p>
                  {entry.note && <p className="text-[11px] text-ink-500">{entry.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>

        {order.invoices.length > 0 && (
          <section className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <h3 className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-400">FACTURE</h3>
            <ul className="space-y-2">
              {order.invoices.map((invoice) => (
                <li key={invoice.id} className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-brand-500" />
                    <div>
                      <p className="text-[12.5px] font-bold text-ink-900" dir="ltr">{invoice.number}</p>
                      <p className="text-[10.5px] text-ink-400">{formatDate(invoice.issuedAt, locale)}</p>
                    </div>
                  </div>
                  <Link href={`/invoices/${invoice.id}`} target="_blank" className="text-[11.5px] font-bold text-brand-600 hover:underline">
                    {dict.common.print}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
