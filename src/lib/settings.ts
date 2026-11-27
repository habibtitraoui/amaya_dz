import 'server-only';
import { prisma } from '@/lib/prisma';

/**
 * Site settings are stored as JSON rows (`SiteSetting.key` → `value`).
 * `hero.image` holds the homepage artwork URL — an uploaded Object Storage URL
 * for real deployments, or a local `/brand/…` path for a bare checkout.
 */

/** Shipped fallback so the homepage still has artwork before anything is set. */
export const DEFAULT_HERO_IMAGE = '/brand/amaya-lockup.png';

/** Read a single setting, returning null when unset or unreadable. */
export async function getSetting<T = unknown>(key: string): Promise<T | null> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key } });
    return row ? (row.value as T) : null;
  } catch {
    return null;
  }
}

/**
 * Homepage hero artwork. Accepts either a plain string row or the legacy
 * `{ url }` object shape, so an admin edit can never crash the storefront.
 */
export async function getHeroImage(): Promise<string> {
  const value = await getSetting<unknown>('hero.image');
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object' && 'url' in value) {
    const url = (value as { url?: unknown }).url;
    if (typeof url === 'string' && url.trim()) return url.trim();
  }
  return DEFAULT_HERO_IMAGE;
}
