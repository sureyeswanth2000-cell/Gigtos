# SECURITY_CHECKLIST.md — Gigtos Security Implementation Checklist

## Priority 1 — CRITICAL

### 1. Secrets Management
- [x] `functions/security/secretManager.js` created with caching
- [x] `functions/package.json` updated with `@google-cloud/secret-manager` dependency
- [ ] Gmail, Twilio credentials migrated to Google Secret Manager (requires GCP Console access)
- [ ] `ENCRYPTION_KEY` stored in Secret Manager and loaded as env var in Cloud Functions
- [ ] IAM role bindings configured: Cloud Function SA → `roles/secretmanager.secretAccessor`
- [ ] Secret access audit logging via `functions/security/audit.js`

### 2. Firebase App Check
- [x] `react-app/src/utils/appCheck.js` created
- [ ] App Check enabled in Firebase Console
- [ ] reCAPTCHA v3 site key obtained and set in `REACT_APP_RECAPTCHA_SITE_KEY`
- [ ] `initAppCheck(app)` called in `react-app/src/index.js`
- [ ] App Check enforcement enabled on `submitQuote`, `acceptQuote`, `updateBookingStatus` in Firebase Console

### 3. Input Validation & Sanitisation
- [x] `functions/security/validation.js` created with Joi schemas for all endpoints
- [x] `submitQuote` integrated with `submitQuoteSchema`
- [x] `acceptQuote` integrated with `acceptQuoteSchema`
- [x] `updateBookingStatus` integrated with `updateBookingSchema`
- [x] `react-app/src/utils/sanitization.js` created with DOMPurify
- [x] `dompurify` added to `react-app/package.json`
- [ ] `sanitizeFormData` applied in all React form submission handlers

### 4. Rate Limiting
- [x] `functions/security/rateLimiter.js` created
- [x] `submitQuote` rate-limited (10/min/user)
- [x] `updateBookingStatus` rate-limited (20/hr/user)
- [ ] `createBooking` rate-limited (5/hr/user) — add when booking creation Cloud Function is created
- [ ] OTP request rate-limited (3/hr/phone) — integrate in OTP callable function
- [ ] Login rate-limited (5/hr/phone) — integrate in login callable function
- [ ] Firestore TTL policy set on `rate_limits` collection (auto-cleanup old records)

---

## Priority 2 — HIGH

### 5. OTP Security
- [x] `functions/security/otpManager.js` created
- [x] bcrypt hashing for OTP storage
- [x] 5-minute expiry validation
- [x] 3-attempt limit per OTP
- [x] 15-minute lockout after max attempts
- [x] OTP failure logging to `security_logs`
- [ ] `generateOtp` / `verifyOtp` integrated into OTP callable functions in `index.js`

### 6. Field-Level Encryption
- [x] `functions/security/encryption.js` created (AES-256-GCM)
- [x] PII field definitions in `PII_FIELDS`
- [ ] `encryptFields` applied before writes to `users`, `gig_workers`, `bookings` collections
- [ ] `decryptFields` applied after reads in Cloud Functions that return PII
- [ ] `ENCRYPTION_KEY` set in Cloud Functions environment from Secret Manager
- [ ] Key rotation procedure documented (see `SECURITY.md`)

### 7. Enhanced Firestore Security Rules
- [x] `firebase.rules` updated with:
  - [x] Admin activeness check (`isActive != false`)
  - [x] Worker approval status checks (`approvalStatus == "approved"`)
  - [x] Approval/fraud flag restricted to superadmin/parent
  - [x] `security_logs` — superadmin read only, no client writes
  - [x] `rate_limits` — no client access
  - [x] `otp_records` — no client access
  - [x] New worker creation requires `approvalStatus: "pending"`

### 8. Audit Logging
- [x] `functions/security/audit.js` created
- [x] `security_logs` Firestore collection defined in rules
- [ ] Audit logging integrated in `submitQuote`, `acceptQuote`, `updateBookingStatus`
- [ ] Log retention policy configured (Firestore TTL)

---

## Priority 3 — MEDIUM

### 9. CORS & CSRF
- [ ] CORS whitelist configured in Cloud Functions HTTP endpoints
- [ ] CSRF tokens for any session-based flows

### 10. Security Headers
- [x] `firebase.json` updated with:
  - [x] `Strict-Transport-Security` (HSTS)
  - [x] `X-Content-Type-Options`
  - [x] `X-Frame-Options`
  - [x] `X-XSS-Protection`
  - [x] `Referrer-Policy`
  - [x] `Permissions-Policy`
  - [x] `Content-Security-Policy`

### 11. Security Monitoring
- [ ] Cloud Monitoring dashboards configured
- [ ] Alert policies on failed logins, rate limit violations
- [ ] Notification channels set up

### 12. Data Privacy
- [ ] Data deletion Cloud Function implemented
- [ ] Firestore TTL policies on `security_logs`, `rate_limits`, `otp_records`
- [ ] Data export functionality for user requests

---

## Documentation
- [x] `SECURITY.md` — Security policies and procedures
- [x] `SECURITY_TESTING.md` — Testing guide
- [x] `SECURITY_CHECKLIST.md` — This file
- [x] `INCIDENT_RESPONSE.md` — Incident handling procedures
