export const EMPTY_BANK_ACCOUNT = {
  accountHolderName: '',
  accountNumber: '',
  ifsc: '',
  bankName: '',
  upiId: '',
};

export function normalizeBankAccount(account = {}) {
  return {
    accountHolderName: (account.accountHolderName || '').toString().trim().slice(0, 120),
    accountNumber: (account.accountNumber || '').toString().replace(/\s/g, '').slice(0, 30),
    ifsc: (account.ifsc || '').toString().trim().toUpperCase().slice(0, 11),
    bankName: (account.bankName || '').toString().trim().slice(0, 120),
    upiId: (account.upiId || '').toString().trim().slice(0, 80),
  };
}

export function validateBankAccount(account = {}) {
  const normalized = normalizeBankAccount(account);
  if (!normalized.accountHolderName) return 'Account holder name is required.';
  if (!/^[0-9]{6,30}$/.test(normalized.accountNumber)) return 'Enter a valid bank account number.';
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalized.ifsc)) return 'Enter a valid IFSC code.';
  if (!normalized.bankName) return 'Bank name is required.';
  return '';
}

export function maskAccountNumber(accountNumber = '') {
  const clean = accountNumber.toString().replace(/\D/g, '');
  if (clean.length <= 4) return clean ? `****${clean}` : 'Not set';
  return `****${clean.slice(-4)}`;
}
