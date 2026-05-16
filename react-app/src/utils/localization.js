export const SUPPORTED_LANGUAGES = ['en', 'hi', 'te', 'ta', 'kn'];

const messages = {
  score_up: {
    en: 'Your score increased.',
    hi: 'आपका स्कोर बढ़ा.',
    te: 'మీ స్కోర్ పెరిగింది.',
    ta: 'உங்கள் மதிப்பெண் உயர்ந்தது.',
    kn: 'ನಿಮ್ಮ ಸ್ಕೋರ್ ಹೆಚ್ಚಾಗಿದೆ.',
  },
  score_down: {
    en: 'Your score dropped.',
    hi: 'आपका स्कोर कम हुआ.',
    te: 'మీ స్కోర్ తగ్గింది.',
    ta: 'உங்கள் மதிப்பெண் குறைந்தது.',
    kn: 'ನಿಮ್ಮ ಸ್ಕೋರ್ ಕಡಿಮೆಯಾಗಿದೆ.',
  },
  recovery_advice: {
    en: 'Complete clean jobs to recover your tier.',
    hi: 'अपना टियर वापस पाने के लिए साफ काम पूरे करें.',
    te: 'మీ టియర్ తిరిగి పొందడానికి మంచి పనులు పూర్తి చేయండి.',
    ta: 'உங்கள் தரத்தை மீட்டெடுக்க நல்ல வேலைகளை முடிக்கவும்.',
    kn: 'ನಿಮ್ಮ ಟಿಯರ್ ಮರಳಿ ಪಡೆಯಲು ಉತ್ತಮ ಕೆಲಸಗಳನ್ನು ಪೂರ್ಣಗೊಳಿಸಿ.',
  },
  platform_fee_free: {
    en: 'Eligible platform fee is removed.',
    hi: 'योग्य प्लेटफॉर्म शुल्क हटाया गया.',
    te: 'అర్హమైన ప్లాట్‌ఫారమ్ ఫీ తీసివేయబడింది.',
    ta: 'தகுதியான பிளாட்ஃபார்ம் கட்டணம் நீக்கப்பட்டது.',
    kn: 'ಅರ್ಹ ಪ್ಲಾಟ್‌ಫಾರ್ಮ್ ಶುಲ್ಕ ತೆಗೆದುಹಾಕಲಾಗಿದೆ.',
  },
};

export function t(key, lang = 'en') {
  const safeLang = SUPPORTED_LANGUAGES.includes(lang) ? lang : 'en';
  return messages[key]?.[safeLang] || messages[key]?.en || key;
}

export function translateScoreEvent(event, lang = 'en') {
  const delta = Number(event?.delta || 0);
  const prefix = delta >= 0 ? t('score_up', lang) : t('score_down', lang);
  return `${prefix} ${event?.reasonText || event?.reasonCode || ''}`.trim();
}
