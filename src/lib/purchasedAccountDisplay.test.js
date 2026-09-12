import test from 'node:test';
import assert from 'node:assert/strict';
import { formatCouponUsage } from './purchasedAccountDisplay.js';

test('shows coupon code when a purchase used a coupon', () => {
  assert.equal(formatCouponUsage('SAVE10'), 'Coupon used: SAVE10');
});

test('shows no-coupon state when a purchase had no coupon', () => {
  assert.equal(formatCouponUsage(null), 'No coupon used');
  assert.equal(formatCouponUsage(''), 'No coupon used');
});
