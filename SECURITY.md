# Security Documentation — Gigtos Platform

This document describes the security controls implemented in the Gigtos platform and provides guidance for developers, operators, and incident responders.

---

## 1. Secrets Management

### Implementation
All secrets are stored in **Google Secret Manager** and retrieved at runtime. The `functions/security/secretManager.js` module provides:

- **Cached secret retrieval** — secrets are cached for 5 minutes to minimise API calls.
- **Graceful fallback** — if Secret Manager is unavailable, credentials fall back to `firebase functions:config`.

### Managed Secrets
| Secret Name | Description |
|---|---|
| `gmail-user` | Gmail sender address for transactional emails |
| `gmail-pass` | Gmail app password for SMTP |
| `twilio-sid` | Twilio Account SID |
| `twilio-token` | Twilio Auth Token |
| `twilio-phone` | Twilio sender phone number |
| `field-encryption-key` | 32-byte hex key for AES-256-CBC field encryption |

### Creating a Secret
```bash
echo -n "your-secret-value" | gcloud secrets create SECRET_NAME --data-file=-
# Grant Cloud Functions access
gcloud secrets add-iam-policy-binding SECRET_NAME \
  --member="serviceAccount:PROJECT_ID@appspot.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Secret Rotation
1. Create a new secret version: `gcloud secrets versions add SECRET_NAME --data-file=-`
2. Update the new version in Secret Manager.
3. Call `clearSecretCache()` or wait 5 minutes for the cache to expire.
4. Disable the old version: `gcloud secrets versions disable OLD_VERSION_ID --secret=SECRET_NAME`

---

## 2. Firebase App Check

### Implementation
App Check (`react-app/src/utils/appCheck.js`) is initialized in `react-app/src/index.js` using the **reCAPTCHA v3** provider.

### Setup
1. Go to [Firebase Console → App Check](https://console.firebase.google.com/) and enable App Check for your project.
2. Register your web app domain and obtain a **reCAPTCHA v3 site key**.
3. Set the environment variable:
   ```
   REACT_APP_RECAPTCHA_SITE_KEY=your_site_key_here
   ```
4. (Optional) Enforce App Check on Cloud Functions via the Firebase Console.

---

## 3. Input Validation

### Implementation
All Cloud Function inputs are validated using **Joi** schemas (`functions/security/validation.js`).

### Validated Functions
| Function | Schema | Key Validations |
|---|---|---|
| `submitQuote` | `submitQuoteSchema` | bookingId (string, max 128), price (positive number) |
| `acceptQuote` | `acceptQuoteSchema` | bookingId, adminId (strings) |
| `updateBookingStatus` | `updateBookingStatusSchema` | bookingId, action (enum), extraArgs (typed object) |
| `secureLogActivity` | `secureLogActivitySchema` | bookingId, action (string, max 100) |

Unknown fields are stripped automatically (`stripUnknown: true`).

---

## 4. Rate Limiting

### Implementation
Firestore-based sliding-window rate limiter (`functions/security/rateLimiter.js`).

### Limits
| Function | Limit | Window |
|---|---|---|
| `submitQuote` | 10 requests | per minute per user |
| `createBooking` | 5 requests | per hour per user |
| `updateBookingStatus` | 20 requests | per hour per user |
| OTP requests | 3 requests | per hour per phone |
| Login attempts | 5 requests | per hour per phone |
| Default | 30 requests | per minute per user/IP |

### Firestore Collection
Rate limit counters are stored in the `rate_limits` collection with an `expiresAt` field for TTL-based cleanup. Client access to this collection is blocked by Firestore rules.

### Error Response
Clients receive a `resource-exhausted` (HTTP 429) error with a `retryAfter` field in seconds.

---

## 5. OTP Security

### Recommendations (Phase 2)
- Hash OTPs with **bcrypt** before storing.
- Enforce 5-minute expiry on OTP documents.
- Limit verification to 3 attempts per OTP.
- Log failed attempts via `functions/security/audit.js`.

---

## 6. Data Encryption

### Implementation
Field-level **AES-256-CBC** encryption is provided by `functions/security/encryption.js`.

### PII Fields Encrypted
- Phone numbers (users, workers, bookings)
- Email addresses
- Physical addresses

### API
```js
const { encryptFields, decryptFields, USER_PII_FIELDS } = require('./security/encryption');

// Before writing to Firestore
const safeData = await encryptFields(userData, USER_PII_FIELDS);

// After reading from Firestore
const plainData = await decryptFields(firestoreDoc, USER_PII_FIELDS);
```

### Key Management
The encryption key is stored in Google Secret Manager as `field-encryption-key` (32-byte hex string).

To generate a key:
```bash
openssl rand -hex 32
```

---

## 7. Firestore Security Rules

### Enhancements in `firebase.rules`
- **Admin activeness check** — `isAdmin()` now requires `isActive != false`.
- **Worker approval validation** — workers flagged as `isFraud` or `status == suspended` are not client-readable.
- **Field-level protection on admins** — `role`, `parentAdminId`, `probationStatus`, `regionScore`, `fraudCount`, and `isActive` can only be modified by superadmins.
- **Field-level protection on workers** — `isFraud` and `adminId` can only be modified by superadmins.
- **Chat message validation** — messages must have a non-null `text` field (≤ 5000 chars) and a `senderId`.
- **Security logs** — `security_logs` collection is read-only for superadmins; write blocked from clients.
- **Rate limits** — `rate_limits` collection is fully blocked from client access.

---

## 8. Audit Logging

### Implementation
`functions/security/audit.js` writes to the `security_logs` Firestore collection.

### Logged Events
| Event | Trigger |
|---|---|
| `function_invoked` | Every call to `submitQuote`, `acceptQuote`, `updateBookingStatus` |
| `rate_limit_exceeded` | When a rate limit is breached |
| `unauthorized_access` | When a permission check fails |
| `otp_failed` | On OTP verification failure |
| `failed_login` | On login failure |

### Alert Thresholds
If **3 or more** high-severity events occur for the same user within 5 minutes, a warning is logged to Cloud Functions logs. In production, integrate with Cloud Monitoring or PubSub for real-time alerts.

### Querying Security Logs
```js
// Get recent unauthorized access events (superadmin only via Cloud Functions)
const logs = await db.collection('security_logs')
  .where('eventType', '==', 'unauthorized_access')
  .orderBy('timestamp', 'desc')
  .limit(50)
  .get();
```

---

## 9. CORS & Security Headers

Callable Cloud Functions (`onCall`) do not require CORS configuration as they use Firebase's built-in authentication. For HTTP functions, configure CORS whitelisting in the function handler.

---

## 10. Environment Security

### Environment Variables
| Variable | Purpose |
|---|---|
| `REACT_APP_RECAPTCHA_SITE_KEY` | reCAPTCHA v3 site key for App Check |
| `GCLOUD_PROJECT` | Google Cloud project ID (auto-set in Cloud Functions) |

### `.env.example`
```
REACT_APP_RECAPTCHA_SITE_KEY=your_recaptcha_v3_site_key_here
```

**Never commit real credentials to source control.**

---

## 11. Incident Response

### Failed Login Alerts
1. Check `security_logs` for `failed_login` events.
2. If 5+ failures from the same phone/IP in 1 hour, consider temporarily blocking.

### Rate Limit Violations
1. Check `security_logs` for `rate_limit_exceeded` events.
2. Identify the `uid` or `ip` field.
3. If abuse is confirmed, use Firebase Auth to disable the account.

### Suspected Data Breach
1. Immediately rotate all secrets in Google Secret Manager.
2. Revoke Firebase service account keys.
3. Review `security_logs` for `unauthorized_access` events.
4. Notify affected users per your data protection obligations.

---

## Security Score Checklist

- [x] Secrets migrated to Secret Manager
- [x] App Check initialized with reCAPTCHA v3
- [x] All inputs validated with Joi schemas
- [x] Rate limiting on sensitive endpoints
- [x] PII encryption utilities implemented
- [x] Firestore rules blocking unauthorized access
- [x] Security logs capturing all events
- [x] Audit logging on sensitive Cloud Functions
- [x] Field-level write protection on admin/worker documents
- [x] No hardcoded credentials in codebase
