import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldRemovePendingPurchase } from './pendingPurchaseCleanup.js';

test('keeps active purchases from being removed', () => {
  assert.equal(shouldRemovePendingPurchase('active', 1000, 30 * 60 * 1000), false);
});

test('removes stale pending payment purchases after the timeout', () => {
  assert.equal(shouldRemovePendingPurchase('pending_payment', 31 * 60 * 1000, 30 * 60 * 1000), true);
  assert.equal(shouldRemovePendingPurchase('pending_payment', 29 * 60 * 1000, 30 * 60 * 1000), false);
});
