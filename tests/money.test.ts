/** Money arithmetic must never drift: all maths runs on integer centimes. */
import test from 'node:test';
import assert from 'node:assert/strict';

import { toCentimes, toDecimalString, multiply, formatDA, formatNumber } from '../src/lib/money.ts';

test('centimes conversion is exact for typical dinars', () => {
  assert.equal(toCentimes('6500.00'), 650000);
  assert.equal(toCentimes(6500), 650000);
  assert.equal(toCentimes('0.1'), 10);
  assert.equal(toCentimes(null), 0);
  assert.equal(toCentimes('not-a-number'), 0);
});

test('decimal strings are always fixed to two places', () => {
  assert.equal(toDecimalString(6500), '6500.00');
  assert.equal(toDecimalString('5800.5'), '5800.50');
  assert.equal(toDecimalString(0), '0.00');
});

test('multiplying a line never accumulates float error', () => {
  // 0.1 + 0.2 style drift would appear here with float maths.
  assert.equal(multiply('19.99', 3), 59.97);
  assert.equal(multiply(6500, 5), 32500);
  let total = 0;
  for (let i = 0; i < 100; i += 1) total += toCentimes('0.07');
  assert.equal(total / 100, 7);
});

test('display uses the Algerian dinar and western digits', () => {
  assert.match(formatDA(6500), /6[\s\u202f\u00a0]?500\s*DA/);
  assert.match(formatDA(6500, 'ar'), /د\.ج/);
  assert.doesNotMatch(formatDA(6500), /[٠-٩]/);
  assert.match(formatDA(6500.5), /,50/);
});

test('dashboard numbers are grouped in French style', () => {
  assert.match(formatNumber(1234567), /1[\s\u202f\u00a0]?234[\s\u202f\u00a0]?567/);
});
