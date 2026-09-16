import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldModifyPositionForAsset } from './tradingPanelRules.js';

test('keeps asset-wide updates scoped to the same asset and direction', () => {
  const position = { id: 'p-1', asset_id: 'btc', position_type: 'buy', status: 'open' };

  assert.equal(
    shouldModifyPositionForAsset(position, { id: 'p-2', asset_id: 'btc', position_type: 'buy', status: 'open' }, true),
    true,
  );
  assert.equal(
    shouldModifyPositionForAsset(position, { id: 'p-2', asset_id: 'btc', position_type: 'sell', status: 'open' }, true),
    false,
  );
  assert.equal(
    shouldModifyPositionForAsset(position, { id: 'p-2', asset_id: 'btc', position_type: 'buy', status: 'closed' }, true),
    false,
  );
  assert.equal(
    shouldModifyPositionForAsset(position, { id: 'p-2', asset_id: 'eth', position_type: 'buy', status: 'open' }, true),
    false,
  );
});

test('keeps the exact-position path when asset-wide update is not enabled', () => {
  const position = { id: 'p-1', asset_id: 'btc', position_type: 'buy', status: 'open' };

  assert.equal(
    shouldModifyPositionForAsset(position, { id: 'p-2', asset_id: 'btc', position_type: 'buy', status: 'open' }, false),
    false,
  );
  assert.equal(
    shouldModifyPositionForAsset(position, { id: 'p-1', asset_id: 'btc', position_type: 'buy', status: 'open' }, false),
    true,
  );
});
