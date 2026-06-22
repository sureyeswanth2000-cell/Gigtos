# Gigtos — Incident Response Plan

> **Version:** 1.0  
> **Last Updated:** 2026-03-04  
> **Scope:** Production Firebase / GCP environment  
> **Owner:** Security & Operations Team  
> **Classification:** Internal — Confidential

---

## 1. Purpose and Scope

This plan defines how the Gigtos team responds to security and operational incidents in the production environment.  
It covers:
- Firestore / Firebase Authentication breaches
- Cloud Functions exploitation
- Data exposure events
- Service availability incidents
- Third-party integration failures (Twilio, Gmail SMTP)

---

## 2. Incident Severity Levels

| Severity | Label | Definition | Max Response Time | Example |
|---|---|---|---|---|
| **P1** | CRITICAL | Production down or confirmed data breach | 15 minutes | Database exposed publicly, Firebase project deleted |
| **P2** | HIGH | Security threat active or significant data at risk | 30 minutes | Credential stuffing, unauthorized admin account |
| **P3** | MEDIUM | Degraded functionality or potential security risk | 2 hours | High auth failure rate, backup failure |
| **P4** | LOW | Minor issue, no immediate risk | 24 hours | Monitoring alert misconfiguration, non-critical function error |

---

## 3. Security Incident Types

### 3.1 Type A — Authentication & Authorization Incidents

| ID | Incident | Indicators | Initial Action |
|---|---|---|---|
| A1 | Brute-force / credential stuffing on admin login | > 10 failed logins/min from same IP | Temporary account lockout; block IP |
| A2 | Compromised admin account | Unusual admin activity, new workers created unexpectedly | Disable account immediately, rotate credentials |
| A3 | Privilege escalation attempt | Firestore rules denial spike on `admins` collection | Review rules; audit `admins` collection for unauthorized documents |
| A4 | Unauthorized OTP enumeration | High rate of `users_by_phone` read attempts | Rate-limit from Firebase App Check; investigate |

### 3.2 Type B — Data Incidents

| ID | Incident | Indicators | Initial Action |
|---|---|---|---|
| B1 | Firestore data exposed publicly | Security rules accidentally set to `allow read, write: if true;` | Redeploy correct rules immediately; audit access logs |
| B2 | PII exfiltration | Abnormal read volume on `users` or `bookings` collections | Restrict read permissions; identify exfiltrating service account |
| B3 | Data corruption / deletion | Bookings or users documents unexpectedly missing | Restore from Firestore backup; investigate write logs |
| B4 | Secrets exposure | API keys or tokens committed to repository | Rotate all secrets immediately; revoke exposed credentials |

### 3.3 Type C — Infrastructure Incidents

| ID | Incident | Indicators | Initial Action |
|---|---|---|---|
| C1 | Cloud Function exploitation | Unusual spikes in invocations; unexpected actions in Firestore | Review function logs; disable function if actively exploited |
| C2 | Service account key compromise | Unexpected GCP API calls from a service account | Revoke key; rotate; audit IAM logs |
| C3 | Hosting defacement | Homepage content modified unexpectedly | Roll back hosting deployment; audit GitHub repository |
| C4 | SMS/email spam via Cloud Functions | Twilio/Gmail cost spike; `onBookingCreated` invoked at abnormal rate | Disable function; add rate limiting; investigate source |

### 3.4 Type D — Availability Incidents

| ID | Incident | Indicators | Initial Action |
|---|---|---|---|
| D1 | Site down | Uptime check failing; users unable to access app | Check Firebase Hosting status; Firebase Status page |
| D2 | Functions cold-start cascade | p99 latency spike; timeouts in booking flow | Scale down concurrent requests temporarily; review memory |
| D3 | Firestore quota exhausted | `RESOURCE_EXHAUSTED` errors in logs | Increase quota via Cloud Console; optimize query usage |
| D4 | Third-party API outage | Twilio or Gmail API errors | Fall back to alternative; notify users of notification delays |

---

## 4. Response Procedures

### 4.1 General Response Workflow

```
DETECT → TRIAGE → CONTAIN → ERADICATE → RECOVER → REVIEW
```

**Step 1 — DETECT**
- Alert fires from Cloud Monitoring, or
- Team member or user reports anomaly

**Step 2 — TRIAGE (< 5 min for P1/P2)**
1. Open an incident record (use template in §6.1)
2. Assign an **Incident Commander (IC)** and **Communications Lead (CL)**
3. Determine severity level (§2)
4. Notify escalation matrix (§5)

**Step 3 — CONTAIN**
- Stop the bleeding: isolate the affected component
- Do not destroy evidence (preserve logs, screenshots, raw data)

**Step 4 — ERADICATE**
- Remove root cause
- Patch, redeploy, rotate credentials as needed

**Step 5 — RECOVER**
- Restore service to normal operation
- Validate with smoke tests (see `DEPLOYMENT_CHECKLIST.md §8`)

**Step 6 — REVIEW**
- Conduct a post-incident review within 48 hours (§8)
- Update runbooks and monitoring rules

---

### 4.2 Procedure: Security Rules Exposure (B1)

**Trigger:** Security rules deployed with `allow read, write: if true;`

```bash
# 1. Immediately redeploy correct rules
git checkout firebase.rules
firebase deploy --only firestore:rules --project=<PROJECT_ID>

# 2. Confirm rules are live
firebase firestore:rules:get --project=<PROJECT_ID>

# 3. Audit who accessed data during the window
# In GCP Log Explorer:
# protoPayload.serviceName="firestore.googleapis.com"
# timestamp >= "INCIDENT_START_TIME"
# timestamp <= "INCIDENT_END_TIME"

# 4. Identify affected collections and records
# Check read_count spike on monitoring dashboard

# 5. Notify affected users if PII was accessed (see §6.3)
```

**Containment time target:** < 10 minutes  
**Owner:** On-call engineer

---

### 4.3 Procedure: Compromised Admin Account (A2)

**Trigger:** Alert or report of suspicious admin activity

```bash
# 1. Immediately disable the compromised admin account
# Via Firebase Console → Authentication → find user → Disable

# 2. OR programmatically:
# firebase-admin SDK in a one-off script:
# admin.auth().updateUser(uid, { disabled: true })

# 3. Revoke all active sessions
# Firebase Console → Authentication → user → Revoke tokens

# 4. Audit all actions taken by the compromised account (last 7 days)
# Log Explorer:
# protoPayload.authenticationInfo.principalEmail="<ADMIN_EMAIL>"
# timestamp >= "now-7d"

# 5. Review bookings/workers created or modified by this admin
# Firestore Console → bookings → filter adminId = <COMPROMISED_UID>

# 6. Reset admin credentials through secure out-of-band channel

# 7. Notify affected users if their data was accessed or modified
```

**Containment time target:** < 15 minutes  
**Owner:** Senior engineer + Incident Commander

---

### 4.4 Procedure: Secrets Exposure (B4)

**Trigger:** API key or token found in GitHub commit, public paste, or log

```bash
# 1. Immediately rotate ALL potentially exposed secrets
# Gmail: Revoke app password in Google Account Security settings
#        Create new app password
#        Update in Secret Manager:
gcloud secrets versions add gigtos-gmail-pass \
  --data-file=- --project=<PROJECT_ID> <<< "NEW_PASSWORD"

# Twilio: Rotate token in Twilio Console
#         Update in Secret Manager:
gcloud secrets versions add gigtos-twilio-token \
  --data-file=- --project=<PROJECT_ID> <<< "NEW_TOKEN"

# Firebase Admin SDK key:
gcloud iam service-accounts keys delete <KEY_ID> \
  --iam-account=<SA_EMAIL> --project=<PROJECT_ID>
# Generate new key only if absolutely necessary

# 2. Disable previous secret version
gcloud secrets versions disable <OLD_VERSION> \
  --secret=gigtos-gmail-pass --project=<PROJECT_ID>

# 3. Redeploy functions to pick up new secrets
firebase deploy --only functions --project=<PROJECT_ID>

# 4. Remove the secret from git history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch <FILE_WITH_SECRET>" \
  --prune-empty --tag-name-filter cat -- --all
git push origin --force --all

# 5. Report to GitHub for secret scanning revocation
# GitHub → Repository → Security → Secret scanning alerts
```

**Containment time target:** < 30 minutes  
**Owner:** Incident Commander

---

### 4.5 Procedure: Service Availability Incident (D1 / D2)

**Trigger:** Uptime alert fires; users report inability to access app

```bash
# 1. Check Firebase Status page
open https://status.firebase.google.com

# 2. Check Cloud Functions logs for errors
gcloud functions logs read --limit=50 --project=<PROJECT_ID>

# 3. If hosting is the issue, roll back to previous deployment
firebase hosting:clone <PROJECT_ID>:live <PROJECT_ID>:prev  # if using channels

# 4. If functions are crashing, identify the bad deployment
firebase functions:list --project=<PROJECT_ID>
# Roll back by redeploying previous known-good tag:
git checkout v<LAST_GOOD_VERSION>
firebase deploy --only functions --project=<PROJECT_ID>

# 5. Communicate status to users (see §6.2)
```

**Recovery time objective (RTO):** 2 hours  
**Recovery point objective (RPO):** 24 hours (daily backup schedule)

---

## 5. Escalation Matrix

### 5.1 Team Contacts

> **Note:** Replace placeholder names and contact details with actual team information before production deployment.

| Role | Name | Email | Phone (WhatsApp) | Escalate When |
|---|---|---|---|---|
| **On-Call Engineer** | (Assign per rota) | oncall@yourdomain.com | +91-XXXXXXXXXX | First responder for all alerts |
| **Incident Commander** | Senior Engineer | ic@yourdomain.com | +91-XXXXXXXXXX | P1 / P2 incidents |
| **Security Lead** | Security Engineer | security@yourdomain.com | +91-XXXXXXXXXX | Any security incident (Type A, B, C) |
| **Communications Lead** | Product / Operations | comms@yourdomain.com | +91-XXXXXXXXXX | User-facing communication needed |
| **Engineering Lead** | Tech Lead | tech@yourdomain.com | +91-XXXXXXXXXX | P1 incidents, major data loss |
| **Executive Sponsor** | Founder / CTO | exec@yourdomain.com | +91-XXXXXXXXXX | P1 incidents requiring business decision |

### 5.2 Escalation Path

```
Alert fires
    │
    ▼
On-Call Engineer (0–5 min)
    │ Not resolved in 15 min (P1) / 30 min (P2)
    ▼
Incident Commander + Security Lead notified
    │ Not resolved in 45 min (P1) / 90 min (P2)
    ▼
Engineering Lead joins bridge call
    │ External parties affected / legal / media
    ▼
Executive Sponsor
```

### 5.3 External Escalation

| Party | Contact | When |
|---|---|---|
| Firebase / GCP Support | console.cloud.google.com → Support | Firebase / GCP infrastructure issue |
| Twilio Support | help.twilio.com | SMS delivery failures affecting > 10 users |
| GitHub Security | security@github.com | Secrets exposed in public repository |
| CERT-In (India) | incident@cert-in.org.in | Confirmed data breach affecting Indian users |

---

## 6. Communication Templates

### 6.1 Incident Record Template

```markdown
## Incident Record — INC-YYYY-MM-DD-NNN

**Status:** OPEN / CONTAINED / RESOLVED
**Severity:** P1 / P2 / P3 / P4
**Type:** (e.g., B1 — Data Exposure)
**Detected At:** YYYY-MM-DD HH:MM IST
**Declared At:** YYYY-MM-DD HH:MM IST
**Resolved At:** (to be filled)

**Incident Commander:** 
**Communications Lead:**
**Responders:**

### Summary
(One-paragraph description of what happened)

### Impact
- Users affected: (number / none confirmed)
- Data affected: (collections, number of documents)
- Service degradation: (yes/no, description)

### Timeline
| Time (IST) | Event |
|---|---|
| HH:MM | Alert fired / anomaly detected |
| HH:MM | Incident declared |
| HH:MM | Containment action taken |
| HH:MM | Root cause identified |
| HH:MM | Service restored |

### Actions Taken
1. 
2. 

### Root Cause
(To be filled during/after resolution)

### Follow-up Tasks
- [ ] 
- [ ] 
```

### 6.2 User-Facing Status Update Template

**For planned maintenance:**
> We will be performing scheduled maintenance on [DATE] from [TIME] to [TIME] IST.  
> During this window, the Gigtos app may be temporarily unavailable.  
> We apologize for any inconvenience.

**For unplanned downtime:**
> We are aware of an issue currently affecting the Gigtos app.  
> Our team is actively investigating and working to restore service.  
> We will post an update within [30/60] minutes.  
> We apologize for the disruption.

**For data incident (if user notification is required):**
> Dear [Name],  
> We are writing to inform you of a security incident that may have affected your account.  
> On [DATE], we identified [brief description — avoid technical jargon].  
> The following information may have been accessed: [list].  
> We have already [actions taken to contain].  
> As a precaution, we recommend [user action — e.g., change password].  
> We take your security seriously. If you have questions, contact us at [support email].

### 6.3 Internal Incident Bridge Call Agenda

1. **Roll call** — confirm who is on the call (5 min)
2. **Situation update** — Incident Commander summarizes current state (5 min)
3. **Impact assessment** — what is affected, how many users (5 min)
4. **Action plan** — who is doing what, by when (10 min)
5. **Communication decision** — do users need to be notified? (5 min)
6. **Next check-in** — agree on next bridge call time

---

## 7. Recovery Steps

### 7.1 Firestore Data Recovery from Backup

```bash
# 1. Identify the correct backup timestamp
gsutil ls gs://${PROJECT_ID}-firestore-backups/daily/ | sort

# 2. Restore to staging first to verify data integrity
gcloud firestore import gs://${PROJECT_ID}-firestore-backups/daily/<TIMESTAMP>/ \
  --project=<STAGING_PROJECT_ID>

# 3. Validate restored data in staging
# Check document counts, spot-check critical records

# 4. If staging validation passes, restore to production
# WARNING: This OVERWRITES existing production data
gcloud firestore import gs://${PROJECT_ID}-firestore-backups/daily/<TIMESTAMP>/ \
  --project=<PRODUCTION_PROJECT_ID>
```

**Important:** Partial collection restore (e.g., only `bookings`) is not natively supported by Firestore import. For partial recovery, export specific documents manually and use a migration script.

### 7.2 Cloud Functions Rollback

```bash
# List deployed function versions (GCP Console → Cloud Functions → select function → Revisions)

# Roll back by redeploying from the last known-good Git tag
git fetch --tags
git checkout v<LAST_GOOD_VERSION>
firebase deploy --only functions --project=<PROJECT_ID>

# Verify smoke test
curl -X POST https://<REGION>-<PROJECT_ID>.cloudfunctions.net/secureUpdateBookingStatus \
  -H "Authorization: Bearer <TEST_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"data": {"bookingId": "test123", "newStatus": "in_progress"}}'
```

### 7.3 Firebase Hosting Rollback

```bash
# List recent deployments
firebase hosting:releases:list --project=<PROJECT_ID>

# Roll back to previous release
firebase hosting:rollback --project=<PROJECT_ID>
```

### 7.4 Service Account Key Revocation and Replacement

```bash
# List active keys
gcloud iam service-accounts keys list \
  --iam-account=<SA_EMAIL> --project=<PROJECT_ID>

# Revoke compromised key
gcloud iam service-accounts keys delete <KEY_ID> \
  --iam-account=<SA_EMAIL> --project=<PROJECT_ID>

# Prefer Workload Identity over new key creation
# If a key is absolutely necessary:
gcloud iam service-accounts keys create new-key.json \
  --iam-account=<SA_EMAIL> --project=<PROJECT_ID>
# Store in Secret Manager immediately, delete local file
gcloud secrets versions add gigtos-firebase-admin-key \
  --data-file=new-key.json --project=<PROJECT_ID>
rm -f new-key.json
```

---

## 8. Post-Incident Review

### 8.1 When to Hold a Review

| Severity | Review Required | Timeline |
|---|---|---|
| P1 | Mandatory | Within 24 hours of resolution |
| P2 | Mandatory | Within 48 hours of resolution |
| P3 | Recommended | Within 1 week |
| P4 | Optional | At team's discretion |

### 8.2 Review Agenda (60 minutes)

1. **Timeline walk-through** (15 min) — chronological facts, no blame
2. **Root cause analysis** (15 min) — use the 5-Whys technique
3. **What went well** (10 min)
4. **What could be improved** (10 min)
5. **Action items** (10 min) — specific, owner-assigned, time-boxed

### 8.3 Post-Incident Report Template

```markdown
## Post-Incident Report — INC-YYYY-MM-DD-NNN

**Incident:** (brief title)
**Severity:** P_
**Duration:** X hours Y minutes
**Author:** 
**Review Date:**

### Executive Summary
(2–3 sentences: what happened, impact, resolution)

### Root Cause
(Describe the fundamental cause using 5-Whys)

### What Went Well
- 
- 

### What Could Be Improved
- 
- 

### Action Items
| Item | Owner | Due Date | Status |
|---|---|---|---|
| | | | |

### Metrics
- Time to Detect (TTD): 
- Time to Respond (TTR): 
- Time to Resolve (TTRes): 
- Users Impacted: 
```

---

## 9. Compliance and Legal

### 9.1 Data Breach Notification

Under India's **Information Technology Act, 2000 (Section 43A)** and the upcoming **Digital Personal Data Protection Act, 2023**:
- Affected users must be notified **without undue delay**
- CERT-In notification required within **6 hours** of confirmation of significant incidents
- Maintain a written record of the breach, actions taken, and notifications sent

### 9.2 Evidence Preservation

Before making any system changes during an incident:
1. Export relevant Firestore documents to GCS
2. Download relevant Cloud Logging entries
3. Screenshot monitoring dashboards
4. Record all commands run during investigation

```bash
# Preserve logs for the incident window
gcloud logging read \
  'timestamp >= "INCIDENT_START" AND timestamp <= "INCIDENT_END"' \
  --project=<PROJECT_ID> \
  --format=json > /tmp/incident-$(date +%Y%m%d)-logs.json

gsutil cp /tmp/incident-$(date +%Y%m%d)-logs.json \
  gs://${PROJECT_ID}-audit-logs/incidents/
```
