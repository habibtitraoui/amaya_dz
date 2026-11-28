import 'server-only';
import { cache } from 'react';
import { prisma } from '@/lib/prisma';
import type { Dictionary } from '@/lib/i18n';
import {
  CONTACT_SETTING_KEYS,
  resolveContactSettings,
  type ContactSettings,
} from '@/lib/contact';

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

const loadContactRows = cache(async (): Promise<Record<string, unknown>> => {
  try {
    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: [...CONTACT_SETTING_KEYS] } },
    });
    const map: Record<string, unknown> = {};
    for (const row of rows) map[row.key] = row.value;
    return map;
  } catch {
    return {};
  }
});

/**
 * Storefront contact details and social media icon links.
 * Database values (`SiteSetting`) take precedence over `BUSINESS_*` env vars
 * and localised dictionary defaults.
 */
export async function getContactSettings(dict: Pick<Dictionary, 'footer'>): Promise<ContactSettings> {
  const rows = await loadContactRows();
  return resolveContactSettings(
    rows,
    { location: dict.footer.location, hours: dict.footer.hours },
    {
      phone: process.env.BUSINESS_PHONE,
      email: process.env.BUSINESS_EMAIL,
      address: process.env.BUSINESS_ADDRESS,
      hours: process.env.BUSINESS_HOURS,
    },
  );
}
