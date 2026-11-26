import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, can } from '@/lib/auth';
import { resolveRange } from '@/lib/services/analytics';

export const dynamic = 'force-dynamic';

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** French CSV export (semicolon separator + BOM so Excel opens it correctly). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user, 'manageOrders')) {
    return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
  }

  const url = new URL(request.url);
  const range = resolveRange(url.searchParams.get('range') ?? '30d');
  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: range.from, lte: range.to } },
    include: { items: true, invoices: { select: { number: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const header = [
    'Numero',
    'Date',
    'Client',
    'Telephone',
    'Ville',
    'Palier',
    'Statut',
    'Articles',
    'Sous-total (DA)',
    'Livraison (DA)',
    'Total (DA)',
    'Facture',
  ];

  const rows = orders.map((order) => [
    order.orderNumber,
    order.createdAt.toISOString().slice(0, 10),
    order.customerNameSnapshot,
    order.customerPhoneSnapshot,
    order.customerCitySnapshot ?? '',
    order.customerTypeSnapshot,
    order.status,
    order.items.reduce((sum, item) => sum + item.quantity, 0),
    Number(order.subtotal).toFixed(2),
    Number(order.deliveryFee).toFixed(2),
    Number(order.totalAmount).toFixed(2),
    order.invoices[0]?.number ?? '',
  ]);

  const csv = '\uFEFF' + [header, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
  const filename = `amaya-commandes-${range.from.toISOString().slice(0, 10)}_${range.to.toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}
