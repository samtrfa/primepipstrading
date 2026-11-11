import test from "node:test";
import assert from "node:assert/strict";
import { calculateCouponPrice } from "./coupon-pricing.js";

test("charges the configured BOGO pay percentage and calculates the equivalent discount", () => {
  assert.deepEqual(
    calculateCouponPrice(18, {
      couponType: "bogo",
      payPercent: 75,
      discountPercent: 25,
    }),
    { discountPercent: 25, priceUsd: 13.5 },
  );
});

test("allows a full-price BOGO purchase while keeping the bonus free", () => {
  assert.deepEqual(
    calculateCouponPrice(18, {
      couponType: "bogo",
      payPercent: 100,
      discountPercent: 0,
    }),
    { discountPercent: 0, priceUsd: 18 },
  );
});

test("handles fractional BOGO pay percentages without floating-point mismatch", () => {
  assert.deepEqual(
    calculateCouponPrice(18, {
      couponType: "bogo",
      payPercent: 99.9,
      discountPercent: 0.1,
    }),
    { discountPercent: 0.1, priceUsd: 17.98 },
  );
});

test("preserves standard discount pricing", () => {
  assert.deepEqual(
    calculateCouponPrice(18, { couponType: "discount", discountPercent: 25 }),
    { discountPercent: 25, priceUsd: 13.5 },
  );
});

test("rejects invalid or inconsistent coupon pricing", () => {
  assert.equal(calculateCouponPrice(18, { couponType: "bogo", payPercent: 0, discountPercent: 100 }), null);
  assert.equal(calculateCouponPrice(18, { couponType: "bogo", payPercent: 75, discountPercent: 30 }), null);
  assert.equal(calculateCouponPrice(18, { couponType: "discount", discountPercent: 101 }), null);
  assert.equal(calculateCouponPrice(-1, { couponType: "discount", discountPercent: 0 }), null);
});
