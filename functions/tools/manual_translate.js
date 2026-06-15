/**
 * manual_translate.js
 *
 * Helper script to translate `WORKER_STRINGS` into supported Indian languages
 * using Sarvam AI and write results into Firestore at `translations/{lang}`.
 *
 * Usage (locally):
 * 1. Create a service account JSON and set `GOOGLE_APPLICATION_CREDENTIALS` to its path.
 * 2. Set `SARVAM_API_KEY` in your environment (rotate any pasted keys first!).
 * 3. Run: `node manual_translate.js`
 *
 * Notes:
 * - This mirrors the Cloud Function logic but is meant for one-off admin runs.
 * - Make sure the service account has Firestore write permissions.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const SARVAM_API_URL = 'https://api.sarvam.ai/translate';
const SARVAM_BATCH_SEP = '|||SPLIT|||';
const SARVAM_MAX_CHARS = 1700;
const SARVAM_RATE_MS = 1100;

const sarvamApiKey = process.env.SARVAM_API_KEY;
if (!sarvamApiKey) {
  console.error('Missing SARVAM_API_KEY environment variable. Aborting.');
  process.exit(1);
}

// Initialize Firebase Admin (uses GOOGLE_APPLICATION_CREDENTIALS)
admin.initializeApp();
const db = admin.firestore();

const workerStrings = require('./workerStrings.json');

function packSarvamBatches(strings) {
  const batches = [];
  let current = [];
  let currentLen = 0;
  for (const s of strings) {
    const sepCost = current.length > 0 ? SARVAM_BATCH_SEP.length : 0;
    if (currentLen + sepCost + s.length > SARVAM_MAX_CHARS && current.length > 0) {
      batches.push(current);
      current = [s];
      currentLen = s.length;
    } else {
      current.push(s);
      currentLen += sepCost + s.length;
    }
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

async function callSarvam(text, targetLang) {
  const res = await fetch(SARVAM_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': sarvamApiKey,
    },
    body: JSON.stringify({
      input: text,
      source_language_code: 'en-IN',
      target_language_code: targetLang,
      model: 'sarvam-translate:v1',
      enable_preprocessing: false,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => String(res.status));
    throw new Error(`Sarvam ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = await res.json();
  return (json.translated_text || '').trim();
}

async function translateToLang(stringsDict, targetLang) {
  const cacheRef = db.collection('translations').doc(targetLang);
  // Load existing cache
  let cached = {};
  try {
    const snap = await cacheRef.get();
    if (snap.exists) cached = snap.data() || {};
  } catch (e) {
    console.warn('Cache read failed:', e.message || e);
  }

  const missing = Object.entries(stringsDict).filter(([key]) => !cached[key]);
  if (missing.length === 0) {
    console.log(`[manual_translate] All strings already cached for ${targetLang}`);
    return { ...cached };
  }

  console.log(`[manual_translate] Translating ${missing.length} strings → ${targetLang}`);
  const result = { ...cached };
  const missingValues = missing.map(([, v]) => v);
  const batches = packSarvamBatches(missingValues);
  let globalIdx = 0;
  let lastCallAt = 0;

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    const elapsed = Date.now() - lastCallAt;
    if (lastCallAt > 0 && elapsed < SARVAM_RATE_MS) {
      await new Promise(r => setTimeout(r, SARVAM_RATE_MS - elapsed));
    }
    const joined = batch.join(SARVAM_BATCH_SEP);
    let translated = null;
    try {
      translated = await callSarvam(joined, targetLang);
      lastCallAt = Date.now();
    } catch (err) {
      console.warn('[manual_translate] batch failed, using English fallback', { lang: targetLang, batchIdx, err: err.message });
      lastCallAt = Date.now();
      batch.forEach((_, i) => {
        const [key, engVal] = missing[globalIdx + i];
        result[key] = engVal;
      });
      globalIdx += batch.length;
      continue;
    }

    const parts = translated.split(SARVAM_BATCH_SEP);
    batch.forEach((engStr, i) => {
      const [key] = missing[globalIdx + i];
      result[key] = (parts[i] || engStr).trim() || engStr;
    });
    globalIdx += batch.length;

    try {
      await cacheRef.set(result, { merge: true });
      console.log(`[manual_translate] Saved batch ${batchIdx + 1}/${batches.length} for ${targetLang}`);
    } catch (e) {
      console.warn('[manual_translate] cache write failed', e.message || e);
    }
  }

  try {
    await cacheRef.set({
      ...result,
      _meta: { lang: targetLang, totalKeys: Object.keys(result).length, completedAt: admin.firestore.FieldValue.serverTimestamp(), source: 'manual-script' },
    }, { merge: true });
  } catch (e) {
    console.warn('[manual_translate] final save failed', e.message || e);
  }

  console.log(`[manual_translate] Translation complete for ${targetLang}. Total keys: ${Object.keys(result).length}`);
  return result;
}

async function main() {
  const targetLangs = ['hi-IN', 'te-IN', 'kn-IN', 'ta-IN'];
  for (const lang of targetLangs) {
    try {
      await translateToLang(workerStrings, lang);
    } catch (err) {
      console.error('Failed to translate', lang, err.message || err);
    }
  }
  console.log('All translations requested. Check Firestore translations/ documents for results.');
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
