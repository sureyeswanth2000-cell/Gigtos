# INCIDENT_RESPONSE.md — Gigtos Incident Response Procedures

## Purpose

This document describes the procedures to follow when a security incident is detected on the Gigtos platform.

---

## Incident Severity Levels

| Level    | Description                                                                      | Response Time |
|----------|----------------------------------------------------------------------------------|---------------|
| Critical | Active data breach, credential compromise, ransomware, service outage           | 1 hour        |
| High     | Suspected unauthorised access, mass rate limit violations, OTP brute force      | 4 hours       |
| Medium   | Single rule violation, suspicious query pattern, repeated auth failures         | 24 hours      |
| Low      | Policy violation, misconfiguration with no data exposure                        | 72 hours      |

---

## Detection Sources

- **`security_logs` Firestore collection** — Review for `authorization_failure`, `rate_limit_violation`, `otp_lockout` events.
- **Cloud Monitoring alerts** — Configured on the Cloud Functions error rate and authentication failures.
- **Firebase Console → Authentication** — Monitor for unusual login patterns.
- **User reports** — Support email or in-app feedback.

---

## Response Playbooks

### P1: Credential Compromise (Gmail / Twilio / Encryption Key)

1. **Immediately rotate** the compromised secret in Google Secret Manager.
2. Deploy a new Cloud Functions revision to invalidate the in-memory cache.
3. Verify no outbound emails/SMS were sent without authorisation by reviewing transporter logs.
4. If the encryption key is compromised: rotate the key, re-encrypt all PII fields in affected collections.
5. Notify affected users if PII may have been exposed.
6. File a post-mortem within 48 hours.

### P2: Unauthorised Data Access

1. Identify the actor UID from `security_logs` (`authorization_failure` events).
2. Disable the Firebase Auth account: Firebase Console → Authentication → Users → Disable.
3. If admin account: set `isActive: false` in the `admins` Firestore document to immediately block further access (enforced by security rules).
4. Review all `activity_logs` and `security_logs` written by that UID for the past 30 days.
5. Assess scope of data access (which bookings, users, workers were read/modified).
6. Notify affected parties as appropriate.

### P3: OTP Brute Force / Lockout Abuse

1. Identify the phone number(s) from `security_logs` (`otp_lockout` events).
2. The 15-minute lockout is automatically enforced by `otpManager.js`.
3. For persistent attacks: manually delete the `otp_records/{phone}` document to reset, or extend the lockout duration.
4. Consider blocking the phone number at the application level.
5. Review `rate_limits` documents to identify IP patterns if available.

### P4: Rate Limit Violation Surge

1. Check `rate_limits` collection for documents with very high `count` values.
2. Identify the `action:identifier` pattern causing the surge.
3. If attack is ongoing: manually set `lockedUntil` to a far-future timestamp on the offending documents.
4. Review authentication tokens to determine if accounts are compromised.
5. Consider temporarily tightening rate limits in `rateLimiter.js` and redeploying.

### P5: XSS / Injection Attempt Detected

1. Identify the endpoint and input from function logs (`console.error` from validation).
2. Verify the Joi schema blocked the input (check that an `invalid-argument` error was returned).
3. Confirm no malicious data was persisted to Firestore.
4. Review DOMPurify sanitisation on the frontend for the corresponding input field.
5. Update validation schemas if a new attack vector is identified.

---

## Post-Incident Actions

1. **Document** the incident timeline, impact, and root cause.
2. **Patch** any vulnerabilities that were exploited.
3. **Update** this playbook if new scenarios are identified.
4. **Review** and tighten Firestore security rules and rate limits if needed.
5. **Notify** users if personal data was accessed or modified without authorisation (legal obligation).

---

## Contacts

| Role               | Contact Method          |
|--------------------|-------------------------|
| Project Maintainer | GitHub repository owner |
| GCP Console        | Google Cloud Console    |
| Firebase Console   | Firebase Console        |

---

## Log Retention

| Collection       | Recommended Retention |
|------------------|-----------------------|
| `security_logs`  | 90 days               |
| `activity_logs`  | 1 year                |
| `rate_limits`    | 7 days (TTL cleanup)  |
| `otp_records`    | 1 hour (TTL cleanup)  |

Configure Firestore TTL policies for automatic cleanup to comply with data minimisation principles.
