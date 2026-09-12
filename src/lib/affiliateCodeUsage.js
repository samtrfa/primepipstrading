export function countAffiliateCodeUses(accounts, code) {
  if (!code || !Array.isArray(accounts)) return 0;

  const normalizedCode = String(code).trim().toUpperCase();
  const successfulStatuses = new Set(['ACTIVE', 'FUNDED', 'PASSED']);

  return accounts.filter((account) => {
    if (!account || !account.coupon_code) return false;
    const accountCode = String(account.coupon_code).trim().toUpperCase();
    const status = String(account.status ?? '').trim().toUpperCase();

    return accountCode === normalizedCode && successfulStatuses.has(status);
  }).length;
}
