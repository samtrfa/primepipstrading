import test from 'node:test';
import assert from 'node:assert/strict';
import { countAffiliateCodeUses } from './affiliateCodeUsage.js';

test('counts successful affiliate code uses only', () => {
  const accounts = [
    { coupon_code: 'SHAKER', status: 'active' },
    { coupon_code: 'SHAKER', status: 'funded' },
    { coupon_code: 'SHAKER', status: 'passed' },
    { coupon_code: 'SHAKER', status: 'failed' },
    { coupon_code: 'SHAKER', status: 'pending_payment' },
    { coupon_code: 'OTHER', status: 'active' },
    { coupon_code: ' shaker ', status: 'active' },
    { coupon_code: null, status: 'active' },
  ];

  assert.equal(countAffiliateCodeUses(accounts, 'SHAKER'), 4);
  assert.equal(countAffiliateCodeUses(accounts, 'OTHER'), 1);
  assert.equal(countAffiliateCodeUses(accounts, 'MISSING'), 0);
});
