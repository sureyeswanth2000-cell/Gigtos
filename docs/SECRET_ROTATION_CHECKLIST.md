# Secret Rotation Checklist

Date: 2026-05-21

Use this after any suspected leak, staff/device change, production incident, or quarterly review.

## Immediate Actions

- Revoke or rotate the exposed key in the provider console first.
- Update Firebase Secret Manager, GitHub Actions secrets, and local `.env` files.
- Redeploy only the services that need the rotated secret.
- Confirm old credentials fail and new credentials work.
- Record who rotated it, when, why, and what services were redeployed.

## Gigtos Secrets To Track

- Gemini API key: Firebase Secret Manager `GEMINI_API_KEY`.
- Gmail app password: Functions environment `GMAIL_PASS`.
- Twilio credentials: `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_PHONE`.
- Payment gateway keys and webhook signing secrets.
- Jira API token or integration token.
- Firebase service account JSON files.
- Any Data Connect or database passwords.

## After Rotation

- Run secret scanning.
- Run production build, tests, Firebase rules compile, and live smoke.
- Check Cloud Functions logs for auth/config errors.
- Check Firebase App Check, Firestore, and Storage denial rates for abnormal spikes.
