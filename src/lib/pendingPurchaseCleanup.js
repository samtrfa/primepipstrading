export const shouldRemovePendingPurchase = (status, ageMs, timeoutMs, paymentStatus = 'pending') => {
  if (status !== 'pending_payment') return false;
  if (paymentStatus === 'success') return false;
  return ageMs >= timeoutMs;
};
