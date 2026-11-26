/**
 * Customer tiers and the pricing rules attached to them.
 *
 * RETAIL           — visitors, no account, retail prices (min qty 1).
 * WHOLESALE        — registered businesses, wholesale price + per-product min qty.
 * SUPER_WHOLESALE  — registered businesses, lowest price + higher min qty.
 *
 * The tier used to price an order is ALWAYS derived from the authenticated
 * user on the server — never from client-supplied data.
 */
export type Tier = 'RETAIL' | 'WHOLESALE' | 'SUPER_WHOLESALE';

export const TIERS: Tier[] = ['RETAIL', 'WHOLESALE', 'SUPER_WHOLESALE'];

export const TIER_LABEL: Record<Tier, { ar: string; fr: string; en: string }> = {
  RETAIL: { ar: 'بيع بالتجزئة', fr: 'Détail', en: 'Retail' },
  WHOLESALE: { ar: 'بيع بالجملة', fr: 'Gros', en: 'Wholesale' },
  SUPER_WHOLESALE: { ar: 'جملة فائقة', fr: 'Super Gros', en: 'Super Wholesale' },
};

/** Customer tiers an account can hold (retail has no account). */
export const ACCOUNT_TIERS: Exclude<Tier, 'RETAIL'>[] = ['WHOLESALE', 'SUPER_WHOLESALE'];

export type PriceRule = {
  unitPrice: string;
  minQuantity: number;
};

export type PricedProduct = {
  retailPrice: string | number;
  wholesalePrice: string | number;
  superWholesalePrice: string | number;
  wholesaleMinQty: number;
  superWholesaleMinQty: number;
};

/**
 * Resolve the price rule that applies to a tier for a product.
 * Centralised so the storefront, cart validation, checkout and the order
 * service all agree on exactly one source of truth.
 */
export function priceRuleFor(product: PricedProduct, tier: Tier): PriceRule {
  switch (tier) {
    case 'WHOLESALE':
      return {
        unitPrice: Number(product.wholesalePrice).toFixed(2),
        minQuantity: Math.max(1, product.wholesaleMinQty),
      };
    case 'SUPER_WHOLESALE':
      return {
        unitPrice: Number(product.superWholesalePrice).toFixed(2),
        minQuantity: Math.max(1, product.superWholesaleMinQty),
      };
    case 'RETAIL':
    default:
      return { unitPrice: Number(product.retailPrice).toFixed(2), minQuantity: 1 };
  }
}

/** Tier for a resolved session (visitor => RETAIL). */
export function tierForSession(user: { tier?: string | null } | null | undefined): Tier {
  if (!user) return 'RETAIL';
  if (user.tier === 'WHOLESALE' || user.tier === 'SUPER_WHOLESALE') return user.tier;
  return 'RETAIL';
}

/**
 * Public price payload for a product/tier.
 *
 * A tier never sees the price of a *lower* tier, but it sees its own price,
 * its own minimum quantity, and the retail price (which is public information
 * displayed to everyone).
 */
export function publicPrices(product: PricedProduct, tier: Tier) {
  const retail = priceRuleFor(product, 'RETAIL');
  if (tier === 'WHOLESALE') {
    const wholesale = priceRuleFor(product, 'WHOLESALE');
    return { retail, wholesale, superWholesale: null as PriceRule | null, effective: wholesale };
  }
  if (tier === 'SUPER_WHOLESALE') {
    return {
      retail,
      wholesale: null as PriceRule | null,
      superWholesale: priceRuleFor(product, 'SUPER_WHOLESALE'),
      effective: priceRuleFor(product, 'SUPER_WHOLESALE'),
    };
  }
  return {
    retail,
    wholesale: null as PriceRule | null,
    superWholesale: null as PriceRule | null,
    effective: retail,
  };
}

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, { ar: string; fr: string; en: string }> = {
  PENDING: { ar: 'قيد الانتظار', fr: 'En attente', en: 'Pending' },
  CONFIRMED: { ar: 'تم التأكيد', fr: 'Confirmée', en: 'Confirmed' },
  PREPARING: { ar: 'قيد التحضير', fr: 'En préparation', en: 'Preparing' },
  READY: { ar: 'جاهز', fr: 'Prête', en: 'Ready' },
  SHIPPED: { ar: 'تم الشحن', fr: 'Expédiée', en: 'Shipped' },
  DELIVERED: { ar: 'تم التسليم', fr: 'Livrée', en: 'Delivered' },
  CANCELLED: { ar: 'ملغي', fr: 'Annulée', en: 'Cancelled' },
};

export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  PENDING: 'amber',
  CONFIRMED: 'blue',
  PREPARING: 'violet',
  READY: 'cyan',
  SHIPPED: 'indigo',
  DELIVERED: 'green',
  CANCELLED: 'red',
};

/**
 * Legal status transitions. Enforced server-side so an order can never jump
 * from CANCELLED to DELIVERED, or be silently re-opened.
 */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextStatuses(from: OrderStatus): OrderStatus[] {
  return TRANSITIONS[from] ?? [];
}

/** Statuses where the stock is held / reserved for the order. */
export const STOCK_HOLDING_STATUSES: OrderStatus[] = ['CONFIRMED', 'PREPARING', 'READY', 'SHIPPED'];

/** Statuses counted as a completed sale in analytics. */
export const SALE_STATUSES: OrderStatus[] = ['CONFIRMED', 'PREPARING', 'READY', 'SHIPPED', 'DELIVERED'];
