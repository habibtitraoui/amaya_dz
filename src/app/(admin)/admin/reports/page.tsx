import { Download, TrendingUp, Users, Package, Receipt, Wallet, ShoppingBag } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { formatDA } from '@/lib/money';
import { getDashboardData, getOrderSeries, resolveRange } from '@/lib/services/analytics';
import { RangeFilter } from '@/components/admin/range-filter';
import { OrdersAreaChart, CategoryBarsChart, MonthlyBarsChart } from '@/components/admin/charts';
import { KpiCard } from '@/components/admin/kpi-card';

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

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rangeKey = (Array.isArray(params.range) ? params.range[0] : params.range) ?? '30d';
  const range = resolveRange(rangeKey);
  const [dashboard, series, statuses, cities, customers, invoices] = await Promise.all([
    getDashboardData(range),
    getOrderSeries(range),
    prisma.order.groupBy({
      by: ['status'],
      where: { createdAt: { gte: range.from, lte: range.to } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.order.groupBy({
      by: ['customerCitySnapshot'],
      where: { status: { in: ['DELIVERED', 'SHIPPED'] }, createdAt: { gte: range.from, lte: range.to } },
      _count: { _all: true },
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
      take: 8,
    }),
    prisma.user.findMany({
      where: { role: 'CUSTOMER' },
      include: {
        orders: {
          where: { status: { in: ['DELIVERED', 'SHIPPED', 'READY'] }, createdAt: { gte: range.from, lte: range.to } },
          select: { totalAmount: true },
        },
      },
    }),
    prisma.invoice.aggregate({
      where: { issuedAt: { gte: range.from, lte: range.to } },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
  ]);

  const salesTotal = dashboard.revenue.total;
  const averageBasket = dashboard.orders.total > 0 ? salesTotal / Math.max(1, dashboard.orders.completed + dashboard.orders.confirmed) : 0;
  const rankedCustomers = customers
    .map((customer) => ({
      id: customer.id,
      name: customer.name,
      tier: customer.tier,
      revenue: customer.orders.reduce((sum, order) => sum + Number(order.totalAmount), 0),
      count: customer.orders.length,
    }))
    .filter((customer) => customer.count > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight text-ink-900">Rapports</h1>
          <p className="text-[12.5px] text-ink-500">Chiffre d’affaires, paliers, produits et clients sur la période.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RangeFilter active={rangeKey} />
          <a
            href={`/api/admin/reports/export?range=${rangeKey}`}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink-900 px-3.5 text-[11.5px] font-bold text-white hover:bg-ink-800"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Chiffre d’affaires" value={formatDA(salesTotal, 'fr')} hint={`${dashboard.revenue.orderCount} commande(s) validée(s)`} tone="brand" icon={<Wallet className="h-4 w-4" />} />
        <KpiCard label="Panier moyen" value={formatDA(averageBasket, 'fr')} hint="hors commandes annulées" tone="ink" icon={<ShoppingBag className="h-4 w-4" />} />
        <KpiCard label="Factures émises" value={String(invoices._count._all)} hint={formatDA(invoices._sum.totalAmount ?? 0, 'fr')} tone="green" icon={<Receipt className="h-4 w-4" />} />
        <KpiCard label="Clients pro actifs" value={String(rankedCustomers.length)} hint={`${dashboard.customers.wholesale} gros · ${dashboard.customers.superWholesale} super gros`} tone="violet" icon={<Users className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Évolution du chiffre d’affaires</h2>
            <span className="text-[11px] text-ink-400">DA / jour</span>
          </div>
          <OrdersAreaChart data={series} label="Chiffre d’affaires" />
        </div>
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
          <h2 className="mb-4 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Ventes par catégorie</h2>
          <CategoryBarsChart data={dashboard.salesByCategory} />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card xl:col-span-2">
          <h2 className="mb-4 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Douze derniers mois</h2>
          <MonthlyBarsChart data={dashboard.monthly} />
        </div>
        <div className="space-y-4">
          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <h2 className="mb-3 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Par statut</h2>
            <ul className="space-y-1.5">
              {statuses.map((row) => (
                <li key={row.status} className="flex items-center justify-between text-[11.5px]">
                  <span className="text-ink-600">{STATUS_FR[row.status] ?? row.status}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-bold text-ink-900 tabular-nums">{row._count._all}</span>
                    <span className="w-24 text-end text-ink-400 tabular-nums" dir="ltr">{formatDA(row._sum.totalAmount ?? 0, 'fr')}</span>
                  </span>
                </li>
              ))}
              {statuses.length === 0 && <li className="text-[11.5px] text-ink-400">Aucune donnée</li>}
            </ul>
          </div>

          <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
            <h2 className="mb-3 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">Top villes</h2>
            <ul className="space-y-1.5">
              {cities.map((row) => (
                <li key={row.customerCitySnapshot ?? 'unknown'} className="flex items-center justify-between text-[11.5px]">
                  <span className="text-ink-600">{row.customerCitySnapshot ?? '—'}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-ink-400 tabular-nums">{row._count._all}</span>
                    <span className="font-bold text-ink-900 tabular-nums" dir="ltr">{formatDA(row._sum.totalAmount ?? 0, 'fr')}</span>
                  </span>
                </li>
              ))}
              {cities.length === 0 && <li className="text-[11.5px] text-ink-400">Aucune donnée</li>}
            </ul>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
          <h2 className="flex items-center gap-1.5 border-b border-ink-100 px-5 py-3 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">
            <TrendingUp className="h-3.5 w-3.5" /> Meilleurs produits
          </h2>
          <ul className="divide-y divide-ink-100">
            {dashboard.topProducts.map((product, index) => (
              <li key={`${product.name}-${index}`} className="flex items-center gap-3 px-5 py-2.5">
                <span className="text-[10px] font-bold text-ink-300 tabular-nums">{String(index + 1).padStart(2, '0')}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-ink-900">{product.name}</p>
                  <p className="text-[10px] text-ink-400">{product.units} unité(s) vendue(s)</p>
                </div>
                <span className="text-[11.5px] font-bold text-ink-900 tabular-nums" dir="ltr">{formatDA(product.revenue, 'fr')}</span>
              </li>
            ))}
            {dashboard.topProducts.length === 0 && <li className="px-5 py-8 text-center text-[12px] text-ink-400">Aucune vente sur la période</li>}
          </ul>
        </div>

        <div className="overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card">
          <h2 className="flex items-center gap-1.5 border-b border-ink-100 px-5 py-3 text-[12.5px] font-bold uppercase tracking-[0.12em] text-ink-400">
            <Users className="h-3.5 w-3.5" /> Meilleurs clients
          </h2>
          <ul className="divide-y divide-ink-100">
            {rankedCustomers.map((customer) => (
              <li key={customer.id} className="flex items-center gap-3 px-5 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-ink-900">{customer.name}</p>
                  <p className="text-[10px] text-ink-400">
                    {customer.count} commande(s) · {customer.tier === 'SUPER_WHOLESALE' ? 'Super Gros' : 'Gros'}
                  </p>
                </div>
                <span className="text-[11.5px] font-bold text-ink-900 tabular-nums" dir="ltr">{formatDA(customer.revenue, 'fr')}</span>
              </li>
            ))}
            {rankedCustomers.length === 0 && <li className="px-5 py-8 text-center text-[12px] text-ink-400">Aucune commande professionnelle</li>}
          </ul>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-ink-100 bg-white p-5 shadow-card sm:grid-cols-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400"><Package className="h-3 w-3" /> Stock disponible</p>
          <p className="text-[16px] font-extrabold text-ink-900 tabular-nums">
            {dashboard.products.totalStock - dashboard.products.reserved} <span className="text-[11px] font-medium text-ink-400">/ {dashboard.products.totalStock}</span>
          </p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400"><Wallet className="h-3 w-3" /> Remises accordées</p>
          <p className="text-[16px] font-extrabold text-amber-600 tabular-nums" dir="ltr">{formatDA(dashboard.revenue.discount, 'fr')}</p>
        </div>
        <div>
          <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-400"><Receipt className="h-3 w-3" /> Taux de livraison</p>
          <p className="text-[16px] font-extrabold text-emerald-600 tabular-nums">
            {dashboard.orders.total > 0 ? `${Math.round((dashboard.orders.completed / dashboard.orders.total) * 100)}%` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}
