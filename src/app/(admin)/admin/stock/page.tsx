import { prisma } from '@/lib/prisma';
import { getLocale } from '@/lib/locale';
import { getDictionary, translate } from '@/lib/i18n';
import { StockManager } from '@/components/admin/stock-manager';

export const dynamic = 'force-dynamic';

export default async function AdminStockPage() {
  const locale = await getLocale();
  const dict = await getDictionary(locale);
  const copy = dict.admin.stock;

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

  const colorFor = (variant: { colorNameFr: string; colorNameAr: string; colorNameEn: string }) =>
    (locale === 'ar' ? variant.colorNameAr : locale === 'en' ? variant.colorNameEn : variant.colorNameFr) || variant.colorNameFr;

  return (
    <StockManager
      locale={locale}
      labels={copy}
      searchAriaLabel={dict.common.search}
      variants={variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        productName: translate(variant.product.translations, locale) || variant.product.sku,
        colorName: colorFor(variant),
        colorCode: variant.colorCode,
        stockQuantity: variant.stockQuantity,
        reservedQuantity: variant.reservedQuantity,
        recentMovements: variant.stockMovements.map((movement) => ({
          id: movement.id,
          type: movement.type,
          quantity: movement.quantity,
          resulting: movement.resultingQuantity,
          createdAt: movement.createdAt.toISOString(),
          user: movement.user?.name ?? copy.systemActor,
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
        productName: translate(movement.variant.product.translations, locale) || movement.variant.product.sku,
        user: movement.user?.name ?? copy.systemActor,
        reason: movement.reason,
      }))}
    />
  );
}
