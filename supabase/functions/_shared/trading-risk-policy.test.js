import test from "node:test";
import assert from "node:assert/strict";
import { getPositionExitAction, isTradingQuoteFresh } from "./trading-risk-policy.js";

test("detects stop loss and take profit for buy positions at the exact trigger", () => {
  assert.equal(getPositionExitAction("buy", 90, 90, 110), "sl_hit");
  assert.equal(getPositionExitAction("buy", 110, 90, 110), "tp_hit");
});

test("detects stop loss and take profit for sell positions at the exact trigger", () => {
  assert.equal(getPositionExitAction("sell", 110, 110, 90), "sl_hit");
  assert.equal(getPositionExitAction("sell", 90, 110, 90), "tp_hit");
});

test("prefers stop loss when both levels trigger on the same quote", () => {
  assert.equal(getPositionExitAction("buy", 100, 100, 100), "sl_hit");
  assert.equal(getPositionExitAction("sell", 100, 100, 100), "sl_hit");
});

test("does not trigger when price is between levels or levels are absent", () => {
  assert.equal(getPositionExitAction("buy", 100, 90, 110), null);
  assert.equal(getPositionExitAction("sell", 100, 110, 90), null);
  assert.equal(getPositionExitAction("buy", 100, null, null), null);
});

test("rejects unsupported directions and non-triggering prices", () => {
  assert.equal(getPositionExitAction("other", 90, 90, null), null);
  assert.equal(getPositionExitAction("buy", Number.NaN, 90, 110), null);
});

test("accepts a quote at the freshness boundary and rejects old, future or invalid timestamps", () => {
  const now = 10_000;
  assert.equal(isTradingQuoteFresh({ bid: 1, ask: 2, observedAt: 5_000 }, now), true);
  assert.equal(isTradingQuoteFresh({ bid: 1, ask: 2, observedAt: 4_999 }, now), false);
  assert.equal(isTradingQuoteFresh({ bid: 1, ask: 2, observedAt: now + 1 }, now), false);
  assert.equal(isTradingQuoteFresh({ bid: 1, ask: 2, observedAt: Number.NaN }, now), false);
});
