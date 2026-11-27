import Link from '@/components/ui/navigation-link';
import { Search, Users } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/locale';
import { getDictionary, t as interpolate } from '@/lib/i18n';
import { formatDA } from '@/lib/money';
import { formatDate, cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = Array.isArray(params.q) ? params.q[0] : params.q;
  const tier = Array.isArray(params.tier) ? params.tier[0] : params.tier;

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const copy = dict.admin.customers;

  const where: Record<string, unknown> = { role: 'CUSTOMER' };
  if (tier) where.tier = tier;
  if (search?.trim()) {
    where.OR = [
      { name: { contains: search.trim(), mode: 'insensitive' } },
      { email: { contains: search.trim(), mode: 'insensitive' } },
      { phone: { contains: search.trim(), mode: 'insensitive' } },
    ];
  }

  const customers = await prisma.user.findMany({
    where: where as never,
    include: {
      profile: true,
      orders: { select: { totalAmount: true, status: true, createdAt: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink-900">{copy.title}</h1>
          <p className="text-[12.5px] text-ink-500">
            {interpolate(copy.subtitle, { count: customers.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <form action="/admin/customers" className="relative">
            {tier && <input type="hidden" name="tier" value={tier} />}
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              name="q"
              defaultValue={search}
              placeholder={copy.searchPlaceholder}
              aria-label={dict.common.search}
              className="h-10 w-56 rounded-xl border border-ink-200 bg-white ps-9 pe-3 text-[12.5px] focus:border-brand-300 focus:outline-none focus:ring-4 focus:ring-brand-50"
            />
          </form>
          <ButtonLink href="/admin/customers/new" size="sm">
            <Users className="h-3.5 w-3.5" />
            {copy.newCustomer}
          </ButtonLink>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[
          { value: '', label: copy.tabAll },
          { value: 'WHOLESALE', label: copy.tabWholesale },
          { value: 'SUPER_WHOLESALE', label: copy.tabSuperWholesale },
        ].map((tab) => (
          <Link
            key={tab.value}
            href={tab.value ? `/admin/customers?tier=${tab.value}` : '/admin/customers'}
            className={cn(
              'rounded-full px-3 py-1.5 text-[11.5px] font-semibold',
              (tier ?? '') === tab.value ? 'bg-ink-900 text-white' : 'border border-ink-200 bg-white text-ink-600 hover:border-ink-300',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50/60 text-[10px] uppercase tracking-wider text-ink-400">
                <th className="px-4 py-2.5 text-start font-bold">{copy.colCustomer}</th>
                <th className="px-4 py-2.5 text-start font-bold">{copy.colTier}</th>
                <th className="px-4 py-2.5 text-start font-bold">{copy.colCity}</th>
                <th className="px-4 py-2.5 text-center font-bold">{copy.colOrders}</th>
                <th className="px-4 py-2.5 text-end font-bold">{copy.colRevenue}</th>
                <th className="px-4 py-2.5 text-start font-bold">{copy.colCreatedAt}</th>
                <th className="px-4 py-2.5 text-start font-bold">{copy.colStatus}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {customers.map((customer) => {
                const revenue = customer.orders
                  .filter((order) => ['DELIVERED', 'SHIPPED', 'READY'].includes(order.status))
                  .reduce((sum, order) => sum + Number(order.totalAmount), 0);
                return (
                  <tr key={customer.id} className="transition-colors hover:bg-ink-50/50">
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/customers/${customer.id}`} className="text-[12.5px] font-semibold text-ink-900 hover:text-brand-600">
                        {customer.name}
                      </Link>
                      <p className="text-[10.5px] text-ink-400" dir="ltr">{customer.email}</p>
                      {customer.profile?.businessName && <p className="text-[10.5px] text-ink-500">{customer.profile.businessName}</p>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={customer.tier === 'SUPER_WHOLESALE' ? 'violet' : 'blue'}>
                        {dict.tier[(customer.tier ?? 'WHOLESALE') as 'WHOLESALE' | 'SUPER_WHOLESALE']}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-[11.5px] text-ink-600">{customer.profile?.city ?? '—'}</td>
                    <td className="px-4 py-2.5 text-center text-[11.5px] font-medium text-ink-700 tabular-nums">{customer.orders.length}</td>
                    <td className="px-4 py-2.5 text-end text-[11.5px] font-bold text-ink-900 tabular-nums" dir="ltr">{formatDA(revenue, locale)}</td>
                    <td className="px-4 py-2.5 text-[11px] text-ink-500">{formatDate(customer.createdAt, locale)}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={customer.status === 'ACTIVE' ? 'success' : 'danger'}>
                        {customer.status === 'ACTIVE' ? copy.statusActive : copy.statusSuspended}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <Users className="mx-auto h-7 w-7 text-ink-300" />
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
