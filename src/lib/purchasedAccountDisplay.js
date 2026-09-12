export const formatCouponUsage = (couponCode) => {
  const normalized = typeof couponCode === 'string' ? couponCode.trim() : '';

  if (!normalized) return 'No coupon used';
  return `Coupon used: ${normalized.toUpperCase()}`;
};
