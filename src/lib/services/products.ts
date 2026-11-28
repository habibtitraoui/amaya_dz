import 'server-only';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { toDecimalString } from '@/lib/money';
import { logAudit } from '@/lib/audit';
import { slugify } from '@/lib/utils';
import type { LocaleCode } from '@/generated/prisma/enums';

export type TranslationInput = { locale: LocaleCode; name: string; description?: string | null };

export type ProductInput = {
  sku: string;
  categoryId: string;
  retailPrice: number | string;
  wholesalePrice: number | string;
  superWholesalePrice: number | string;
  wholesaleMinQty: number;
  superWholesaleMinQty: number;
  status?: 'AVAILABLE' | 'OUT_OF_STOCK' | 'HIDDEN' | 'ARCHIVED';
  isFeatured?: boolean;
  translations: TranslationInput[];
  images?: { url: string; alt?: string | null }[];
  variants?: {
    id?: string;
    sku: string;
    colorNameFr: string;
    colorNameAr: string;
    colorNameEn: string;
    colorCode: string;
    image?: string | null;
    stockQuantity: number;
  }[];
};

export type Actor = { id: string; name: string };

function validatePrices(input: ProductInput) {
  const retail = Number(input.retailPrice);
  const wholesale = Number(input.wholesalePrice);
  const superWholesale = Number(input.superWholesalePrice);
  if ([retail, wholesale, superWholesale].some((v) => !Number.isFinite(v) || v < 0)) {
    throw new AppError('VALIDATION', 'Prices must be positive numbers');
  }
  if (wholesale > retail) throw new AppError('VALIDATION', 'Wholesale price cannot exceed retail price');
  if (superWholesale > wholesale) {
    throw new AppError('VALIDATION', 'Super-wholesale price cannot exceed wholesale price');
  }
  if (input.wholesaleMinQty < 1 || input.superWholesaleMinQty < 1) {
    throw new AppError('VALIDATION', 'Minimum quantities must be at least 1');
  }
  if (input.superWholesaleMinQty < input.wholesaleMinQty) {
    throw new AppError('VALIDATION', 'Super-wholesale minimum must be ≥ wholesale minimum');
  }
}

function normaliseTranslations(translations: TranslationInput[]): TranslationInput[] {
  const fr = translations.find((t) => t.locale === 'FR');
  if (!fr || !fr.name.trim()) throw new AppError('VALIDATION', 'The French name is required');
  return translations
    .filter((t) => t.name?.trim())
    .map((t) => ({ locale: t.locale, name: t.name.trim(), description: t.description?.trim() || null }));
}

async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = slugify(base) || `product-${Date.now()}`;
  let candidate = root;
  let n = 1;
  for (;;) {
    const existing = await prisma.product.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === ignoreId) return candidate;
    n += 1;
    candidate = `${root}-${n}`;
  }
}

function priceRows(input: ProductInput) {
  return [
    { tier: 'RETAIL' as const, unitPrice: toDecimalString(input.retailPrice), minQuantity: 1 },
    { tier: 'WHOLESALE' as const, unitPrice: toDecimalString(input.wholesalePrice), minQuantity: input.wholesaleMinQty },
    {
      tier: 'SUPER_WHOLESALE' as const,
      unitPrice: toDecimalString(input.superWholesalePrice),
      minQuantity: input.superWholesaleMinQty,
    },
  ];
}

export async function createProduct(input: ProductInput, actor: Actor) {
  validatePrices(input);
  const translations = normaliseTranslations(input.translations);
  const slug = await uniqueSlug(translations.find((t) => t.locale === 'FR')!.name);

  const skuTaken = await prisma.product.findUnique({ where: { sku: input.sku.trim() } });
  if (skuTaken) throw new AppError('CONFLICT', 'This SKU is already used by another product');

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        slug,
        sku: input.sku.trim().toUpperCase(),
        categoryId: input.categoryId,
        retailPrice: toDecimalString(input.retailPrice),
        wholesalePrice: toDecimalString(input.wholesalePrice),
        superWholesalePrice: toDecimalString(input.superWholesalePrice),
        wholesaleMinQty: input.wholesaleMinQty,
        superWholesaleMinQty: input.superWholesaleMinQty,
        status: input.status ?? 'AVAILABLE',
        isFeatured: input.isFeatured ?? false,
        translations: { create: translations },
        images: { create: (input.images ?? []).map((img, index) => ({ url: img.url, alt: img.alt ?? null, sortOrder: index })) },
        prices: { create: priceRows(input).map((row) => ({ ...row, isCurrent: true })) },
        variants: {
          create: (input.variants ?? []).map((variant) => ({
            sku: variant.sku.trim().toUpperCase(),
            colorNameFr: variant.colorNameFr,
            colorNameAr: variant.colorNameAr,
            colorNameEn: variant.colorNameEn,
            colorCode: variant.colorCode,
            image: variant.image ?? null,
            stockQuantity: variant.stockQuantity,
          })),
        },
      },
      include: { variants: true },
    });

    // Initial stock movements so the ledger starts from a known point.
    for (const variant of created.variants) {
      if (variant.stockQuantity > 0) {
        await tx.stockMovement.create({
          data: {
            variantId: variant.id,
            type: 'INITIAL',
            quantity: variant.stockQuantity,
            resultingQuantity: variant.stockQuantity,
            userId: actor.id,
            reason: 'Initial stock',
          },
        });
      }
    }

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorName: actor.name,
        action: 'product.create',
        entityType: 'Product',
        entityId: created.id,
        summary: `Product ${created.sku} created`,
        metadata: {
          retail: String(created.retailPrice),
          wholesale: String(created.wholesalePrice),
          superWholesale: String(created.superWholesalePrice),
        } as never,
      },
    });

    return created;
  });

  return product;
}

export async function updateProduct(productId: string, input: ProductInput, actor: Actor) {
  validatePrices(input);
  const translations = normaliseTranslations(input.translations);
  const current = await prisma.product.findUnique({ where: { id: productId }, include: { variants: true } });
  if (!current) throw new AppError('NOT_FOUND', 'Product not found');

  const slug = current.sku !== input.sku.trim().toUpperCase()
    ? await uniqueSlug(current.slug, productId)
    : current.slug;

  const priceChanges: { tier: 'RETAIL' | 'WHOLESALE' | 'SUPER_WHOLESALE'; oldPrice: string; newPrice: string; oldMin: number; newMin: number }[] = [];
  const compare = (tier: 'RETAIL' | 'WHOLESALE' | 'SUPER_WHOLESALE', oldPrice: unknown, newPrice: string, oldMin: number, newMin: number) => {
    if (Number(oldPrice) !== Number(newPrice) || oldMin !== newMin) {
      priceChanges.push({ tier, oldPrice: String(oldPrice), newPrice, oldMin, newMin });
    }
  };
  const rows = priceRows(input);
  compare('RETAIL', current.retailPrice, rows[0].unitPrice, 1, 1);
  compare('WHOLESALE', current.wholesalePrice, rows[1].unitPrice, current.wholesaleMinQty, rows[1].minQuantity);
  compare(
    'SUPER_WHOLESALE',
    current.superWholesalePrice,
    rows[2].unitPrice,
    current.superWholesaleMinQty,
    rows[2].minQuantity,
  );

  return prisma.$transaction(async (tx) => {
    // Translations: upsert all three locales, keep any that were not supplied.
    for (const translation of translations) {
      await tx.productTranslation.upsert({
        where: { productId_locale: { productId, locale: translation.locale } },
        create: { productId, ...translation },
        update: { name: translation.name, description: translation.description ?? null },
      });
    }

    await tx.product.update({
      where: { id: productId },
      data: {
        sku: input.sku.trim().toUpperCase(),
        slug,
        categoryId: input.categoryId,
        retailPrice: rows[0].unitPrice,
        wholesalePrice: rows[1].unitPrice,
        superWholesalePrice: rows[2].unitPrice,
        wholesaleMinQty: input.wholesaleMinQty,
        superWholesaleMinQty: input.superWholesaleMinQty,
        status: input.status ?? current.status,
        isFeatured: input.isFeatured ?? current.isFeatured,
      },
    });

    // Images are replaced wholesale when provided.
    if (input.images) {
      await tx.productImage.deleteMany({ where: { productId } });
      await tx.productImage.createMany({
        data: input.images.map((img, index) => ({ productId, url: img.url, alt: img.alt ?? null, sortOrder: index })),
      });
    }

    // Variants: upsert by id, create new, deactivate removed ones (history kept).
    if (input.variants) {
      for (const variant of input.variants) {
        if (variant.id) {
          const existing = current.variants.find((v) => v.id === variant.id);
          if (!existing) throw new AppError('VALIDATION', 'Variant does not belong to this product');
          if (existing.sku !== variant.sku.trim().toUpperCase()) {
            const taken = await tx.productVariant.findUnique({ where: { sku: variant.sku.trim().toUpperCase() } });
            if (taken) throw new AppError('CONFLICT', `Variant SKU ${variant.sku} already exists`);
          }
          await tx.productVariant.update({
            where: { id: variant.id },
            data: {
              sku: variant.sku.trim().toUpperCase(),
              colorNameFr: variant.colorNameFr,
              colorNameAr: variant.colorNameAr,
              colorNameEn: variant.colorNameEn,
              colorCode: variant.colorCode,
              image: variant.image ?? null,
              stockQuantity: variant.stockQuantity,
              isActive: true,
            },
          });
          const delta = variant.stockQuantity - existing.stockQuantity;
          if (delta !== 0) {
            await tx.stockMovement.create({
              data: {
                variantId: variant.id,
                type: 'ADJUSTMENT',
                quantity: delta,
                resultingQuantity: variant.stockQuantity,
                userId: actor.id,
                reason: 'Edited on product form',
              },
            });
          }
        } else {
          const created = await tx.productVariant.create({
            data: {
              productId,
              sku: variant.sku.trim().toUpperCase(),
              colorNameFr: variant.colorNameFr,
              colorNameAr: variant.colorNameAr,
              colorNameEn: variant.colorNameEn,
              colorCode: variant.colorCode,
              image: variant.image ?? null,
              stockQuantity: variant.stockQuantity,
            },
          });
          if (variant.stockQuantity > 0) {
            await tx.stockMovement.create({
              data: {
                variantId: created.id,
                type: 'INITIAL',
                quantity: variant.stockQuantity,
                resultingQuantity: variant.stockQuantity,
                userId: actor.id,
                reason: 'New variant stock',
              },
            });
          }
        }
      }
      const keptIds = new Set(input.variants.map((v) => v.id).filter(Boolean) as string[]);
      const removed = current.variants.filter((v) => !keptIds.has(v.id));
      for (const variant of removed) {
        await tx.productVariant.update({ where: { id: variant.id }, data: { isActive: false } });
      }
    }

    // Price history + current price rows.
    if (priceChanges.length > 0) {
      await tx.priceHistory.createMany({
        data: priceChanges.map((change) => ({
          productId,
          tier: change.tier as never,
          oldPrice: change.oldPrice,
          newPrice: change.newPrice,
          oldMinQuantity: change.oldMin,
          newMinQuantity: change.newMin,
          changedById: actor.id,
        })),
      });
      for (const row of rows) {
        await tx.productPrice.updateMany({
          where: { productId, tier: row.tier, isCurrent: true },
          data: { isCurrent: false },
        });
        await tx.productPrice.create({
          data: { productId, tier: row.tier as never, unitPrice: row.unitPrice, minQuantity: row.minQuantity },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorName: actor.name,
          action: 'product.price',
          entityType: 'Product',
          entityId: productId,
          summary: `Prices updated for ${input.sku}`,
          metadata: { changes: priceChanges } as never,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorName: actor.name,
        action: 'product.update',
        entityType: 'Product',
        entityId: productId,
        summary: `Product ${input.sku} updated`,
      },
    });

    return tx.product.findUnique({ where: { id: productId }, include: { variants: true } });
  });
}

export async function setProductStatus(
  productId: string,
  status: 'AVAILABLE' | 'OUT_OF_STOCK' | 'HIDDEN' | 'ARCHIVED',
  actor: Actor,
) {
  const product = await prisma.product.update({ where: { id: productId }, data: { status } });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: 'product.status',
    entityType: 'Product',
    entityId: productId,
    summary: `${product.sku} → ${status}`,
  });
  return product;
}

export async function toggleFeatured(productId: string, featured: boolean, actor: Actor) {
  const product = await prisma.product.update({ where: { id: productId }, data: { isFeatured: featured } });
  await logAudit({
    actorId: actor.id,
    actorName: actor.name,
    action: 'product.featured',
    entityType: 'Product',
    entityId: productId,
    summary: `${product.sku} featured = ${featured}`,
  });
  return product;
}

/**
 * Permanently remove a product while preserving historical order snapshots.
 * Product and variant references on OrderItem are nullable by design, so the
 * order keeps its captured name, SKU and price after the catalogue row goes.
 */
export async function deleteProduct(productId: string, actor: Actor) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { id: true, sku: true, variants: { select: { reservedQuantity: true } } },
    });
    if (!product) throw new AppError('NOT_FOUND', 'Product not found');

    // Deleting a reserved variant would make it impossible to release the
    // reservation when its order is cancelled. Ask staff to resolve the order
    // first instead of silently corrupting the stock ledger.
    if (product.variants.some((variant) => variant.reservedQuantity > 0)) {
      throw new AppError('CONFLICT', 'This product cannot be deleted while stock is reserved by an active order');
    }

    await tx.product.delete({ where: { id: productId } });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorName: actor.name,
        action: 'product.delete',
        entityType: 'Product',
        entityId: productId,
        summary: `Product ${product.sku} deleted`,
      },
    });

    return { id: product.id, sku: product.sku };
  });
}

export async function getProductForEdit(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    include: {
      translations: true,
      variants: { orderBy: { createdAt: 'asc' } },
      images: { orderBy: { sortOrder: 'asc' } },
      priceHistory: { orderBy: { createdAt: 'desc' }, take: 20 },
      category: { include: { translations: true } },
    },
  });
}
