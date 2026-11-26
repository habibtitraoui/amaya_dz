import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser, isStaff } from '@/lib/auth';
import { renderInvoiceHtml } from '@/lib/invoice-template';

/**
 * Invoice preview (A4 HTML that the browser can print or "Save as PDF").
 * Invoices are French-only by business rule, whatever the visitor's locale.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { items: true, order: true },
  });
  if (!invoice) return new NextResponse('Not found', { status: 404 });

  // Staff can see any invoice; a customer only their own.
  if (!isStaff(user) && invoice.order.customerId !== user.id) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const url = new URL(request.url);
  const autoPrint = url.searchParams.get('print') === '1';

  const html = renderInvoiceHtml(
    {
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
    },
    { autoPrint },
  );

  return new NextResponse(html, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
