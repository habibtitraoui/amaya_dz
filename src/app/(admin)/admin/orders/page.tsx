import Link from '@/components/ui/navigation-link';
import { Search, ShoppingCart } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/locale';
import { getDictionary, t as interpolate } from '@/lib/i18n';
import { formatDA } from '@/lib/money';
import { formatDateTime, cn } from '@/lib/utils';
import { ORDER_STATUSES, type OrderStatus } from '@/lib/pricing';
import { Badge } from '@/components/ui/badge';
import { OrderStatusSelect } from '@/components/admin/order-status-select';

export const dynamic = 'force-dynamic';

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = Array.isArray(params.status) ? params.status[0] : params.status;
  const search = Array.isArray(params.q) ? params.q[0] : params.q;

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const copy = dict.admin.orders;

  const where: Record<string, unknown> = {};
  if (status && ORDER_STATUSES.includes(status as OrderStatus)) where.status = status;
  if (search?.trim()) {
    where.OR = [
      { orderNumber: { contains: search.trim(), mode: 'insensitive' } },
      { customerNameSnapshot: { contains: search.trim(), mode: 'insensitive' } },
      { customerPhoneSnapshot: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  const [orders, counts] = await Promise.all([
    prisma.order.findMany({
      where: where as never,
      include: { items: true, invoices: { select: { id: true, number: true } } },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const countMap: Record<string, number> = {};
  for (const row of counts) countMap[row.status] = row._count._all;
  const total = Object.values(countMap).reduce((sum, n) => sum + n, 0);

  const tabHref = (value?: string) => {
    const query = new URLSearchParams();
    if (value) query.set('status', value);
    if (search) query.set('q', search);
    return `/admin/orders${query.toString() ? `?${query.toString()}` : ''}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink-900">{copy.title}</h1>
          <p className="text-[12.5px] text-ink-500">{interpolate(copy.subtitle, { count: total })}</p>
        </div>
        <form action="/admin/orders" className="relative">
          {status && <input type="hidden" name="status" value={status} />}
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            name="q"
            defaultValue={search}
            placeholder={copy.searchPlaceholder}
            aria-label={dict.common.search}
            className="h-10 w-64 rounded-xl border border-ink-200 bg-white ps-9 pe-3 text-[12.5px] focus:border-brand-300 focus:outline-none focus:ring-4 focus:ring-brand-50"
          />
        </form>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Link
          href={tabHref()}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors',
            !status ? 'bg-ink-900 text-white' : 'border border-ink-200 bg-white text-ink-600 hover:border-ink-300',
          )}
        >
          {copy.tabAll} <span className="opacity-60">{total}</span>
        </Link>
        {ORDER_STATUSES.map((value) => (
          <Link
            key={value}
            href={tabHref(value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition-colors',
              status === value ? 'bg-ink-900 text-white' : 'border border-ink-200 bg-white text-ink-600 hover:border-ink-300',
            )}
          >
            {dict.status[value]} <span className="opacity-60">{countMap[value] ?? 0}</span>
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-[10px] uppercase tracking-wider text-ink-400">
                <th className="px-4 py-2.5 text-start font-bold">{copy.colOrder}</th>
                <th className="px-4 py-2.5 text-start font-bold">{copy.colCustomer}</th>
                <th className="px-4 py-2.5 text-start font-bold">{copy.colType}</th>
                <th className="px-4 py-2.5 text-start font-bold">{copy.colItems}</th>
                <th className="px-4 py-2.5 text-start font-bold">{copy.colStatus}</th>
                <th className="px-4 py-2.5 text-start font-bold">{copy.colInvoice}</th>
                <th className="px-4 py-2.5 text-end font-bold">{copy.colTotal}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {orders.map((order) => (
                <tr key={order.id} className="transition-colors hover:bg-ink-50/50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${order.id}`} className="text-[12.5px] font-bold text-ink-900 hover:text-brand-600" dir="ltr">
                      {order.orderNumber}
                    </Link>
                    <p className="text-[10.5px] text-ink-400">{formatDateTime(order.createdAt, locale)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[12.5px] font-medium text-ink-800">{order.customerNameSnapshot}</p>
                    <p className="text-[10.5px] text-ink-400" dir="ltr">{order.customerPhoneSnapshot}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        order.customerTypeSnapshot === 'SUPER_WHOLESALE'
                          ? 'violet'
                          : order.customerTypeSnapshot === 'WHOLESALE'
                            ? 'blue'
                            : 'neutral'
                      }
                    >
                      {dict.tier[order.customerTypeSnapshot as keyof typeof dict.tier]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[11.5px] text-ink-500 tabular-nums">
                    {order.items.reduce((sum, item) => sum + item.quantity, 0)} {copy.unitAbbr}
                  </td>
                  <td className="px-4 py-3">
                    <OrderStatusSelect
                      orderId={order.id}
                      status={order.status}
                      statusLabels={dict.status}
                      ariaLabel={copy.colStatus}
                      errorLabel={copy.actionError}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {order.invoices.length > 0 ? (
                      <Link href={`/invoices/${order.invoices[0].id}`} target="_blank" className="text-[11px] font-bold text-brand-600 hover:underline" dir="ltr">
                        {order.invoices[0].number}
                      </Link>
                    ) : (
                      <span className="text-[11px] text-ink-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-end text-[12.5px] font-bold text-ink-900 tabular-nums" dir="ltr">
                    {formatDA(order.totalAmount, locale)}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <ShoppingCart className="mx-auto h-7 w-7 text-ink-300" />
                    <p className="mt-2 text-[12.5px] text-ink-400">{copy.empty}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
