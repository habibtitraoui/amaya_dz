import 'server-only';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/errors';
import { catalogContentType, listCatalogAssets, readCatalogAsset } from '@/lib/catalog-assets';
import { config, publicUrlFor } from '@/lib/storage';

/**
 * One-shot migration of the legacy demo artwork.
 *
 * Historically the seed pointed `ProductImage.url`, `ProductVariant.image` and
 * `Category.image` at files inside `public/` (`/products/x.jpg`). Those files
 * now live in `assets/catalog/**` as seed masters, so any database still
 * holding the old paths must be repointed at Neon Object Storage.
 *
 * The operation is idempotent and safe to re-run: objects are written to
 * deterministic keys (`catalog/<dir>/<file>`), and only rows whose value is
 * still a bundled path are touched — uploaded images are never rewritten.
 */

export type CatalogMigrationReport = {
  /** Bundled masters uploaded to the bucket during this run. */
  uploaded: number;
  /** Masters that already existed in `assets/catalog` (uploaded from disk). */
  assets: number;
  categories: { total: number; updated: number; missing: string[] };
  /** Homepage hero artwork repointed (null when nothing needed changing). */
  hero: string | null;
  productImages: { total: number; updated: number; missing: string[] };
  variants: { total: number; updated: number; missing: string[] };
  /** Rows still pointing at `public/` after the run (should be empty). */
  remaining: number;
};

/** `catalog/products/airpods-pro-white.jpg` for `/products/airpods-pro-white.jpg`. */
function storageKeyFor(reference: string): string | null {
  const match = /^\/(products|categories)\/([A-Za-z0-9._-]+)$/.exec(reference);
  if (!match) return null;
  return `catalog/${match[1]}/${match[2]}`;
}

function isLegacyReference(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^\/(?:products|categories)\//.test(value);
}

/**
 * Upload every bundled master and repoint the database at the returned URLs.
 * Returns a report suitable for showing in the admin UI.
 */
export async function migrateCatalogImages(): Promise<CatalogMigrationReport> {
  const { s3, bucket } = config();

  const assets = await listCatalogAssets();
  if (assets.size === 0) {
    throw new AppError(
      'NOT_FOUND',
      'No catalog masters found — expected images in assets/catalog/**',
      404,
    );
  }

  // ---------------------------------------------------------------- upload
  const urlByReference = new Map<string, string>();
  for (const [reference, filePath] of assets) {
    const key = storageKeyFor(reference);
    const contentType = catalogContentType(filePath);
    const body = await readCatalogAsset(filePath);
    if (!key || !contentType || !body) continue;

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );
    urlByReference.set(reference, publicUrlFor(key));
  }

  // ------------------------------------------------------------ repoint DB
  const missingCategory = new Set<string>();
  const missingImage = new Set<string>();
  const missingVariant = new Set<string>();

  let categoriesUpdated = 0;
  let imagesUpdated = 0;
  let variantsUpdated = 0;

  const [categories, images, variants] = await Promise.all([
    prisma.category.findMany({ select: { id: true, image: true } }),
    prisma.productImage.findMany({ select: { id: true, url: true } }),
    prisma.productVariant.findMany({ select: { id: true, image: true } }),
  ]);

  for (const category of categories) {
    if (!isLegacyReference(category.image)) continue;
    const url = urlByReference.get(category.image);
    if (!url) {
      missingCategory.add(category.image);
      continue;
    }
    await prisma.category.update({ where: { id: category.id }, data: { image: url } });
    categoriesUpdated += 1;
  }

  for (const image of images) {
    if (!isLegacyReference(image.url)) continue;
    const url = urlByReference.get(image.url);
    if (!url) {
      missingImage.add(image.url);
      continue;
    }
    await prisma.productImage.update({ where: { id: image.id }, data: { url } });
    imagesUpdated += 1;
  }

  for (const variant of variants) {
    if (!isLegacyReference(variant.image)) continue;
    const url = urlByReference.get(variant.image);
    if (!url) {
      missingVariant.add(variant.image);
      continue;
    }
    await prisma.productVariant.update({ where: { id: variant.id }, data: { image: url } });
    variantsUpdated += 1;
  }

  // ----------------------------------------------------------- hero artwork
  // The homepage banner used to be hardcoded to `/products/airpods-pro-white.jpg`.
  // Point it at the uploaded copy so the storefront keeps its visual identity.
  let hero: string | null = null;
  const heroAsset = urlByReference.get('/products/airpods-pro-white.jpg');
  if (heroAsset) {
    const current = await prisma.siteSetting.findUnique({ where: { key: 'hero.image' } });
    const value = current?.value;
    const isLegacy = typeof value === 'string' && isLegacyReference(value);
    if (!current || isLegacy || value === null) {
      await prisma.siteSetting.upsert({
        where: { key: 'hero.image' },
        create: { key: 'hero.image', value: heroAsset },
        update: { value: heroAsset },
      });
      hero = heroAsset;
    }
  }

  // Cross-check: an image that only appears *inside* a JSON setting or a rich
  // text field would still 404 after the move. Report it instead of guessing.
  const [remainingCategories, remainingImages, remainingVariants] = await Promise.all([
    prisma.category.count({ where: { image: { startsWith: '/products/' } } }),
    prisma.productImage.count({ where: { url: { startsWith: '/products/' } } }),
    prisma.productVariant.count({ where: { image: { startsWith: '/products/' } } }),
  ]);

  return {
    uploaded: urlByReference.size,
    assets: assets.size,
    categories: {
      total: categories.length,
      updated: categoriesUpdated,
      missing: [...missingCategory],
    },
    productImages: { total: images.length, updated: imagesUpdated, missing: [...missingImage] },
    variants: { total: variants.length, updated: variantsUpdated, missing: [...missingVariant] },
    hero,
    remaining: remainingCategories + remainingImages + remainingVariants,
  };
}
