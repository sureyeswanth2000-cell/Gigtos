# Production Security Checklist

Date: 2026-05-21

Run before any production launch or security-sensitive release.

## Required Gates

- Production React build passes with App Check required.
- React tests and route smoke pass.
- Cloud Functions syntax check passes.
- Firestore and Storage rules compile.
- CodeQL runs on the branch.
- Secret scan runs on the branch.
- Dependency audit is reviewed, with high/critical findings either fixed or explicitly accepted with an owner and date.

## Firebase

- App Check enforcement is active for Firestore, Storage, and callable Functions.
- Firestore rules deny direct writes for roles, score ledgers, private phone indexes, payments, payouts, and admin-only data.
- Storage rules use per-user prefixes, size/type limits, no public listing, and App Check enforcement.
- Admin bootstrap scripts are not hardcoded to a personal UID/email in deployable code.

## Backend And Money Flows

- Webhooks verify signatures.
- Payment/payout writes use idempotency keys.
- User ownership is checked on every booking, dispute, wallet, support, and payout action.
- Privileged actions log actor, reason, before/after summary, and correlation ID.

## Frontend

- No private API keys, service accounts, database passwords, admin credentials, payment secrets, or Gemini keys are bundled.
- Dev bypass is disabled in production builds.
- Superadmin sensitive actions require recent sign-in, with MFA still required before production scale.
- Security headers/CSP are reviewed for the actual hosting target.
