import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, isStaff } from '@/lib/auth';
import { renderInvoicePdf } from '@/lib/invoice-pdf';

export const runtime = 'nodejs';

/** Server-generated PDF invoice (A4, French only). */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true, order: true },
  });
  if (!invoice) return new NextResponse('Not found', { status: 404 });
  if (!isStaff(user) && invoice.order.customerId !== user.id) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const pdf = await renderInvoicePdf({
    number: invoice.number,
    version: invoice.version,
    issuedAt: invoice.issuedAt,
    customerName: invoice.customerNameSnapshot,
    customerPhone: invoice.customerPhoneSnapshot,
    customerAddress: invoice.customerAddressSnapshot,
    subtotal: String(invoice.subtotal),
    discount: String(invoice.discount),
    deliveryFee: String(invoice.deliveryFee),
    totalAmount: String(invoice.totalAmount),
    notes: invoice.notes,
    orderNumber: invoice.order.orderNumber,
    orderStatus: invoice.order.status,
    customerType: invoice.order.customerTypeSnapshot,
    items: invoice.items.map((item) => ({
      reference: item.reference,
      designation: item.designation,
      color: item.color,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice),
      lineTotal: String(item.lineTotal),
    })),
  });

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${invoice.number}.pdf"`,
      'cache-control': 'no-store',
    },
  });
}
