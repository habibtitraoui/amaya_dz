import Link from 'next/link';
import { Package, ShoppingBag, ArrowRight } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getLocale } from '@/lib/locale';
import { getDictionary, t as interpolate } from '@/lib/i18n';
import { formatDA } from '@/lib/money';
import { formatDate } from '@/lib/utils';
import { OrderStatusBadge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function AccountOrdersPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const locale = await getLocale();
  const dict = await getDictionary(locale);

  const orders = await prisma.order.findMany({
    where: { customerId: user.id },
    orderBy: { createdAt: 'desc' },
    include: { items: true, invoices: { select: { number: true, id: true } } },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-ink-900">{dict.account.myOrders}</h2>
        <p className="text-[12.5px] text-ink-500">{dict.account.myOrdersText}</p>
      </div>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-ink-200 bg-white px-6 py-14 text-center">
          <ShoppingBag className="h-7 w-7 text-ink-300" />
          <p className="text-[13px] text-ink-500">{dict.account.noOrders}</p>
          <ButtonLink href="/products" size="sm">{dict.account.browseProducts}</ButtonLink>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {orders.map((order) => (
            <li key={order.id} className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
              <Link href={`/account/orders/${order.id}`} className="block px-5 py-4 transition-colors hover:bg-ink-50/50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink-50 text-ink-500">
                      <Package className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-[13.5px] font-bold text-ink-900" dir="ltr">{order.orderNumber}</p>
                      <p className="text-[11.5px] text-ink-400">
                        {formatDate(order.createdAt, locale)} · {interpolate(dict.account.itemsCount, { count: order.items.length })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <OrderStatusBadge status={order.status} label={dict.status[order.status as keyof typeof dict.status]} />
                    <span className="text-[14px] font-extrabold text-ink-900 tabular-nums" dir="ltr">
                      {formatDA(order.totalAmount, locale)}
                    </span>
                    <ArrowRight className="h-4 w-4 text-ink-300 rtl:rotate-180" />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
