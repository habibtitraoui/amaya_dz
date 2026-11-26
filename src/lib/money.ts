/**
 * Money helpers.
 *
 * All prices in AMAYA are Algerian Dinars with two decimal places. Arithmetic
 * is done on integer centimes so totals never drift, and Prisma Decimal
 * columns are always written as fixed-2 strings.
 */

export type MoneyInput = string | number | { toString(): string } | null | undefined;

export function toCentimes(value: MoneyInput): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function fromCentimes(centimes: number): number {
  return centimes / 100;
}

/** Fixed-2 decimal string, suitable for Prisma Decimal columns. */
export function toDecimalString(value: MoneyInput): string {
  return (toCentimes(value) / 100).toFixed(2);
}

/** 12 500,00 DA · 12 500,00 د.ج — western digits, locale-aware grouping. */
export function formatDA(value: MoneyInput, locale: string = 'fr'): string {
  const amount = toCentimes(value) / 100;
  const intlLocale = locale === 'ar' ? 'fr-DZ' : locale === 'en' ? 'en-DZ' : 'fr-DZ';
  const formatted = new Intl.NumberFormat(intlLocale, {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return locale === 'ar' ? `${formatted} د.ج` : `${formatted} DA`;
}

/** Plain number formatting for dashboards / charts. */
export function formatNumber(value: number, locale: string = 'fr'): string {
  return new Intl.NumberFormat(locale === 'ar' ? 'fr-DZ' : locale === 'en' ? 'en-DZ' : 'fr-DZ').format(value);
}

export function multiply(lineUnitPrice: MoneyInput, quantity: number): number {
  return (toCentimes(lineUnitPrice) * quantity) / 100;
}
