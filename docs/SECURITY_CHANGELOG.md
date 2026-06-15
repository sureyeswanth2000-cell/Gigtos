# Security Changelog

Date: 2026-05-21

## App Check And Firebase Hardening

- Registered the `Gigtos-web` Firebase web app with reCAPTCHA Enterprise App Check.
- Added frontend App Check initialization with the public Enterprise site key.
- Added production build guards to block App Check debug tokens.
- Deployed the GitHub Pages frontend with App Check enabled.
- Deployed hardened Firestore rules and enabled Firestore App Check enforcement.
- Created Firebase-linked private Storage bucket `gigtos-user-uploads-gigto-c0c83` in `ASIA-SOUTH1`.
- Added Storage rules, released them to `gigtos-user-uploads-gigto-c0c83`, and enabled Storage App Check enforcement.
- Updated upload paths to per-user object prefixes and explicit image content types.
- Wrapped active callable Functions with App Check enforcement.
- Skipped App Check initialization in Jest/test runtime so local UI smoke tests do not crash on browser-only App Check internals.

## Gemini API Safety

- Removed direct frontend Gemini API usage.
- Stored the Gemini API key in Firebase Secret Manager as `GEMINI_API_KEY`.
- Attached the secret only to `aiBookingAssistant`.
- Redeployed `aiBookingAssistant` with App Check enforcement and Secret Manager access.

## Backend Deploy Compatibility

- Switched Functions import to the v1 compatibility entrypoint required by the current code style.
- Replaced removed `functions.config()` runtime usage with environment variables and Secret Manager.

## Verification

- Production React build passes.
- Booking smoke test passes.
- Dev UI smoke test passes.
- Route smoke test passes.
- Firestore and Storage rules compile in emulators.
- Direct callable requests without App Check are rejected with `401`.
- Live GitHub Pages root serves the latest bundle.
- Live smoke checks pass for deployed hash routes, SPA fallback, SSL, and Maps/navigation bundle content.
- Full React test suite passes: 14 suites, 137 tests.

## Test And Tooling Updates

- Updated the live smoke script to match the app's `HashRouter` deployment model on GitHub Pages.
- Updated stale booking workflow score expectation from old `+15` worker rating delta to current `+8` GigScore rule.

## Firestore Record Rules

- Added explicit rules for `rideRequests`.
- Added explicit rules for `support_tickets`.
- Added explicit read-only rules for `bookings/{bookingId}/dispute_analysis`.
- Tightened `admin_alerts` updates to status/read/close fields only.
- Fixed worker phone index writes to include the normalized phone field expected by rules.
- Deployed the updated Firestore rules to `cloud.firestore`.

## Security Gates And Hygiene

- Added Dependabot for React, Functions, and GitHub Actions.
- Added Gitleaks secret scanning with an allowlist for the public Firebase web API key.
- Added a `Security Gates` workflow covering production build, React tests, route smoke, Functions syntax, Firebase rules compile, secret scanning, and blocking production dependency audit.
- Added Firebase rules unit tests for high-risk Firestore and Storage allow/deny paths and wired them into `Security Gates`.
- Upgraded `firebase`, `styled-components`, and `nodemailer`, then added npm overrides for patched transitive packages.
- `npm audit --omit=dev --audit-level=high` now reports `found 0 vulnerabilities` for both React and Functions.
- Removed committed real-looking QA credentials from docs/legacy helpers.
- Changed one-off superadmin bootstrap scripts to require local `SUPERADMIN_UID` and `SUPERADMIN_EMAIL` instead of hardcoded personal values.

## Web And Admin Hardening

- Added a meta CSP for the GitHub Pages build covering Firebase, App Check, reCAPTCHA, OpenStreetMap, IP lookup, and current CDN usage.
- Added recent Firebase re-auth before sensitive SuperAdmin UI actions such as region suspension, worker fraud marking, dispute resolution, admin assignment, region-lead creation, Copper settings, and GigScore review.
- Added the App Check protected `superadminAction` callable for region suspension/reinstatement, worker fraud marking, admin hierarchy changes, Copper settings, and region lead provisioning.
- Tightened Firestore rules so direct client writes can no longer update admin hierarchy/status, SuperAdmin worker fraud/status fields, or platform settings; these changes must go through backend callables.
- Deployed `superadminAction`, hardened Firestore rules, and the updated GitHub Pages frontend; live route smoke checks pass after deployment.
- Added the App Check protected `adminWorkerAction` callable for worker creation, worker detail edits, worker activation toggles, worker approval/rejection, worker phone-index maintenance, and region-lead mason provisioning.
- Tightened Firestore rules so admin/region-lead/mason clients can no longer directly create/approve/reject/activate workers, maintain worker phone indexes, or create mason admin records; worker self-registration remains limited to pending/inactive self-owned records.
- Deployed `adminWorkerAction`, the updated Firestore rules, and the updated GitHub Pages frontend; live route smoke checks pass after deployment.
- Expanded `updateBookingStatus` for callable-only consumer contact edits and worker start/finish transitions with completion-photo validation.
- Removed frontend fallback paths that directly updated booking status, assignment, dispute, note, photo, rating, and contact fields from Admin, Consumer, and Worker screens.
- Tightened Firestore booking rules so direct client booking updates are denied; booking updates now go through App Check protected callable functions.
- Deployed the updated `updateBookingStatus`, hardened Firestore rules, and GitHub Pages frontend; live route smoke checks pass after deployment.
- Added security runbook, secret rotation checklist, and production security checklist docs.
- Added configurable payout/dispute hold timing to backend pricing controls with a 2-hour default, 30-minute minimum, 24-hour maximum, SuperAdmin reason capture, and security audit fields for old/new hold values.
- Updated booking completion and worker withdrawal eligibility to use the configured hold timing before worker payout release.
- Added SuperAdmin MFA policy checks for sensitive `superadminAction` mutations. Hard enforcement can be enabled with `REQUIRE_SUPERADMIN_MFA=true`; until the enrollment UI exists, pricing-control audits record MFA policy/enrollment status without locking out current operations.
- Added a SuperAdmin Security tab for phone MFA enrollment, SMS verification, factor refresh, and recent-auth protected factor removal.
- Updated worker payout UI copy/readiness to use the configured hold duration and existing booking-level payout eligibility timestamps.
- Upgraded Functions runtime target from Node.js 20 to Node.js 22 in `functions/package.json` and `functions/package-lock.json`.
- Redeployed all locally defined Cloud Functions on Node.js 22 and identified remote-only legacy functions `refreshWorkerStats` and `submitWorkerRating`.
- Restored `refreshWorkerStats` into local source as the hourly worker stats sync and redeployed it on Node.js 22.
- Restored `submitWorkerRating` into local source as an App Check protected compatibility callable that validates booking ownership/completion before writing ratings; current clients should use `updateBookingStatus(user_rate)`.
- Added consumer-facing payment hold status in My Bookings, driven by `workerPayoutEligibleAt` and the configured SuperAdmin hold duration fallback.
- Added backend payout-state transitions for disputes: open disputes set `workerPayoutStatus: held_for_dispute`, worker-fault resolutions block payout, and worker-payable resolutions clear the payout hold.
- Added SuperAdmin manual payout hold/release for suspicious worker payouts, with recent re-auth in the UI, App Check protected backend mutation, activity logs, and security audit entries.
- Added deterministic CI security pattern scan for unconditional public Firebase rules, unprotected callable functions, and private frontend secret environment variable names.
- Added privacy-safe backend log redaction for SMS fallback logs and dispute reason console logs.
- Added daily backend rate limits for AI assistant calls, consumer payment-link creation, and worker withdrawal requests.
- Moved worker payout bank saves behind the `updateWorkerPayoutAccount` callable. Full bank details now live in backend-only `worker_payout_accounts`; app-readable worker docs and payout operation rows keep only masked display data/fingerprints.
- Added payment-link reuse/idempotency behavior and richer payout reconciliation fields: idempotency key, retry count, UTR, failure reason, and reconciliation notes.
- Added field-operator payout hold flow for open disputes. Held bookings use `workerPayoutStatus: field_operator_hold`, block worker/scheduled withdrawals, and write activity/security audit entries.
- Added scheduled failed-payout retry job that re-checks payout eligibility, uses the latest protected payout account, records retry counts/errors, and stops after two retries.
- Added worker SOS flow with backend-only incident creation, SuperAdmin alert, support ticket creation, rate limiting, location-if-consented payloads, and security audits.
- Added Firestore rules/tests for backend-only SOS incidents.
- Fixed the Firebase Storage deploy config to include the explicit private upload bucket, then re-released `storage.rules` after local allow/deny rules tests passed.
- Added `docs/SECURITY_EXTERNAL_SETUP.md` so native/cloud-console security work is tracked outside the code TODO, and `docs/SOS_TRAINING_SCRIPT.md` for worker SOS training content.

## Still Pending

- Rotate the Gemini API key later because it was shared in chat; the current live app uses it only from backend Secret Manager.
- Enroll owner SuperAdmin accounts, then enable hard backend enforcement with `REQUIRE_SUPERADMIN_MFA=true`.
- Move any remaining payment, payout, wallet, SOS, and booking edge-case transitions behind callable Functions as the production architecture is finalized.
- Expand Firebase rules unit tests as new wallet, payout, payment, SOS, and native/mobile paths go live.
