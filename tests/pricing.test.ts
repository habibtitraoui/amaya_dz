/**
 * §20.1–20.3 — three price tiers, per-product minimum quantities, no leakage.
 * Pure unit tests: no database, no HTTP.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  publicPrices,
  priceRuleFor,
  tierForSession,
  ORDER_STATUSES,
  canTransition,
  nextStatuses,
  STOCK_HOLDING_STATUSES,
  SALE_STATUSES,
} from '../src/lib/pricing.ts';
import { formatDA } from '../src/lib/money.ts';

const airpods = {
  retailPrice: 6500,
  wholesalePrice: 5800,
  superWholesalePrice: 5200,
  wholesaleMinQty: 5,
  superWholesaleMinQty: 10,
};

test('retail visitors only ever receive the retail tier', () => {
  const prices = publicPrices(airpods, 'RETAIL');
  assert.equal(prices.retail.unitPrice, '6500.00');
  assert.equal(prices.wholesale, null);
  assert.equal(prices.superWholesale, null);
  assert.equal(prices.effective.unitPrice, '6500.00');
  assert.equal(prices.effective.minQuantity, 1);
});

test('retail payload serialised to JSON contains no wholesale amount', () => {
  const payload = JSON.stringify(publicPrices(airpods, 'RETAIL'));
  assert.ok(!payload.includes('5800'), 'leaked wholesale price');
  assert.ok(!payload.includes('5200'), 'leaked super-wholesale price');
});

test('wholesale accounts receive their own price and the product minimum', () => {
  const prices = publicPrices(airpods, 'WHOLESALE');
  assert.equal(prices.effective.unitPrice, '5800.00');
  assert.equal(prices.effective.minQuantity, 5);
  // A wholesale account must not see super-wholesale pricing.
  assert.equal(prices.superWholesale, null);
});

test('super wholesale gets the best price and min quantity 10', () => {
  const prices = publicPrices(airpods, 'SUPER_WHOLESALE');
  assert.equal(prices.effective.unitPrice, '5200.00');
  assert.equal(prices.effective.minQuantity, 10);
  // Super wholesale sees the retail reference price but never the mid tier.
  assert.equal(prices.retail.unitPrice, '6500.00');
  assert.equal(prices.wholesale, null);
});

test('tier prices are strictly ordered', () => {
  const retail = Number(publicPrices(airpods, 'RETAIL').effective.unitPrice);
  const wholesale = Number(publicPrices(airpods, 'WHOLESALE').effective.unitPrice);
  const superWholesale = Number(publicPrices(airpods, 'SUPER_WHOLESALE').effective.unitPrice);
  assert.ok(retail > wholesale, `${retail} > ${wholesale}`);
  assert.ok(wholesale > superWholesale, `${wholesale} > ${superWholesale}`);
});

test('minimum quantity is never below 1, even with corrupt data', () => {
  const corrupt = { ...airpods, wholesaleMinQty: 0, superWholesaleMinQty: -4 };
  assert.equal(priceRuleFor(corrupt, 'WHOLESALE').minQuantity, 1);
  assert.equal(priceRuleFor(corrupt, 'SUPER_WHOLESALE').minQuantity, 1);
});

test('quantities are validated against the per-product minimum', () => {
  const min = priceRuleFor(airpods, 'WHOLESALE').minQuantity;
  const accepted = (quantity: number) => quantity >= min;
  assert.equal(accepted(4), false);
  assert.equal(accepted(5), true);
  assert.equal(accepted(6), true);
  assert.ok(priceRuleFor(airpods, 'SUPER_WHOLESALE').minQuantity > min);
});

test('session tier resolution ignores anything unknown', () => {
  assert.equal(tierForSession(null), 'RETAIL');
  assert.equal(tierForSession({ tier: null }), 'RETAIL');
  assert.equal(tierForSession({ tier: 'WHOLESALE' }), 'WHOLESALE');
  assert.equal(tierForSession({ tier: 'SUPER_WHOLESALE' }), 'SUPER_WHOLESALE');
  assert.equal(tierForSession({ tier: 'ADMIN' }), 'RETAIL');
  assert.equal(tierForSession({ tier: 'hacker' }), 'RETAIL');
});

test('order status machine only allows forward movement', () => {
  assert.equal(canTransition('PENDING', 'CONFIRMED'), true);
  assert.equal(canTransition('CONFIRMED', 'PREPARING'), true);
  assert.equal(canTransition('SHIPPED', 'DELIVERED'), true);
  assert.equal(canTransition('CONFIRMED', 'PENDING'), false);
  assert.equal(canTransition('DELIVERED', 'CANCELLED'), false);
  assert.equal(canTransition('CANCELLED', 'CONFIRMED'), false);
  assert.deepEqual(nextStatuses('DELIVERED'), []);
  assert.ok(ORDER_STATUSES.includes('CANCELLED'));
});

test('stock-holding and sale status sets stay consistent', () => {
  for (const status of STOCK_HOLDING_STATUSES) {
    assert.ok(SALE_STATUSES.includes(status), `${status} holds stock but is not a sale`);
  }
  assert.ok(!SALE_STATUSES.includes('PENDING'));
  assert.ok(!SALE_STATUSES.includes('CANCELLED'));
});

test('prices are rendered in Algerian dinars', () => {
  assert.match(formatDA(6500, 'fr'), /6[\s\u202f\u00a0]?500/);
  assert.match(formatDA('5800.00', 'ar'), /5[\s\u202f\u00a0]?800/);
});

test('pricing reads only product columns — there is no caller-supplied amount', () => {
  assert.equal(priceRuleFor.length, 2);
  assert.equal(publicPrices.length, 2);
});
