import 'server-only';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';

export type StockAdjustment = {
  variantId: string;
  delta: number;
  reason?: string;
  actor: { id: string; name: string };
  type?: 'RESTOCK' | 'ADJUSTMENT' | 'RETURN';
};

/**
 * Adjust a variant's stock atomically and keep an immutable movement record.
 * Negative stock is rejected by a database CHECK as a final line of defence.
 */
export async function adjustStock(input: StockAdjustment) {
  return prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.findUnique({ where: { id: input.variantId } });
    if (!variant) throw new AppError('NOT_FOUND', 'Variant not found');

    const next = variant.stockQuantity + input.delta;
    if (next < variant.reservedQuantity || next < 0) {
      throw new AppError(
        'STOCK',
        `Stock cannot go below the reserved quantity (${variant.reservedQuantity})`,
        409,
      );
    }

    const updated = await tx.productVariant.update({
      where: { id: input.variantId },
      data: { stockQuantity: next },
    });

    await tx.stockMovement.create({
      data: {
        variantId: input.variantId,
        type: input.type ?? (input.delta >= 0 ? 'RESTOCK' : 'ADJUSTMENT'),
        quantity: input.delta,
        resultingQuantity: next,
        reason: input.reason ?? null,
        userId: input.actor.id,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: input.actor.id,
        actorName: input.actor.name,
        action: 'stock.adjust',
        entityType: 'ProductVariant',
        entityId: input.variantId,
        summary: `${variant.sku}: ${input.delta > 0 ? '+' : ''}${input.delta} → ${next}`,
        metadata: { reason: input.reason ?? null } as never,
      },
    });

    // Keep the product status coherent with reality.
    const siblings = await tx.productVariant.findMany({
      where: { productId: variant.productId, isActive: true },
      select: { stockQuantity: true, reservedQuantity: true },
    });
    const available = siblings.reduce((sum, v) => sum + Math.max(0, v.stockQuantity - v.reservedQuantity), 0);
    const product = await tx.product.findUnique({ where: { id: variant.productId } });
    if (product && (product.status === 'AVAILABLE' || product.status === 'OUT_OF_STOCK')) {
      await tx.product.update({
        where: { id: product.id },
        data: { status: available > 0 ? 'AVAILABLE' : 'OUT_OF_STOCK' },
      });
    }

    return updated;
  });
}

export async function lowStockVariants(threshold = 5, take = 8) {
  return prisma.productVariant.findMany({
    where: { isActive: true, stockQuantity: { lte: threshold } },
    include: { product: { include: { translations: true } } },
    orderBy: { stockQuantity: 'asc' },
    take,
  });
}
