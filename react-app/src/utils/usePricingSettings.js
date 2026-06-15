import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_PRICING_SETTINGS, normalizePricingSettings } from '../config/pricingSettings';

export function usePricingSettings() {
  const [pricingSettings, setPricingSettings] = useState(DEFAULT_PRICING_SETTINGS);

  useEffect(() => {
    const ref = doc(db, 'platform_settings', 'pricing_controls');
    return onSnapshot(
      ref,
      (snap) => {
        setPricingSettings(normalizePricingSettings(snap.exists() ? snap.data() : DEFAULT_PRICING_SETTINGS));
      },
      () => setPricingSettings(DEFAULT_PRICING_SETTINGS),
    );
  }, []);

  return pricingSettings;
}
