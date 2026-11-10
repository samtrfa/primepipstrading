import test from 'node:test';
import assert from 'node:assert/strict';
import { getAccountVisitChanges } from './accountVisitChanges.js';

test('counts account additions and removals since the previous visit', () => {
  assert.deepEqual(
    getAccountVisitChanges(['kept', 'removed'], ['kept', 'added']),
    { added: 1, removed: 1 },
  );
});

test('reports no changes when the account IDs are unchanged', () => {
  assert.deepEqual(
    getAccountVisitChanges(['first', 'second'], ['first', 'second']),
    { added: 0, removed: 0 },
  );
});
