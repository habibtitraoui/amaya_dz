/**
 * Localisation. Arabic (default) / French / English dictionaries.
 * Arabic switches the whole document to RTL. Invoices are French-only and do
 * not use this module (see lib/invoice-template.ts).
 */
export const LOCALES = ['ar', 'fr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'ar';
export const LOCALE_COOKIE = 'amaya_locale';

export const LOCALE_DIR: Record<Locale, 'rtl' | 'ltr'> = { ar: 'rtl', fr: 'ltr', en: 'ltr' };
export const LOCALE_LABEL: Record<Locale, string> = { ar: 'العربية', fr: 'Français', en: 'English' };
export const LOCALE_SHORT: Record<Locale, string> = { ar: 'AR', fr: 'FR', en: 'EN' };
export const LOCALE_INTL: Record<Locale, string> = { ar: 'ar-DZ', fr: 'fr-FR', en: 'en-GB' };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function dir(locale: Locale) {
  return LOCALE_DIR[locale];
}

/** Pick *fr* first as the internal business language for anything not localised. */
export const FALLBACK_CHAIN: Record<Locale, Locale[]> = {
  ar: ['ar', 'fr', 'en'],
  fr: ['fr', 'en', 'ar'],
  en: ['en', 'fr', 'ar'],
};

type Translation = { locale: string; name?: string | null; description?: string | null };

/**
 * Resolve a category/product translation with the configured fallback chain.
 * Returns the primary name (fallback aware) and every locale for editors.
 */
export function translate<T extends Translation>(
  translations: T[],
  locale: Locale,
  field: 'name' | 'description' = 'name',
): string {
  // Database rows store enum values ('AR' | 'FR' | 'EN'); callers pass 'ar' | 'fr' | 'en'.
  // Normalise both sides so a casing mismatch can never blank out a name.
  const byLocale = new Map<string, T>();
  for (const translation of translations) byLocale.set(String(translation.locale).toLowerCase(), translation);

  for (const candidate of FALLBACK_CHAIN[locale]) {
    const value = byLocale.get(candidate)?.[field];
    if (value && String(value).trim().length > 0) return String(value);
  }
  return '';
}

export function translationMap<T extends Translation>(translations: T[]): Record<Locale, T | undefined> {
  const byLocale = new Map<string, T>();
  for (const translation of translations) byLocale.set(String(translation.locale).toLowerCase(), translation);
  return { ar: byLocale.get('ar'), fr: byLocale.get('fr'), en: byLocale.get('en') };
}

const dictionaries = {
  ar: () => import('@/i18n/ar').then((m) => m.default),
  fr: () => import('@/i18n/fr').then((m) => m.default),
  en: () => import('@/i18n/en').then((m) => m.default),
} as const;

export type Dictionary = typeof import('@/i18n/fr').default;

export async function getDictionary(locale: Locale): Promise<Dictionary> {
  return (await dictionaries[locale]()) as Dictionary;
}

/** Simple `{name}` interpolation for dictionary strings. */
export function t(template: string, values: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`));
}
