export const shouldRemovePendingPurchase = (status, ageMs, timeoutMs) => {
  if (status !== 'pending_payment') return false;
  return ageMs >= timeoutMs;
};
