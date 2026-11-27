import 'server-only';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';

/**
 * Demo catalog artwork used by `npm run db:seed` and the one-click migration.
 *
 * The files live in `assets/catalog/**` — deliberately **outside** `public/`
 * so the deployment never ships them and `next build` stays lean. They are the
 * *masters* for seeding a fresh database; everything the storefront renders
 * comes from Neon Object Storage.
 */

export const CATALOG_ASSET_ROOT = path.join(process.cwd(), 'assets', 'catalog');

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

/**
 * Map a legacy `/products/foo.jpg` or `/categories/foo.jpg` reference to its
 * local master file. Returns null for anything that is not a bundled asset
 * (absolute URLs, uploaded objects, unknown paths).
 */
export function catalogAssetPath(reference: string): string | null {
  const match = /^\/(?:products|categories)\/([A-Za-z0-9._-]+\.(?:jpg|jpeg|png|webp|avif))$/.exec(
    reference,
  );
  if (!match) return null;
  const [, file] = match;
  const dir = reference.startsWith('/products/') ? 'products' : 'categories';
  // `match[1]` cannot contain a slash, so path traversal is impossible.
  return path.join(CATALOG_ASSET_ROOT, dir, file);
}

/** Content type for a bundled asset, or null when the extension is unknown. */
export function catalogContentType(filePath: string): string | null {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? null;
}

/** Read a bundled asset, or null when it is missing / unreadable. */
export async function readCatalogAsset(filePath: string): Promise<Buffer | null> {
  try {
    await stat(filePath);
    return await readFile(filePath);
  } catch {
    return null;
  }
}

/**
 * Every bundled image, keyed by its legacy reference. Built from the files on
 * disk so the seed and the migration never drift from the folder contents.
 */
export async function listCatalogAssets(): Promise<Map<string, string>> {
  const entries = new Map<string, string>();
  for (const dir of ['products', 'categories'] as const) {
    let files: string[];
    try {
      files = await readdir(path.join(CATALOG_ASSET_ROOT, dir));
    } catch {
      continue;
    }
    for (const file of files.sort()) {
      if (!CONTENT_TYPES[path.extname(file).toLowerCase()]) continue;
      entries.set(`/${dir}/${file}`, path.join(CATALOG_ASSET_ROOT, dir, file));
    }
  }
  return entries;
}
