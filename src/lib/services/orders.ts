import 'server-only';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { type OrderStatus, canTransition, SALE_STATUSES } from '@/lib/pricing';
import type { Tier } from '@/lib/pricing';
import { formatInvoiceNumber, formatOrderNumber, nextSequence } from '@/lib/services/sequence';
import { quoteCart, type CartLineInput } from '@/lib/services/pricing-service';
import { logAudit } from '@/lib/audit';

export type PlaceOrderInput = {
  items: CartLineInput[];
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerCity?: string;
  notes?: string;
  deliveryMethod?: 'DELIVERY' | 'PICKUP';
  tier: Tier;
  customerId?: string | null;
  createdById?: string | null;
  locale?: string;
  discount?: string;
};

export type PlacedOrder = {
  id: string;
  orderNumber: string;
  totalAmount: string;
  status: OrderStatus;
};

/**
 * Create an order.
 *
 * 1. The tier comes from the authenticated session (never the client).
 * 2. quoteCart re-reads prices, minimum quantities and stock from the database.
 * 3. Everything is written in one transaction, so a price change mid-flight or
 *    a concurrent stock reservation cannot produce a half-written order.
 */
export async function placeOrder(input: PlaceOrderInput): Promise<PlacedOrder> {
  if (!input.items?.length) throw new AppError('VALIDATION', 'Cart is empty');

  const quote = await quoteCart(input.items, input.tier, {
    locale: input.locale,
    deliveryMethod: input.deliveryMethod,
    discount: input.discount,
  });

  if (quote.errors.length > 0) {
    const first = quote.errors[0];
    const code = first.code === 'STOCK' ? 'STOCK' : first.code === 'MIN_QTY' ? 'MIN_QTY' : 'VALIDATION';
    throw new AppError(code, first.message, 409, { errors: quote.errors });
  }
  if (quote.lines.length === 0) throw new AppError('VALIDATION', 'Cart is empty');

  const order = await prisma.$transaction(async (tx) => {
    const seq = await nextSequence('order', tx as never);
    const orderNumber = formatOrderNumber(seq);

    const created = await tx.order.create({
      data: {
        orderNumber,
        customerId: input.customerId ?? null,
        customerNameSnapshot: input.customerName.trim(),
        customerPhoneSnapshot: input.customerPhone.trim(),
        customerAddressSnapshot: input.customerAddress.trim(),
        customerCitySnapshot: input.customerCity?.trim() || null,
        customerTypeSnapshot: input.tier as never,
        subtotal: quote.subtotal,
        discount: quote.discount,
        deliveryFee: quote.deliveryFee,
        totalAmount: quote.total,
        status: 'PENDING',
        deliveryMethod: input.deliveryMethod === 'PICKUP' ? 'PICKUP' : 'DELIVERY',
        notes: input.notes?.trim() || null,
        createdById: input.createdById ?? input.customerId ?? null,
        items: {
          create: quote.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            productNameSnapshot: line.productName,
            productNameFrSnapshot: line.productNameFr,
            skuSnapshot: line.sku,
            colorSnapshot: line.colorFr,
            quantity: line.quantity,
            unitPriceSnapshot: line.unitPrice,
            lineTotal: line.lineTotal,
            tierSnapshot: input.tier as never,
          })),
        },
        statusHistory: {
          create: {
            fromStatus: null,
            toStatus: 'PENDING',
            note: 'Order created',
            changedById: input.customerId ?? input.createdById ?? null,
          },
        },
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: input.customerId ?? input.createdById ?? null,
        actorName: input.customerName.trim(),
        action: 'order.create',
        entityType: 'Order',
        entityId: created.id,
        summary: `Order ${orderNumber} created (${input.tier}) — ${quote.total} DA`,
        metadata: { tier: input.tier, lines: quote.lines.length } as never,
      },
    });

    return created;
  });

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    totalAmount: String(order.totalAmount),
    status: order.status as OrderStatus,
  };
}

export type StatusChangeInput = {
  orderId: string;
  to: OrderStatus;
  actor: { id: string; name: string };
  note?: string;
};

/**
 * Change an order status with all the stock side effects.
 *
 * PENDING        — stock untouched.
 * CONFIRMED      — stock reserved atomically for every line. If any line lacks
 *                  availability the whole confirmation rolls back, so two
 *                  simultaneous confirmations can never oversell.
 * PREPARING/READY— bookkeeping only, reservation kept.
 * SHIPPED        — reservation converts to a real stock deduction.
 * DELIVERED      — bookkeeping only.
 * CANCELLED      — reservation released (if held) or nothing (if pending).
 */
export async function changeOrderStatus(input: StatusChangeInput) {
  const { orderId, to, actor } = input;

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) throw new AppError('NOT_FOUND', 'Order not found');

    const from = order.status as OrderStatus;
    if (from === to) throw new AppError('VALIDATION', 'Order already has this status');
    if (!canTransition(from, to)) {
      throw new AppError('VALIDATION', `Cannot move an order from ${from} to ${to}`);
    }

    if (to === 'CONFIRMED') {
      for (const item of order.items) {
        if (!item.variantId) continue;
        // Atomic reservation: compare-and-set on availability.
        const updated = await tx.$executeRawUnsafe(
          `UPDATE "ProductVariant"
             SET "reservedQuantity" = "reservedQuantity" + $1, "updatedAt" = now()
           WHERE "id" = $2 AND "stockQuantity" - "reservedQuantity" >= $1`,
          item.quantity,
          item.variantId,
        );
        if (updated === 0) {
          throw new AppError(
            'STOCK',
            `Insufficient stock to confirm ${item.productNameSnapshot} (${item.skuSnapshot})`,
            409,
          );
        }
        const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            type: 'RESERVATION',
            quantity: -item.quantity,
            resultingQuantity: variant?.stockQuantity ?? 0,
            orderId: order.id,
            userId: actor.id,
            reason: `Reserved for ${order.orderNumber}`,
          },
        });
      }
    }

    if (to === 'CANCELLED' && order.status !== 'PENDING') {
      for (const item of order.items) {
        if (!item.variantId) continue;
        const updated = await tx.$executeRawUnsafe(
          `UPDATE "ProductVariant"
             SET "reservedQuantity" = "reservedQuantity" - $1, "updatedAt" = now()
           WHERE "id" = $2 AND "reservedQuantity" >= $1`,
          item.quantity,
          item.variantId,
        );
        if (updated > 0) {
          const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
          await tx.stockMovement.create({
            data: {
              variantId: item.variantId,
              type: 'RELEASE',
              quantity: item.quantity,
              resultingQuantity: variant?.stockQuantity ?? 0,
              orderId: order.id,
              userId: actor.id,
              reason: `Released from cancelled ${order.orderNumber}`,
            },
          });
        }
      }
    }

    if (to === 'SHIPPED') {
      for (const item of order.items) {
        if (!item.variantId) continue;
        // Convert reservation into a completed deduction.
        const updated = await tx.$executeRawUnsafe(
          `UPDATE "ProductVariant"
             SET "stockQuantity" = "stockQuantity" - $1,
                 "reservedQuantity" = "reservedQuantity" - $1,
                 "updatedAt" = now()
           WHERE "id" = $2 AND "reservedQuantity" >= $1 AND "stockQuantity" >= $1`,
          item.quantity,
          item.variantId,
        );
        if (updated === 0) {
          throw new AppError('STOCK', `Stock changed for ${item.skuSnapshot}; cannot ship`, 409);
        }
        const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            type: 'SHIPMENT',
            quantity: -item.quantity,
            resultingQuantity: variant?.stockQuantity ?? 0,
            orderId: order.id,
            userId: actor.id,
            reason: `Shipped with ${order.orderNumber}`,
          },
        });
        // Keep aggregates for storefront analytics.
        if (item.productId) {
          await tx.product.update({
            where: { id: item.productId },
            data: { salesCount: { increment: item.quantity } },
          });
        }
      }
    }

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: to as never,
        ...(to === 'CONFIRMED' ? { confirmedAt: new Date() } : {}),
        ...(to === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
        ...(to === 'CANCELLED' ? { cancelledAt: new Date() } : {}),
      },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        fromStatus: from as never,
        toStatus: to as never,
        note: input.note ?? null,
        changedById: actor.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorName: actor.name,
        action: 'order.status',
        entityType: 'Order',
        entityId: order.id,
        summary: `${order.orderNumber}: ${from} → ${to}`,
        metadata: { note: input.note ?? null } as never,
      },
    });

    return updated;
  });
}

/** Cancel an order owned by a customer (self-service). */
export async function cancelOwnOrder(orderId: string, customerId: string, customerName: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, customerId } });
  if (!order) throw new AppError('NOT_FOUND', 'Order not found');
  if (order.status !== 'PENDING') {
    throw new AppError('VALIDATION', 'Only pending orders can be cancelled online. Please contact us.');
  }
  return changeOrderStatus({
    orderId,
    to: 'CANCELLED',
    actor: { id: customerId, name: customerName },
    note: 'Cancelled by customer',
  });
}

/**
 * Permanently remove an admin order and all of its invoice versions. Orders in
 * CONFIRMED, PREPARING or READY still hold stock, so those reservations are
 * released before the order is removed. The invoice rows are deleted first
 * explicitly; InvoiceItem rows then follow their cascade constraint.
 */
export async function deleteOrder(orderId: string, actor: { id: string; name: string }) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        invoices: { select: { id: true, number: true } },
      },
    });
    if (!order) throw new AppError('NOT_FOUND', 'Order not found');

    const releasesStock = order.status === 'CONFIRMED' || order.status === 'PREPARING' || order.status === 'READY';
    if (releasesStock) {
      for (const item of order.items) {
        if (!item.variantId) continue;
        const updated = await tx.$executeRawUnsafe(
          `UPDATE "ProductVariant"
             SET "reservedQuantity" = "reservedQuantity" - $1, "updatedAt" = now()
           WHERE "id" = $2 AND "reservedQuantity" >= $1`,
          item.quantity,
          item.variantId,
        );
        if (updated === 0) {
          throw new AppError('CONFLICT', `Stock reservation for ${item.skuSnapshot} could not be released`);
        }
        const variant = await tx.productVariant.findUnique({ where: { id: item.variantId } });
        await tx.stockMovement.create({
          data: {
            variantId: item.variantId,
            type: 'RELEASE',
            quantity: item.quantity,
            resultingQuantity: variant?.stockQuantity ?? 0,
            orderId: order.id,
            userId: actor.id,
            reason: `Released when ${order.orderNumber} was deleted`,
          },
        });
      }
    }

    const invoiceCount = order.invoices.length;
    await tx.invoice.deleteMany({ where: { orderId: order.id } });
    await tx.order.delete({ where: { id: order.id } });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorName: actor.name,
        action: 'order.delete',
        entityType: 'Order',
        entityId: order.id,
        summary: `Order ${order.orderNumber} deleted${invoiceCount > 0 ? ` with ${invoiceCount} invoice(s)` : ''}`,
        metadata: { orderNumber: order.orderNumber, invoiceCount } as never,
      },
    });

    return { id: order.id, orderNumber: order.orderNumber, invoiceCount };
  });
}

/** Issue (or re-issue) a French invoice, snapshotting every value. */
export async function issueInvoice(orderId: string, actor: { id: string; name: string }) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) throw new AppError('NOT_FOUND', 'Order not found');
  if (order.status === 'PENDING' || order.status === 'CANCELLED') {
    throw new AppError('VALIDATION', 'Invoices can only be issued for confirmed orders');
  }

  return prisma.$transaction(async (tx) => {
    const previous = await tx.invoice.findMany({
      where: { orderId },
      orderBy: { version: 'desc' },
      take: 1,
    });
    const version = (previous[0]?.version ?? 0) + 1;
    const number = formatInvoiceNumber(await nextSequence('invoice', tx as never));

    const invoice = await tx.invoice.create({
      data: {
        number,
        orderId,
        version,
        issuedById: actor.id,
        customerNameSnapshot: order.customerNameSnapshot,
        customerPhoneSnapshot: order.customerPhoneSnapshot,
        customerAddressSnapshot: [order.customerAddressSnapshot, order.customerCitySnapshot]
          .filter(Boolean)
          .join(', '),
        subtotal: order.subtotal,
        discount: order.discount,
        deliveryFee: order.deliveryFee,
        totalAmount: order.totalAmount,
        notes: order.notes,
        snapshot: {
          orderNumber: order.orderNumber,
          customerType: order.customerTypeSnapshot,
          deliveryMethod: order.deliveryMethod,
          issuedAt: new Date().toISOString(),
        } as never,
        items: {
          create: order.items.map((item) => ({
            reference: item.skuSnapshot,
            designation: item.productNameFrSnapshot ?? item.productNameSnapshot,
            color: item.colorSnapshot,
            quantity: item.quantity,
            unitPrice: item.unitPriceSnapshot,
            lineTotal: item.lineTotal,
          })),
        },
      },
      include: { items: true },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorName: actor.name,
        action: version === 1 ? 'invoice.issue' : 'invoice.reissue',
        entityType: 'Invoice',
        entityId: invoice.id,
        summary: `Invoice ${number} (v${version}) issued for ${order.orderNumber}`,
        metadata: { orderId, total: String(order.totalAmount) } as never,
      },
    });

    return invoice;
  });
}

/** Analytics helper reused by dashboard KPIs. */
export function saleStatusFilter() {
  return { status: { in: SALE_STATUSES } } as const;
}
