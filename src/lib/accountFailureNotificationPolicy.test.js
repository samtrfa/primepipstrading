import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldCreateAccountFailureNotification, getAccountFailureNotification } from './accountFailureNotificationPolicy.js';

test('skips rule-breach notification for abandoned pending payment accounts', () => {
  assert.equal(shouldCreateAccountFailureNotification('pending_payment', 'failed'), false);
  assert.deepEqual(getAccountFailureNotification('pending_payment', 'failed'), {
    type: 'payment_expired',
    title: 'Payment not completed',
    message: 'This account purchase expired or was declined before payment was confirmed. You can retry purchase from the checkout page.'
  });
});

test('emits rule-breach notification for real account failures', () => {
  assert.equal(shouldCreateAccountFailureNotification('active', 'failed'), true);
  assert.deepEqual(getAccountFailureNotification('active', 'failed'), {
    type: 'account_failure',
    title: 'Account failed',
    message: 'Your trading account has breached its rules. Review your account details for more information.'
  });
});
