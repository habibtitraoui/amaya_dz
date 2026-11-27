import Link from '@/components/ui/navigation-link';
import {
  ShoppingCart,
  TrendingUp,
  Package,
  Users,
  Clock,
  CircleCheck,
  CircleX,
  Boxes,
  ArrowRight,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { getLocale } from '@/lib/locale';
import { getDictionary, translate, t as interpolate } from '@/lib/i18n';
import { getDashboardData, getOrderSeries, resolveRange } from '@/lib/services/analytics';
import { formatDA, formatNumber } from '@/lib/money';
import { formatDateTime } from '@/lib/utils';
import { RangeFilter } from '@/components/admin/range-filter';
import { OrdersAreaChart, TierDonutChart, CategoryBarsChart } from '@/components/admin/charts';
import { OrderStatusBadge, Badge } from '@/components/ui/badge';
import { KpiCard } from '@/components/admin/kpi-card';

export const dynamic = 'force-dynamic';

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const rangePreset = (Array.isArray(query.range) ? query.range[0] : query.range) ?? '30d';
  const range = resolveRange(rangePreset, Array.isArray(query.from) ? query.from[0] : query.from, Array.isArray(query.to) ? query.to[0] : query.to);

  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const copy = dict.admin.overview;

  const user = await getCurrentUser();
  const [data, series, recentOrders, lowStock, pendingInvoices] = await Promise.all([
    getDashboardData(range, locale),
    getOrderSeries(range),
    prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 6, include: { items: true } }),
    prisma.productVariant.findMany({
      where: { isActive: true, stockQuantity: { lte: 5 } },
      include: { product: { include: { translations: true } } },
      orderBy: { stockQuantity: 'asc' },
      take: 5,
    }),
    prisma.order.findMany({
      where: { status: { in: ['CONFIRMED', 'PREPARING', 'READY', 'SHIPPED'] }, invoices: { none: {} } },
      orderBy: { createdAt: 'asc' },
      take: 5,
    }),
  ]);

  const totalRevenue = data.revenue.total;
  const tierTotal = data.tiers.RETAIL.revenue + data.tiers.WHOLESALE.revenue + data.tiers.SUPER_WHOLESALE.revenue;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-brand-500">{copy.eyebrow}</p>
          <h1 className="mt-1 text-[22px] font-extrabold tracking-tight text-ink-900">
            {interpolate(copy.greeting, { name: user?.name.split(' ')[0] ?? 'AMAYA' })}
          </h1>
          <p className="text-[12.5px] text-ink-500">{copy.subtitle}</p>
        </div>
        <RangeFilter active={rangePreset} labels={dict.admin.ranges} />
      </div>

      {/* primary KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={copy.revenue}
          value={formatDA(totalRevenue, locale)}
          icon={<TrendingUp className="h-4 w-4" />}
          tone="brand"
          hint={interpolate(copy.validatedOrdersHint, { count: formatNumber(data.revenue.orderCount, locale) })}
          href="/admin/reports"
        />
        <KpiCard
          label={copy.orders}
          value={formatNumber(data.orders.total, locale)}
          icon={<ShoppingCart className="h-4 w-4" />}
          tone="ink"
          hint={interpolate(copy.averageBasketHint, { amount: formatDA(data.revenue.average, locale) })}
          href="/admin/orders"
        />
        <KpiCard
          label={copy.pending}
          value={formatNumber(data.orders.pending, locale)}
          icon={<Clock className="h-4 w-4" />}
          tone="amber"
          hint={copy.pendingHint}
          href="/admin/orders?status=PENDING"
        />
        <KpiCard
          label={copy.proCustomers}
          value={formatNumber(data.customers.wholesale + data.customers.superWholesale, locale)}
          icon={<Users className="h-4 w-4" />}
          tone="violet"
          hint={interpolate(copy.proCustomersHint, {
            wholesale: data.customers.wholesale,
            superWholesale: data.customers.superWholesale,
          })}
          href="/admin/customers"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-ink-400">{copy.revenueTrend}</h2>
              <p className="mt-0.5 text-[11.5px] text-ink-400">{copy.revenueTrendSub}</p>
            </div>
            <Badge tone="success" dot>{copy.live}</Badge>
          </div>
          <OrdersAreaChart
            data={series}
            label={dict.admin.charts.revenueShort}
            emptyLabel={dict.admin.charts.noDataPeriod}
            locale={locale}
          />
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-1 text-[13px] font-bold uppercase tracking-[0.12em] text-ink-400">{copy.salesByTier}</h2>
          <p className="mb-3 text-[11.5px] text-ink-400">{copy.salesByTierSub}</p>
          <TierDonutChart
            data={[
              { name: dict.tier.RETAIL, value: data.tiers.RETAIL.revenue, color: '#f56600' },
              { name: dict.tier.WHOLESALE, value: data.tiers.WHOLESALE.revenue, color: '#17181d' },
              { name: dict.tier.SUPER_WHOLESALE, value: data.tiers.SUPER_WHOLESALE.revenue, color: '#8d909c' },
            ]}
            emptyLabel={dict.admin.charts.noData}
            totalLabel={dict.admin.charts.total}
            currencyLabel={dict.common.currency}
            locale={locale}
          />
          <div className="mt-3 space-y-1.5">
            {[
              { label: dict.tier.RETAIL, value: data.tiers.RETAIL.revenue, count: data.tiers.RETAIL.count, color: 'bg-brand-500' },
              { label: dict.tier.WHOLESALE, value: data.tiers.WHOLESALE.revenue, count: data.tiers.WHOLESALE.count, color: 'bg-ink-900' },
              { label: dict.tier.SUPER_WHOLESALE, value: data.tiers.SUPER_WHOLESALE.revenue, count: data.tiers.SUPER_WHOLESALE.count, color: 'bg-ink-400' },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between text-[11.5px]">
                <span className="flex items-center gap-1.5 text-ink-500">
                  <span className={`h-2 w-2 rounded-full ${row.color}`} />
                  {row.label}
                  <span className="text-ink-300">· {row.count}</span>
                </span>
                <span className="font-bold text-ink-800 tabular-nums" dir="ltr">{formatDA(row.value, locale)}</span>
              </div>
            ))}
          </div>
          {tierTotal === 0 && <p className="mt-2 text-center text-[11px] text-ink-400">{copy.noSalesInPeriod}</p>}
        </div>
      </div>

      {/* secondary KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: copy.confirmed, value: data.orders.confirmed, icon: CircleCheck, tone: 'text-sky-600 bg-sky-50' },
          { label: copy.delivered, value: data.orders.completed, icon: CircleCheck, tone: 'text-emerald-600 bg-emerald-50' },
          { label: copy.cancelled, value: data.orders.cancelled, icon: CircleX, tone: 'text-red-600 bg-red-50' },
          { label: copy.products, value: data.products.total, icon: Package, tone: 'text-ink-700 bg-ink-100' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white px-4 py-3.5 shadow-card">
            <span className={`grid h-9 w-9 place-items-center rounded-xl ${item.tone}`}>
              <item.icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-ink-400">{item.label}</p>
              <p className="text-[17px] font-extrabold leading-tight text-ink-900 tabular-nums">{formatNumber(item.value, locale)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* recent orders */}
        <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card lg:col-span-2">
          <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-ink-400">{copy.recentOrders}</h2>
            <Link href="/admin/orders" className="inline-flex items-center gap-1 text-[11.5px] font-bold text-brand-600 hover:underline">
              {copy.viewAll} <ArrowRight className="h-3 w-3 rtl:rotate-180" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-ink-100 text-start text-[10px] uppercase tracking-wider text-ink-400">
                  <th className="px-5 py-2 text-start font-bold">{copy.colOrder}</th>
                  <th className="px-3 py-2 text-start font-bold">{copy.colCustomer}</th>
                  <th className="px-3 py-2 text-start font-bold">{copy.colType}</th>
                  <th className="px-3 py-2 text-start font-bold">{copy.colStatus}</th>
                  <th className="px-5 py-2 text-end font-bold">{copy.colTotal}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {recentOrders.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-ink-50/60">
                    <td className="px-5 py-2.5">
                      <Link href={`/admin/orders/${order.id}`} className="text-[12px] font-bold text-ink-900 hover:text-brand-600" dir="ltr">
                        {order.orderNumber}
                      </Link>
                      <p className="text-[10px] text-ink-400">{formatDateTime(order.createdAt, locale)}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-[12px] font-medium text-ink-800">{order.customerNameSnapshot}</p>
                      <p className="text-[10px] text-ink-400" dir="ltr">{order.customerPhoneSnapshot}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={order.customerTypeSnapshot === 'SUPER_WHOLESALE' ? 'violet' : order.customerTypeSnapshot === 'WHOLESALE' ? 'blue' : 'neutral'}>
                        {dict.tier[order.customerTypeSnapshot as keyof typeof dict.tier]}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5">
                      <OrderStatusBadge
                        status={order.status}
                        label={dict.status[order.status as keyof typeof dict.status]}
                      />
                    </td>
                    <td className="px-5 py-2.5 text-end text-[12px] font-bold text-ink-900 tabular-nums" dir="ltr">
                      {formatDA(order.totalAmount, locale)}
                    </td>
                  </tr>
                ))}
                {recentOrders.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-[12px] text-ink-400">{copy.noOrders}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* right rail */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.12em] text-ink-400">
                <Boxes className="h-3.5 w-3.5" /> {copy.stockTitle}
              </h2>
              <Link href="/admin/stock" className="text-[11px] font-bold text-brand-600 hover:underline">{copy.manage}</Link>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-ink-50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-ink-400">{copy.units}</p>
                <p className="text-[16px] font-extrabold text-ink-900 tabular-nums">{formatNumber(data.products.totalStock, locale)}</p>
              </div>
              <div className="rounded-xl bg-amber-50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700/70">{copy.reserved}</p>
                <p className="text-[16px] font-extrabold text-amber-800 tabular-nums">{formatNumber(data.products.reserved, locale)}</p>
              </div>
              <div className="rounded-xl bg-orange-50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-orange-700/70">{copy.lowStock}</p>
                <p className="text-[16px] font-extrabold text-orange-800 tabular-nums">{formatNumber(data.products.low, locale)}</p>
              </div>
              <div className="rounded-xl bg-red-50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-red-700/70">{copy.outOfStock}</p>
                <p className="text-[16px] font-extrabold text-red-800 tabular-nums">{formatNumber(data.products.out, locale)}</p>
              </div>
            </div>
            {lowStock.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {lowStock.slice(0, 3).map((variant) => (
                  <li key={variant.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate text-ink-600">
                      {translate(variant.product.translations, locale) || variant.product.sku}
                    </span>
                    <span className={`shrink-0 font-bold tabular-nums ${variant.stockQuantity === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {variant.stockQuantity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-[13px] font-bold uppercase tracking-[0.12em] text-ink-400">
                <FileText className="h-3.5 w-3.5" /> {copy.toInvoice}
              </h2>
              <Link href="/admin/invoices" className="text-[11px] font-bold text-brand-600 hover:underline">{copy.invoicesLink}</Link>
            </div>
            {pendingInvoices.length === 0 ? (
              <p className="text-[11.5px] text-ink-400">{copy.allInvoiced}</p>
            ) : (
              <ul className="space-y-1.5">
                {pendingInvoices.map((order) => (
                  <li key={order.id}>
                    <Link href={`/admin/orders/${order.id}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[11.5px] hover:bg-ink-50">
                      <span className="font-bold text-ink-800" dir="ltr">{order.orderNumber}</span>
                      <span className="font-semibold text-ink-500 tabular-nums" dir="ltr">{formatDA(order.totalAmount, locale)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-ink-400">{copy.topSalesAndCategories}</h2>
          <Link href="/admin/reports" className="inline-flex items-center gap-1 text-[11.5px] font-bold text-brand-600 hover:underline">
            {copy.reportsLink} <ArrowRight className="h-3 w-3 rtl:rotate-180" />
          </Link>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-ink-400">{copy.productsSection}</p>
            <ul className="space-y-2">
              {data.topProducts.map((product, index) => (
                <li key={`${product.name}-${index}`} className="flex items-center gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-ink-100 text-[10px] font-bold text-ink-500">{index + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-ink-800">{product.name}</span>
                  <span className="text-[10.5px] text-ink-400 tabular-nums">{product.units} {copy.unitAbbr}</span>
                  <span className="w-24 text-end text-[11.5px] font-bold text-ink-900 tabular-nums" dir="ltr">{formatDA(product.revenue, locale)}</span>
                </li>
              ))}
              {data.topProducts.length === 0 && <li className="text-[11.5px] text-ink-400">{copy.noSales}</li>}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-ink-400">{copy.categoriesSection}</p>
            <CategoryBarsChart
              data={data.salesByCategory}
              emptyLabel={dict.admin.charts.noSalesPeriod}
              tooltipLabel={dict.admin.charts.revenueShort}
              locale={locale}
            />
          </div>
        </div>
      </div>

      {data.products.low > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-[12px] text-amber-900">
            {interpolate(copy.lowStockAlert, { low: data.products.low, out: data.products.out })}
            <Link href="/admin/stock" className="ms-1 font-bold underline">{copy.restock}</Link>
          </p>
        </div>
      )}
    </div>
  );
}
