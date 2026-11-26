import 'server-only';
import { prisma } from '@/lib/prisma';
import { SALE_STATUSES } from '@/lib/pricing';

export type DateRange = { from: Date; to: Date };

export function resolveRange(preset: string, from?: string, to?: string): DateRange {
  const now = new Date();
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const endOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return { from: startOfDay(yesterday), to: endOfDay(yesterday) };
    }
    case '7d': {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      return { from: startOfDay(start), to: endOfDay(now) };
    }
    case '30d': {
      const start = new Date(now);
      start.setDate(now.getDate() - 29);
      return { from: startOfDay(start), to: endOfDay(now) };
    }
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
    case 'lastMonth':
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999),
      };
    case 'year':
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
    case 'custom':
      if (from && to) {
        return { from: startOfDay(new Date(from)), to: endOfDay(new Date(to)) };
      }
      return { from: new Date(now.getFullYear(), 0, 1), to: endOfDay(now) };
    case 'all':
    default:
      return { from: new Date(2020, 0, 1), to: endOfDay(now) };
  }
}

export const RANGE_PRESETS = [
  'today',
  'yesterday',
  '7d',
  '30d',
  'month',
  'lastMonth',
  'year',
  'all',
] as const;

const salesWhere = (range: DateRange) => ({
  createdAt: { gte: range.from, lte: range.to },
  status: { in: SALE_STATUSES as never },
});

/** Sum helper used for revenue-by-tier cards. */
async function revenueByTier(range: DateRange) {
  const rows = await prisma.order.groupBy({
    by: ['customerTypeSnapshot'],
    where: salesWhere(range),
    _sum: { totalAmount: true },
    _count: { _all: true },
  });
  const map: Record<string, { revenue: number; count: number }> = {
    RETAIL: { revenue: 0, count: 0 },
    WHOLESALE: { revenue: 0, count: 0 },
    SUPER_WHOLESALE: { revenue: 0, count: 0 },
  };
  for (const row of rows) {
    map[row.customerTypeSnapshot] = {
      revenue: Number(row._sum.totalAmount ?? 0),
      count: row._count._all,
    };
  }
  return map;
}

export async function getDashboardData(range: DateRange) {
  const [
    totalOrders,
    byStatus,
    revenue,
    productCounts,
    stockAgg,
    customerCounts,
    byTier,
    topProducts,
    byCategory,
    monthly,
  ] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: range.from, lte: range.to } } }),
    prisma.order.groupBy({
      by: ['status'],
      where: { createdAt: { gte: range.from, lte: range.to } },
      _count: { _all: true },
    }),
    prisma.order.aggregate({
      where: salesWhere(range),
      _sum: { totalAmount: true, subtotal: true, discount: true },
      _avg: { totalAmount: true },
      _count: { _all: true },
    }),
    prisma.product.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.$queryRawUnsafe<{ total_stock: number | null; reserved: number | null; low: number | null; out: number | null }[]>(`
      SELECT
        COALESCE(SUM(v."stockQuantity"), 0)::int AS total_stock,
        COALESCE(SUM(v."reservedQuantity"), 0)::int AS reserved,
        COUNT(*) FILTER (WHERE v."stockQuantity" - v."reservedQuantity" BETWEEN 1 AND 5 AND v."isActive")::int AS low,
        COUNT(*) FILTER (WHERE v."stockQuantity" - v."reservedQuantity" <= 0 AND v."isActive")::int AS out
      FROM "ProductVariant" v
    `),
    prisma.user.groupBy({
      by: ['tier'],
      where: { role: 'CUSTOMER' },
      _count: { _all: true },
    }),
    revenueByTier(range),
    prisma.orderItem.groupBy({
      by: ['productId'],
      where: { order: salesWhere(range) },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: 'desc' } },
      take: 6,
    }),
    prisma.$queryRawUnsafe<{ name: string; revenue: number; units: number }[]>(
      `
      SELECT COALESCE(pt."name", p."sku") AS name,
             COALESCE(SUM(oi."lineTotal"), 0)::float AS revenue,
             COALESCE(SUM(oi."quantity"), 0)::int AS units
      FROM "OrderItem" oi
      JOIN "Order" o ON o."id" = oi."orderId"
      LEFT JOIN "Product" p ON p."id" = oi."productId"
      LEFT JOIN "ProductTranslation" pt ON pt."productId" = p."id" AND pt."locale" = 'FR'
      WHERE o."createdAt" BETWEEN $1 AND $2 AND o."status" = ANY($3::"OrderStatus"[])
      GROUP BY COALESCE(pt."name", p."sku")
      ORDER BY revenue DESC
      LIMIT 6
      `,
      range.from,
      range.to,
      SALE_STATUSES,
    ),
    prisma.$queryRawUnsafe<{ bucket: string; revenue: number; orders: number }[]>(
      `
      SELECT to_char(date_trunc('month', o."createdAt"), 'YYYY-MM') AS bucket,
             COALESCE(SUM(o."totalAmount"), 0)::float AS revenue,
             COUNT(*)::int AS orders
      FROM "Order" o
      WHERE o."status" = ANY($1::"OrderStatus"[])
      GROUP BY bucket
      ORDER BY bucket ASC
      LIMIT 12
      `,
      SALE_STATUSES,
    ),
  ]);

  const statusMap: Record<string, number> = {};
  for (const row of byStatus) statusMap[row.status] = row._count._all;

  const productStatusMap: Record<string, number> = {};
  for (const row of productCounts) productStatusMap[row.status] = row._count._all;

  const tierMap: Record<string, number> = {};
  for (const row of customerCounts) if (row.tier) tierMap[row.tier] = row._count._all;

  // Top product names.
  const productIds = topProducts.map((row) => row.productId).filter(Boolean) as string[];
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        include: { translations: true },
      })
    : [];
  const productName = (id: string | null) => {
    if (!id) return '—';
    const product = products.find((p) => p.id === id);
    return product?.translations.find((t) => t.locale === 'FR')?.name ?? product?.sku ?? '—';
  };

  const stock = stockAgg[0] ?? { total_stock: 0, reserved: 0, low: 0, out: 0 };

  return {
    orders: {
      total: totalOrders,
      byStatus: statusMap,
      pending: statusMap.PENDING ?? 0,
      confirmed: (statusMap.CONFIRMED ?? 0) + (statusMap.PREPARING ?? 0) + (statusMap.READY ?? 0),
      completed: statusMap.DELIVERED ?? 0,
      cancelled: statusMap.CANCELLED ?? 0,
    },
    revenue: {
      total: Number(revenue._sum.totalAmount ?? 0),
      subtotal: Number(revenue._sum.subtotal ?? 0),
      discount: Number(revenue._sum.discount ?? 0),
      average: Number(revenue._avg.totalAmount ?? 0),
      orderCount: revenue._count._all,
    },
    tiers: {
      RETAIL: byTier.RETAIL,
      WHOLESALE: byTier.WHOLESALE,
      SUPER_WHOLESALE: byTier.SUPER_WHOLESALE,
    },
    products: {
      total: Object.values(productStatusMap).reduce((sum, n) => sum + n, 0),
      available: productStatusMap.AVAILABLE ?? 0,
      out: stock.out ?? 0,
      low: stock.low ?? 0,
      archived: productStatusMap.ARCHIVED ?? 0,
      hidden: productStatusMap.HIDDEN ?? 0,
      totalStock: stock.total_stock ?? 0,
      reserved: stock.reserved ?? 0,
    },
    customers: {
      total: customerCounts.reduce((sum, row) => sum + row._count._all, 0),
      wholesale: tierMap.WHOLESALE ?? 0,
      superWholesale: tierMap.SUPER_WHOLESALE ?? 0,
      retail: Math.max(0, (customerCounts.reduce((sum, row) => sum + row._count._all, 0)) - (tierMap.WHOLESALE ?? 0) - (tierMap.SUPER_WHOLESALE ?? 0)),
    },
    topProducts: topProducts.map((row) => ({
      name: productName(row.productId),
      units: row._sum.quantity ?? 0,
      revenue: Number(row._sum.lineTotal ?? 0),
    })),
    salesByCategory: byCategory.map((row) => ({
      name: row.name,
      revenue: Number(row.revenue),
      units: Number(row.units),
    })),
    monthly: monthly.map((row) => ({ bucket: row.bucket, revenue: Number(row.revenue), orders: Number(row.orders) })),
  };
}

/** Orders-per-day series for the current range (sparkline / area chart). */
export async function getOrderSeries(range: DateRange) {
  const rows = await prisma.$queryRawUnsafe<{ day: string; revenue: number; orders: number }[]>(
    `
    SELECT to_char(date_trunc('day', o."createdAt"), 'YYYY-MM-DD') AS day,
           COALESCE(SUM(o."totalAmount"), 0)::float AS revenue,
           COUNT(*)::int AS orders
    FROM "Order" o
    WHERE o."createdAt" BETWEEN $1 AND $2 AND o."status" <> 'CANCELLED'
    GROUP BY day
    ORDER BY day ASC
    `,
    range.from,
    range.to,
  );
  return rows.map((row) => ({ day: row.day, revenue: Number(row.revenue), orders: Number(row.orders) }));
}
