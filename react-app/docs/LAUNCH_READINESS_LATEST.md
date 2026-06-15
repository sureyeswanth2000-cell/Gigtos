# Launch Readiness Latest

- Time: 2026-06-15T15:46:59.438Z
- Status: READY_FOR_MANUAL_QA
- Blocking setup/code items: 0
- Manual QA items: 1

## Worker profile Firestore write rules

- Status: configured
- Next action: No action if deployed rules are current.
- Evidence:
  - firebase.rules match /gig_workers/{workerId}
  - safe worker profile allowlist keeps approval/status/GigScore/payout out of client writes

## Consumer profile extended fields and photo upload

- Status: configured
- Next action: No action if deployed hosting and storage rules are current.
- Evidence:
  - Profile.js stores state/postalCode/photoURL
  - CompleteProfilePhone.js collects phone/location/photo
  - storage.rules allows scoped user profile image create

## Privacy policy URL

- Status: configured
- Next action: Use https://gigto.in/#/privacy for app store privacy URL.
- Evidence:
  - PrivacyPolicy.js=present
  - Route /privacy=present

## PWA manifest

- Status: configured
- Next action: No action if deployed hosting is current.
- Evidence:
  - name=Gigtos - Verified Home Services
  - start_url=/
  - display=standalone
  - icons=1

## Production browser console guard

- Status: configured
- Next action: No action if deployed hosting is current.
- Evidence:
  - src/index.js installs the guard before Sentry/browser startup
  - src/utils/productionConsoleGuard.js suppresses console.log/info/debug in production only
  - console.warn/error remain available for meaningful browser diagnostics

## Worker Web Push VAPID key

- Status: configured
- Next action: Firebase Console -> Project settings -> Cloud Messaging -> Web Push certificates -> Generate key pair, then set REACT_APP_FIREBASE_VAPID_KEY in react-app/.env.production and redeploy hosting.
- Evidence:
  - REACT_APP_FIREBASE_VAPID_KEY=configured

## Real-account manual E2E QA

- Status: needs_manual_run
- Next action: Run docs/LAUNCH_MANUAL_QA_RUNBOOK.md with real Firebase test accounts after VAPID is configured; automated dev smoke already passes.
- Evidence:
  - LAUNCH_MANUAL_QA_RUNBOOK.md=present
  - TEST_LOGINS.md=present
  - consumer full flow
  - worker approval/open-to-work/offer flow
  - field operator verification/dispute flow
  - superadmin pricing/worker approval/health flow
  - mason and region lead are optional legacy checks only if launch-enabled
