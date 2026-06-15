export const WALLET_RULES = {
  platformFeeDebtLimit: -100,
  debtJobLimitPerDay: 1,
  dailyScorePenaltyNeedsDiscussion: -5,
};

export function createWalletLedgerEntry({
  walletId,
  bookingId,
  type,
  amount,
  reason,
  createdAt = new Date(),
}) {
  if (!walletId) throw new Error('walletId is required');
  if (!type) throw new Error('type is required');
  if (!reason) throw new Error('reason is required');
  const value = Number(amount);
  if (!value) throw new Error('amount is required');

  return {
    walletId,
    bookingId: bookingId || null,
    type,
    amount: Math.round(value * 100) / 100,
    reason,
    createdAt,
  };
}

export function calculateWalletBalance(entries = []) {
  return Math.round(entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0) * 100) / 100;
}

export function recordCashPlatformFeeDebt({ walletId, bookingId, platformFee, createdAt = new Date() }) {
  return createWalletLedgerEntry({
    walletId,
    bookingId,
    type: 'platform_fee_debt',
    amount: -Math.abs(Number(platformFee || 0)),
    reason: 'Worker collected cash; platform booking fee is owed to Gigtos.',
    createdAt,
  });
}

export function evaluateWalletRestrictions({ balance, rules = WALLET_RULES }) {
  const limited = Number(balance) <= rules.platformFeeDebtLimit;
  return {
    balance: Number(balance),
    limited,
    maxJobsPerDay: limited ? rules.debtJobLimitPerDay : null,
    gigScorePenaltyNeedsDiscussion: limited ? rules.dailyScorePenaltyNeedsDiscussion : 0,
    socioScorePenaltyNeedsDiscussion: limited ? rules.dailyScorePenaltyNeedsDiscussion : 0,
    message: limited
      ? 'Wallet debt crossed INR 100. Limit worker to one job per day and discuss daily GigScore effect before automation.'
      : 'Wallet is within platform-fee debt limit.',
  };
}
