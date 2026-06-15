# Security External Setup Checklist

Date: 2026-05-24

These items cannot be completed only by code changes because they require owner console access, a native app build, or third-party security tools.

## Owner Console Switches

- [x] Enroll every owner SuperAdmin account in Firebase MFA.
  - done: Phone MFA enrollment UI is live in the SuperAdmin Security tab (app → /admin/super → Security).
  - done: `REQUIRE_SUPERADMIN_MFA=true` is set in `functions/.env` and deployed — backend now hard-blocks all 14 sensitive mutations for unenrolled accounts.
  - action: Complete phone MFA enrollment via the Security tab if not already done — the backend will reject sensitive actions until enrollment is confirmed.
- [x] After enrollment, set `REQUIRE_SUPERADMIN_MFA=true` for Cloud Functions.
  - done: set in `functions/.env`, injected automatically on every `firebase deploy --only functions`.
- Review Firebase App Check enforcement remains enabled for Firestore, Storage, and callable Functions.
- Review Google Cloud IAM least privilege for Firebase Admin SDK, deploy accounts, Functions runtime, Storage, Data Connect, logging, and automation users.

## Native App Controls

- Add Android Play Integrity when the Android/native wrapper exists.
- Use R8/ProGuard minification for Android release builds.
- Review iOS symbol stripping/obfuscation when the iOS/native wrapper exists.
- Evaluate certificate pinning only for native first-party API calls, with a rotation and emergency recovery plan.

## Launch Security Drills

- Run OWASP ZAP or equivalent dynamic scan against a staging URL.
- Run a Firestore/Storage backup and restore drill before production scale.
- Confirm secret rotation works for Gemini, Razorpay, Twilio, Gmail, Firebase service accounts, and webhook secrets.
- Keep monthly security review on the launch calendar.
