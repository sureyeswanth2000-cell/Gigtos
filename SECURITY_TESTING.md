# SECURITY_TESTING.md — Gigtos Security Testing Guide

## Overview

This guide describes how to test the security features of the Gigtos platform.

---

## 1. Rate Limiting Tests

### Manual Test (curl / Postman)

Send more than the allowed number of requests in the time window and verify a `429` response with `retryAfterMs` in the error details.

```bash
# Call submitQuote more than 10 times in 1 minute to trigger rate limiting
for i in {1..12}; do
  curl -X POST https://us-central1-gigto-c0c83.cloudfunctions.net/submitQuote \
    -H "Content-Type: application/json" \
    -d '{"data": {"bookingId": "test123", "price": 500}}' \
    -H "Authorization: Bearer <YOUR_ID_TOKEN>"
  echo "Request $i"
done
```

Expected: Requests 11+ return HTTP 429 with error code `resource-exhausted`.

---

## 2. Input Validation Tests

### Malicious Inputs (XSS)

```javascript
// These should all be rejected or sanitised
const maliciousInputs = [
  { bookingId: "<script>alert(1)</script>", price: 100 },
  { bookingId: "'; DROP TABLE bookings; --", price: 100 },
  { bookingId: "valid-id", price: -999 },
  { bookingId: "valid-id", price: "abc" },
  { bookingId: "", price: 100 },
];
```

Expected: Each call should throw `invalid-argument` with a descriptive message.

### Phone Number Validation

```javascript
const invalidPhones = ["not-a-phone", "123", "+1", "abcdefghij"];
// Each should fail otpRequestSchema validation
```

---

## 3. OTP Security Tests

### Expiry Test

1. Request an OTP.
2. Wait 6 minutes.
3. Attempt to verify — expect `deadline-exceeded` error.

### Lockout Test

1. Request an OTP.
2. Attempt verification 3 times with wrong OTP.
3. 4th attempt should return `resource-exhausted` with lockout message.
4. Wait 15 minutes and verify lockout is lifted.

### No Plaintext Storage Check

After calling `generateOtp`, inspect the `otp_records` Firestore document. Verify:
- The `hash` field starts with `$2b$` (bcrypt prefix).
- There is no `otp` or `plaintext` field.

---

## 4. Encryption Tests

### Verify PII is Encrypted at Rest

1. Create a booking or user via the app.
2. Read the Firestore document directly from the Firebase Console.
3. Verify that `phone`, `email`, `userAddress` fields contain the encrypted token format: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`.

### Key Rotation Test

1. Change the `ENCRYPTION_KEY` environment variable.
2. Attempt to decrypt old values — verify graceful failure (field left as-is).
3. Re-encrypt old values with the new key to complete rotation.

---

## 5. Firestore Rules Tests

Use the Firebase Emulator Suite to run rules tests:

```bash
cd /path/to/gigtos
firebase emulators:start --only firestore
```

### Test Cases

```javascript
// Test: Unauthenticated user cannot read bookings
// Test: User can only read their own booking
// Test: Admin with isActive: false cannot create workers
// Test: Non-superadmin cannot approve a worker (change approvalStatus)
// Test: Client cannot write to security_logs
// Test: Client cannot write to rate_limits
// Test: Client cannot write to otp_records
```

---

## 6. Security Headers Tests

Use [securityheaders.com](https://securityheaders.com) or curl to verify headers on the deployed hosting URL:

```bash
curl -I https://gigto-c0c83.web.app | grep -E "Strict-Transport|X-Frame|X-Content|Content-Security|Referrer"
```

Expected headers should all be present with correct values.

---

## 7. App Check Tests

1. Deploy the app without `REACT_APP_RECAPTCHA_SITE_KEY` set.
2. Call a protected function — expect the call to fail with `unauthenticated` or App Check error.
3. Set the key and verify calls succeed.

---

## 8. Authorization Bypass Tests

Attempt the following with a valid user token (non-admin):

```bash
# Try to call submitQuote as a regular user (should fail with permission-denied)
# Try to accept another user's quote (should fail with permission-denied)
# Try to update a booking that doesn't belong to you (should fail)
# Try to read another user's booking (should fail)
```

---

## Unit Tests

Run the existing test suite:

```bash
cd react-app && npm test
```

For Cloud Functions unit tests (if added):

```bash
cd functions && npm test
```

---

## Load Testing Rate Limits

Use Apache Bench or k6 to stress-test rate limiting:

```bash
# Install k6: https://k6.io/docs/getting-started/installation/
k6 run --vus 20 --duration 30s load-test.js
```

Verify that responses beyond the limit return 429 and that counters reset after the window expires.
