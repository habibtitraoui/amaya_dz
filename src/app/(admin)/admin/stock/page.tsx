import { prisma } from '@/lib/prisma';
import { translate } from '@/lib/i18n';
import { StockManager } from '@/components/admin/stock-manager';

export const dynamic = 'force-dynamic';

export default async function AdminStockPage() {
  const variants = await prisma.productVariant.findMany({
    where: { isActive: true },
    include: {
      product: { include: { translations: true } },
      stockMovements: { orderBy: { createdAt: 'desc' }, take: 5, include: { user: true } },
    },
    orderBy: [{ stockQuantity: 'asc' }],
  });

  const recentMovements = await prisma.stockMovement.findMany({
    orderBy: { createdAt: 'desc' },
    take: 14,
    include: { variant: { include: { product: { include: { translations: true } } } }, user: true },
  });

  return (
    <StockManager
      variants={variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        productName: translate(variant.product.translations, 'fr'),
        colorName: variant.colorNameFr,
        colorCode: variant.colorCode,
        stockQuantity: variant.stockQuantity,
        reservedQuantity: variant.reservedQuantity,
        recentMovements: variant.stockMovements.map((movement) => ({
          id: movement.id,
          type: movement.type,
          quantity: movement.quantity,
          resulting: movement.resultingQuantity,
          createdAt: movement.createdAt.toISOString(),
          user: movement.user?.name ?? 'système',
          reason: movement.reason,
        })),
      }))}
      movements={recentMovements.map((movement) => ({
        id: movement.id,
        type: movement.type,
        quantity: movement.quantity,
        resulting: movement.resultingQuantity,
        createdAt: movement.createdAt.toISOString(),
        variantSku: movement.variant.sku,
        productName: translate(movement.variant.product.translations, 'fr'),
        user: movement.user?.name ?? 'système',
        reason: movement.reason,
      }))}
    />
  );
}
