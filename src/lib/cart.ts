/**
 * Cart storage helpers shared by the client store and server reads.
 * The cart only holds ids + quantities — prices are always re-derived on the
 * server from the authenticated tier.
 */
export const CART_COOKIE = 'amaya_cart';

export type CartLine = {
  productId: string;
  variantId: string;
  quantity: number;
  slug?: string;
  name?: string;
  color?: string;
  image?: string | null;
  addedAt?: number;
};

export const MAX_LINE_QUANTITY = 9999;

export function parseCart(raw: string | undefined | null): CartLine[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(decodeURIComponent(raw));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (line) =>
          line &&
          typeof line.productId === 'string' &&
          typeof line.variantId === 'string' &&
          Number.isFinite(Number(line.quantity)),
      )
      .map((line) => ({
        productId: line.productId,
        variantId: line.variantId,
        quantity: Math.min(MAX_LINE_QUANTITY, Math.max(1, Math.floor(Number(line.quantity)))),
        slug: line.slug,
        name: line.name,
        color: line.color,
        image: line.image ?? null,
        addedAt: line.addedAt,
      }));
  } catch {
    return [];
  }
}

export function serializeCart(lines: CartLine[]): string {
  return encodeURIComponent(JSON.stringify(lines));
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
