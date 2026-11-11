export const calculateCouponPrice = (basePriceUsd, coupon) => {
  if (!Number.isFinite(basePriceUsd) || basePriceUsd < 0) return null;

  let discountPercent;
  let priceUsd;
  if (coupon.couponType === "bogo") {
    const payPercent = Number(coupon.payPercent);
    if (!Number.isFinite(payPercent) || payPercent < 1 || payPercent > 100) return null;
    discountPercent = Number(coupon.discountPercent);
    if (
      !Number.isFinite(discountPercent) ||
      Math.abs(discountPercent - (100 - payPercent)) > 1e-9
    ) return null;
    priceUsd = Math.round(basePriceUsd * payPercent) / 100;
  } else if (coupon.couponType === "discount") {
    discountPercent = Number(coupon.discountPercent);
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) return null;
    priceUsd = Math.round(basePriceUsd * (100 - discountPercent)) / 100;
  } else {
    return null;
  }

  return { discountPercent, priceUsd };
};
