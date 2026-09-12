import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedEmail } from './emailPolicy.js';

test('allows common providers', () => {
  assert.equal(isAllowedEmail('user@gmail.com'), true);
  assert.equal(isAllowedEmail('person@yahoo.com'), true);
  assert.equal(isAllowedEmail('me@outlook.com'), true);
  assert.equal(isAllowedEmail('name@icloud.com'), true);
});

test('rejects disposable mail', () => {
  assert.equal(isAllowedEmail('test@mailinator.com'), false);
  assert.equal(isAllowedEmail('user@tempmail.com'), false);
  assert.equal(isAllowedEmail('test@10minutemail.com'), false);
});

test('rejects custom domains and invalid email', () => {
  assert.equal(isAllowedEmail('user@mycompany.com'), false);
  assert.equal(isAllowedEmail('not-an-email'), false);
});
