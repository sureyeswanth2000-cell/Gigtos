import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'gigtos-language';

export const supportedLanguages = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी' },
  { code: 'te', label: 'Telugu', nativeLabel: 'తెలుగు' },
  { code: 'kn', label: 'Kannada', nativeLabel: 'ಕನ್ನಡ' },
  { code: 'ta', label: 'Tamil', nativeLabel: 'தமிழ்' },
];

const translations = {
  en: {
    alertsBlocked: 'Alerts blocked',
    alertsEnabled: 'Alerts enabled',
    alertsPrompt: 'Enable browser alerts so Smart Queue offers are harder to miss.',
    alertsWaiting: 'Alerts waiting',
    availableBalance: 'Available balance',
    bankAccountNote: 'Add bank details in your profile before requesting withdrawal.',
    cashPlatformFeeDue: 'Cash platform-fee due',
    clear: 'Clear',
    due: 'Due',
    duesWarning: 'Pay pending platform-fee dues to keep full job access.',
    eligibleJobs: 'Eligible jobs',
    emergencySos: 'Emergency SOS',
    emergencySosDesc: 'Send a safety alert to Gigtos support for your current work session.',
    gigScoreUnlock: 'GigScore free access unlock',
    jobAccessState: 'Job access state',
    jobOfferAlerts: 'Job offer alerts',
    keepJobsClean: 'Complete jobs cleanly, avoid cancellations, and collect fair ratings to unlock launch access faster.',
    launchAccess: 'Launch access',
    limited: 'Limited',
    link: 'Link',
    nextRelease: 'Next release',
    none: 'None',
    normal: 'Normal',
    payoutHoldNote: 'Withdrawable earnings unlock after the configured dispute hold window.',
    payPlatformFee: 'Pay platform fee',
    platformFeeHealth: 'Platform fee health',
    'Please enter your price': 'Please enter your price',
    ptsLeft: 'pts left',
    ready: 'Ready',
    readyForImps: 'Ready for IMPS',
    recoveryNote: 'No commission is charged on job earnings during launch.',
    requesting: 'Requesting...',
    script: 'Script',
    sending: 'Sending...',
    sendSos: 'Send SOS',
    unlocked: 'Unlocked',
    waiting: 'Waiting',
    walletAndDues: 'Wallet and dues',
    walletHealthy: 'Wallet is healthy. You can keep receiving normal Smart Queue offers.',
    withdrawByImps: 'Withdraw by IMPS',
    withdrawEarnings: 'Withdraw earnings',
    workerPayout: 'Worker payout',
  },
  hi: {},
  te: {},
  kn: {},
  ta: {},
};

const LanguageContext = createContext({
  language: 'en',
  setLanguage: () => {},
  supportedLanguages,
  t: (key, fallback) => fallback || key,
});

function normalizeLanguage(value) {
  return supportedLanguages.some(lang => lang.code === value) ? value : 'en';
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    if (typeof window === 'undefined') return 'en';
    return normalizeLanguage(window.localStorage.getItem(STORAGE_KEY) || 'en');
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, language);
    }
  }, [language]);

  const value = useMemo(() => ({
    language,
    supportedLanguages,
    setLanguage: (nextLanguage) => setLanguageState(normalizeLanguage(nextLanguage)),
    t: (key, fallback) => translations[language]?.[key] || translations.en?.[key] || fallback || key,
  }), [language]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export default LanguageContext;
