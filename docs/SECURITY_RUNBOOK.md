# Security Runbook

Date: 2026-05-21

## First Response

- Pause risky deploys and preserve logs.
- Identify affected surface: Auth, Firestore, Storage, Functions, payments, payouts, AI, admin console, or support.
- Rotate exposed secrets before discussing details in tickets or chat.
- Disable the smallest risky feature path if user money, location, payout, or identity data may be exposed.
- Open an incident ticket with timeline, owner, severity, affected users, current mitigation, and next update time.

## Common Incidents

- Leaked secret: rotate immediately, redeploy affected service, run Gitleaks, inspect Cloud logs for misuse.
- Account takeover: revoke refresh tokens, force password reset, inspect admin role changes and payout/payment activity.
- Payment or payout bug: stop automated settlement, preserve provider payloads, verify webhook signatures and idempotency.
- Unsafe worker report or SOS abuse: freeze risky account path, preserve evidence, route to manual review.
- Data exposure: revoke risky rules/config, export access logs, identify affected documents/objects, notify per policy.

## Evidence To Preserve

- Cloud Functions logs and correlation IDs.
- Firestore document before/after summaries.
- Storage object path, uploader UID, content type, and timestamps.
- Auth UID, provider, last sign-in time, token revocation time.
- Payment/payout provider event IDs and webhook signatures.

## Recovery Check

- Tests and smoke pass.
- Firebase rules and App Check enforcement are active.
- Secrets are rotated and old values fail.
- TODO and security changelog are updated with the fix and remaining follow-up.
