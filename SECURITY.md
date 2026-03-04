# SECURITY.md — Gigtos Platform Security Policy

## Overview

This document describes the security architecture, policies, and procedures for the Gigtos regional marketplace platform.

---

## 1. Secrets Management

All sensitive credentials (Gmail password, Twilio SID/token, encryption key) are stored in **Google Secret Manager** and never hard-coded or committed to source control.

### Secret Names

| Secret Name       | Purpose                         |
|-------------------|---------------------------------|
| `gmail-user`      | Gmail sender address            |
| `gmail-pass`      | Gmail application password      |
| `twilio-sid`      | Twilio Account SID              |
| `twilio-token`    | Twilio Auth Token               |
| `twilio-phone`    | Twilio sender phone number      |
| `encryption-key`  | 32-byte AES-256 key (hex)       |

### Access Control

Cloud Function service accounts are granted `roles/secretmanager.secretAccessor` on each secret individually via IAM bindings. No wildcard access is granted.

### Secret Rotation

Secrets should be rotated every 90 days. After rotation:
1. Update the secret version in Google Secret Manager.
2. Call `invalidateCache(secretName)` in `functions/security/secretManager.js` or deploy a new function revision to clear the in-memory cache.

---

## 2. Firebase App Check

App Check (reCAPTCHA v3) is configured on all sensitive callable functions:
- `submitQuote`
- `acceptQuote`
- `updateBookingStatus`

**Setup:**
1. Enable App Check in the Firebase Console → App Check.
2. Register your web app with a reCAPTCHA v3 site key.
3. Set `REACT_APP_RECAPTCHA_SITE_KEY=<your_site_key>` in `react-app/.env`.
4. For local development, set `REACT_APP_APPCHECK_DEBUG_TOKEN=<debug_token>` (generate in Firebase Console).
5. Call `initAppCheck(app)` in `react-app/src/index.js` before any Firebase service calls.

---

## 3. Input Validation & Sanitisation

All Cloud Function callable endpoints validate incoming data using **Joi** schemas defined in `functions/security/validation.js`.

Client-side rich-text rendering uses **DOMPurify** (see `react-app/src/utils/sanitization.js`) to prevent XSS.

### Validated Endpoints

| Endpoint              | Schema                  |
|-----------------------|-------------------------|
| `submitQuote`         | `submitQuoteSchema`     |
| `acceptQuote`         | `acceptQuoteSchema`     |
| `updateBookingStatus` | `updateBookingSchema`   |
| `createWorker`        | `createWorkerSchema`    |
| OTP request           | `otpRequestSchema`      |
| OTP verify            | `otpVerifySchema`       |

---

## 4. Rate Limiting

Rate limits are enforced server-side in `functions/security/rateLimiter.js` using Firestore as the counter store.

| Endpoint              | Limit               |
|-----------------------|---------------------|
| `submitQuote`         | 10 per minute / user |
| `createBooking`       | 5 per hour / user   |
| `updateBookingStatus` | 20 per hour / user  |
| OTP request           | 3 per hour / phone  |
| Login                 | 5 per hour / phone  |

Violations return HTTP 429 (`resource-exhausted`) with a `retryAfterMs` field. Repeated violations trigger a **15-minute lockout**.

---

## 5. OTP Security

OTPs are managed by `functions/security/otpManager.js`:
- Generated as 6-digit numeric codes using `Math.random` (sufficient for transient tokens).
- Hashed with **bcrypt** (10 rounds) before storage — never stored in plaintext.
- Expire after **5 minutes**.
- Maximum **3 verification attempts** per OTP.
- **15-minute account lockout** after exhausting attempts.
- All failures logged to `security_logs`.

---

## 6. Field-Level Encryption

PII fields are encrypted at rest using **AES-256-GCM** via `functions/security/encryption.js`.

### Encrypted Fields

| Collection   | Fields                                      |
|--------------|---------------------------------------------|
| `users`      | `phone`, `email`                            |
| `gig_workers`| `phone`, `email`, `aadhaarNumber`           |
| `bookings`   | `userPhone`, `workerPhone`, `userAddress`   |

The encryption key is retrieved from `ENCRYPTION_KEY` environment variable (set from Secret Manager). Key format: 64-character lowercase hex string (32 bytes).

---

## 7. Firestore Security Rules

Enhanced rules in `firebase.rules` enforce:
- **Admin activeness check**: Suspended/deactivated admins (`isActive: false`) cannot perform admin actions.
- **Worker approval status**: Only approved, non-fraudulent workers are visible for assignment.
- **Approval/fraud flag restrictions**: Only superadmins or parent admins can change `approvalStatus` or `isFraud`.
- **Protected collections**: `security_logs`, `rate_limits`, `otp_records` — client writes blocked entirely.
- **State machine enforcement**: All booking state transitions go through Cloud Functions only.

---

## 8. Security Headers

Configured in `firebase.json` for Firebase Hosting:

| Header                     | Value                                     |
|----------------------------|-------------------------------------------|
| `Strict-Transport-Security`| `max-age=31536000; includeSubDomains; preload` |
| `X-Content-Type-Options`   | `nosniff`                                 |
| `X-Frame-Options`          | `SAMEORIGIN`                              |
| `X-XSS-Protection`         | `1; mode=block`                           |
| `Referrer-Policy`          | `strict-origin-when-cross-origin`         |
| `Permissions-Policy`       | Camera/mic blocked; geolocation self-only |
| `Content-Security-Policy`  | Strict CSP allowing only Gigtos domains   |

---

## 9. Audit Logging

Security events are written to the `security_logs` Firestore collection by `functions/security/audit.js`. Only superadmins can read this collection via client SDKs.

### Logged Events

- Authentication success/failure
- Authorisation failures
- Rate limit violations
- OTP failures and lockouts
- Suspicious activity
- Admin actions
- Secret access (production)

---

## 10. Data Privacy

- Personal data (phone, email, Aadhaar) is encrypted at rest (see §6).
- Data deletion on user request should be implemented via a Cloud Function that removes/anonymises `users`, `users_by_phone`, and associated `bookings` documents.
- Audit logs are retained for 90 days (configure TTL policies in Firestore).

---

## Environment Variables

| Variable                          | Location          | Purpose                              |
|-----------------------------------|-------------------|--------------------------------------|
| `ENCRYPTION_KEY`                  | Cloud Functions   | 32-byte AES-256 key (hex)            |
| `REACT_APP_RECAPTCHA_SITE_KEY`    | React app `.env`  | reCAPTCHA v3 site key                |
| `REACT_APP_APPCHECK_DEBUG_TOKEN`  | React app `.env`  | App Check debug token (dev only)     |

Never commit `.env` files to source control. Use `.env.example` templates.

---

## Responsible Disclosure

To report a security vulnerability, email the project maintainer directly. Do not open a public GitHub issue for security concerns.
