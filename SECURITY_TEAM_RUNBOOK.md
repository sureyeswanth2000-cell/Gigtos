# Gigtos — Security Team Runbook

> **Version:** 1.0  
> **Last Updated:** 2026-03-04  
> **Scope:** Production Firebase / GCP environment  
> **Owner:** Security & Operations Team  
> **Classification:** Internal — Confidential

---

## Overview

This runbook defines the recurring security tasks for the Gigtos platform.  
All tasks should be recorded in the team's issue tracker or operations log with completion date and the engineer's name.

---

## 1. Daily Security Checks

Perform every working day (Mon–Sat). Estimated time: **30 minutes**.

### 1.1 Monitoring Dashboard Review
- [ ] Open **GCP Console → Monitoring → Dashboards → Gigtos Production Overview**
- [ ] Verify no active firing alerts
- [ ] Review the past 24 hours of:
  - Cloud Function error rate (target: < 1%)
  - Auth failure count (target: < 5/day under normal conditions)
  - Firestore rule denial count (note any spike vs. the previous day)
  - Site uptime (target: 99.9%)

```bash
# Check for any active alert policies in a fired state
gcloud alpha monitoring incidents list \
  --filter="state=OPEN" \
  --project=<PROJECT_ID>
```

### 1.2 Cloud Function Health Check
- [ ] Open **GCP Console → Cloud Functions** and verify all functions show a green (✓) status
- [ ] Spot-check function logs for unexpected errors:
  ```bash
  # Last 200 log entries, errors only
  gcloud functions logs read \
    --severity=ERROR \
    --limit=200 \
    --project=<PROJECT_ID>
  ```
- [ ] Confirm `onBookingCreated` and `onBookingStatusChange` invocations are proportional to expected booking volume

### 1.3 Authentication Anomaly Check
- [ ] Open **Firebase Console → Authentication → Users**
- [ ] Note total user count; flag if > 10% increase since yesterday
- [ ] Review recently created admin accounts:
  ```bash
  # In GCP Log Explorer:
  # protoPayload.methodName="google.firestore.v1.Firestore.Commit"
  # AND protoPayload.request.writes.currentDocument.exists=false
  # AND resource.labels.collection_id="admins"
  # timestamp >= "now-24h"
  ```
- [ ] Verify no new admin accounts were created outside of an approved provisioning request

### 1.4 Backup Status Verification
- [ ] Confirm the previous night's Firestore backup completed:
  ```bash
  gsutil ls -l gs://${PROJECT_ID}-firestore-backups/daily/ | tail -5
  ```
- [ ] Verify the most recent export directory is < 25 hours old
- [ ] If backup is missing, trigger a manual export and open a P3 incident

### 1.5 Secret Manager Health
- [ ] Confirm all secrets have at least one enabled version:
  ```bash
  for SECRET in gigtos-gmail-user gigtos-gmail-pass gigtos-twilio-sid gigtos-twilio-token gigtos-twilio-phone; do
    echo "=== $SECRET ==="
    gcloud secrets versions list $SECRET \
      --filter="state=ENABLED" --project=<PROJECT_ID> | head -3
  done
  ```
- [ ] Flag any secret where the active version is older than 90 days

---

## 2. Weekly Security Reviews

Perform every Monday. Estimated time: **90 minutes**.

### 2.1 Firestore Security Rules Audit
- [ ] Review `firebase.rules` diff against last week's version (use `git log --oneline -5 firebase.rules`)
- [ ] Confirm no `allow read, write: if true;` or unrestricted rules have been introduced
- [ ] Run the Firebase Rules Playground with test cases:
  1. Attempt to read another user's `users/{userId}` document — should be **DENIED**
  2. Attempt to delete a booking — should be **DENIED**
  3. Attempt to create a cashback from the client — should be **DENIED**
  4. Attempt to create an activity log from the client — should be **DENIED**
- [ ] Review any Firestore rule denial alerts from the past week
  ```
  Log Explorer filter:
  protoPayload.status.code=7
  protoPayload.serviceName="firestore.googleapis.com"
  timestamp >= "now-7d"
  ```

### 2.2 IAM and Service Account Review
- [ ] List all project-level IAM bindings and verify no unexpected members:
  ```bash
  gcloud projects get-iam-policy <PROJECT_ID> --format=table
  ```
- [ ] Check for service account key age (flag keys > 90 days old):
  ```bash
  gcloud iam service-accounts list --project=<PROJECT_ID> --format="value(email)" | \
    while read SA; do
      echo "--- $SA ---"
      gcloud iam service-accounts keys list --iam-account=$SA --project=<PROJECT_ID>
    done
  ```
- [ ] Verify the CI/CD service account only has `roles/firebase.developAdmin` and `roles/cloudfunctions.developer`

### 2.3 Dependency Vulnerability Scan
```bash
# Functions dependencies
cd /path/to/Gigtos/functions
npm audit --audit-level=moderate 2>&1 | tee /tmp/functions-audit-$(date +%Y%m%d).txt

# React app dependencies
cd /path/to/Gigtos/react-app
npm audit --audit-level=moderate 2>&1 | tee /tmp/react-audit-$(date +%Y%m%d).txt
```
- [ ] Review output; open a ticket for any `high` or `critical` vulnerabilities
- [ ] Apply `npm audit fix` for safe, non-breaking fixes and deploy if clean

### 2.4 Cloud Monitoring Alert Review
- [ ] Confirm all alert policies are still active (not accidentally disabled)
  ```bash
  gcloud alpha monitoring policies list --project=<PROJECT_ID> \
    --format="table(displayName, enabled)"
  ```
- [ ] Review alert firing history for the week; tune thresholds if too noisy or too silent

### 2.5 Admin Account Inventory
- [ ] Pull current list of admin accounts from Firestore:
  ```bash
  # In Firebase Console → Firestore → admins collection
  # Verify: expected count, expected roles, no stale/departed users
  ```
- [ ] Disable any admin accounts belonging to people who have left the team
- [ ] Confirm all active admins have completed required security training

---

## 3. Monthly Security Audits

Perform on the first working day of each month. Estimated time: **3 hours**.

### 3.1 Access Review (Least-Privilege Audit)
- [ ] For every admin account in Firestore `admins` collection:
  - Is this person still with the team?
  - Is their role (admin / superadmin) still appropriate?
  - Have they logged in within the past 30 days? (Check Firebase Auth last sign-in)
- [ ] For every GCP service account:
  - Is it still in use?
  - Do its IAM roles still match its current function?
  - Are all its keys < 90 days old?
- [ ] Action: disable unused accounts, downgrade over-privileged accounts

### 3.2 Firestore Data Audit
- [ ] Review document count trends for key collections:
  ```
  bookings — expected growth rate: ~X/day
  users — expected growth rate: ~X/day
  gig_workers — expected count: ~X
  admins — expected count: ~X (static)
  cashbacks — expected count: ~X
  ```
- [ ] Investigate any collection that grew or shrank unexpectedly
- [ ] Run a spot-check: select 5 random `bookings` documents and verify:
  - `userId` matches an existing `users` document
  - `adminId` (if set) matches an existing `admins` document
  - `status` is a valid enum value

### 3.3 Backup Restore Test
- [ ] Select a backup from the past week
- [ ] Restore it to the **staging** Firebase project
- [ ] Verify document counts match the production snapshot
- [ ] Verify a sample of critical documents (`bookings`, `users`) for data integrity
- [ ] Record result in the operations log

### 3.4 Secret Rotation Check
- [ ] Review the age of all active secret versions:
  ```bash
  for SECRET in gigtos-gmail-user gigtos-gmail-pass gigtos-twilio-sid gigtos-twilio-token gigtos-twilio-phone; do
    CREATED=$(gcloud secrets versions describe latest \
      --secret=$SECRET --project=<PROJECT_ID> \
      --format="value(createTime)")
    echo "$SECRET — created: $CREATED"
  done
  ```
- [ ] Rotate any secret older than 90 days (see `ENVIRONMENT_SETUP.sh` for rotation procedure)
- [ ] After rotation, redeploy functions and verify smoke test passes

### 3.5 Cost and Quota Review
- [ ] Review GCP billing dashboard for unexpected spikes
- [ ] Check Firebase usage (Cloud Functions invocations, Firestore reads/writes, Hosting bandwidth)
- [ ] Ensure monthly usage is within budget; flag anomalies
- [ ] Review Cloud Scheduler job execution history:
  ```bash
  gcloud scheduler jobs describe gigtos-firestore-daily-backup --project=<PROJECT_ID>
  ```

### 3.6 Security Configuration Drift Check
- [ ] Re-verify Firebase Authentication → Authorized Domains: only production domain present
- [ ] Re-verify Firebase App Check is enabled for all apps
- [ ] Re-verify Firestore is NOT in test mode
- [ ] Re-verify all Cloud Functions have explicit memory and timeout limits set
- [ ] Check for new Firebase / GCP security advisories relevant to the stack

---

## 4. Quarterly Security Assessments

Perform at the start of each quarter (January, April, July, October). Estimated time: **1–2 days**.

### 4.1 Threat Model Review
- [ ] Review the current threat model for the Gigtos platform:
  - Who are the potential threat actors? (disgruntled ex-admins, competitors, automated bots)
  - What data is most valuable to protect? (user PII, booking data, financial records)
  - Has the attack surface changed since the last review? (new features, new integrations)
- [ ] Update the threat model document based on new features developed this quarter
- [ ] Prioritize any new controls needed

### 4.2 Firebase App Check Review
- [ ] Verify App Check enforcement is active (not just monitoring mode)
  - Firebase Console → App Check → Apps → Verify status is **Enforced**
- [ ] Review App Check metrics: number of requests verified vs. unverified
- [ ] Confirm no legitimate traffic is being blocked

### 4.3 Rate Limiting Review
- [ ] Review Cloud Functions for rate limiting implementation:
  - `onBookingCreated` — does it prevent a single user from spamming bookings?
  - `secureUpdateBookingStatus` — does it prevent rapid state changes?
- [ ] Review Firestore security rules for any missing rate-limit-style constraints
- [ ] Test from the React app with a simulated high-frequency request; verify eventual rejection

### 4.4 Third-Party Integration Security Review
| Integration | Check | Result |
|---|---|---|
| Gmail SMTP | App Password still valid; no suspicious login activity on Google Account | |
| Twilio | Token not expired; no unauthorized sub-accounts created | |
| GCP | All APIs enabled are still required; no unauthorized APIs enabled | |
| GitHub | Repo access list up to date; no stale collaborators | |

### 4.5 Compliance Checklist (India IT Act / DPDPA)

| Requirement | Status | Notes |
|---|---|---|
| User consent obtained for data collection | | |
| Privacy policy published and up to date | | |
| User PII stored only in Firestore (no unencrypted exports) | | |
| Users can request data deletion (process defined) | | |
| Data processing agreements with sub-processors (Twilio, Google) | | |
| Breach notification procedure documented and tested | | |
| Employee access to PII is logged and auditable | | |

### 4.6 Dependency Major Version Review
- [ ] Review Firebase SDK versions in use (web, Admin):
  ```bash
  grep '"firebase"' react-app/package.json functions/package.json
  ```
- [ ] Check for major version upgrades that include security improvements
- [ ] Plan upgrade if current version is > 1 major version behind latest

---

## 5. Annual Security Activities

Perform once per year (aligned with financial year or anniversary of go-live).

### 5.1 External Penetration Test
- [ ] Engage a qualified penetration testing firm
- [ ] Scope to include:
  - Web application (React app) — OWASP Top 10
  - Firebase API endpoints (Authentication, Firestore, Cloud Functions)
  - GCP IAM configuration review
  - Secret management review
- [ ] Review pentest report findings
- [ ] Remediate all critical and high findings within 30 days
- [ ] Remediate all medium findings within 90 days
- [ ] Retain pentest report for compliance records

### 5.2 Full DR (Disaster Recovery) Exercise
- [ ] Simulate a complete production environment loss
- [ ] Restore from the most recent backup to a fresh Firebase project
- [ ] Verify the application functions correctly after restore
- [ ] Measure actual RTO and RPO vs. targets (RTO: 2 h, RPO: 24 h)
- [ ] Document gaps and improve the recovery procedure

### 5.3 Security Policy Review
- [ ] Review and update this runbook
- [ ] Review and update `INCIDENT_RESPONSE_PLAN.md`
- [ ] Review and update `DEPLOYMENT_CHECKLIST.md`
- [ ] Review and update `MONITORING_SETUP.md`
- [ ] Conduct security awareness training for all team members

### 5.4 Archive and Rotate
- [ ] Archive all incidents from the past year
- [ ] Review and purge Firestore data per retention policy
- [ ] Rotate all long-lived service account keys
- [ ] Review and renew third-party contracts (Twilio, any paid services)

---

## 6. Compliance Tracking

### 6.1 Compliance Calendar

| Month | Activity | Owner | Status |
|---|---|---|---|
| Jan | Q1 Quarterly Assessment | Security Lead | |
| Jan | Annual Pentest kickoff | Security Lead | |
| Feb | Pentest report review | Engineering Lead | |
| Mar | Pentest remediation deadline (critical/high) | Dev Team | |
| Apr | Q2 Quarterly Assessment | Security Lead | |
| Jul | Q3 Quarterly Assessment | Security Lead | |
| Oct | Q4 Quarterly Assessment | Security Lead | |
| Oct | Annual DR Exercise | Operations | |
| Nov | Annual Security Policy Review | Security Lead | |
| Dec | Year-end compliance audit | Security Lead | |

### 6.2 Evidence Collection for Audits

Maintain an evidence folder (e.g., in a secured Google Drive or GCS bucket) with:
- Monthly backup restore test results
- Quarterly IAM review exports
- Vulnerability scan outputs
- Pentest reports
- Training completion records
- Incident records

```bash
# Example: export IAM policy for evidence
gcloud projects get-iam-policy <PROJECT_ID> \
  --format=json > /tmp/iam-policy-$(date +%Y%m).json

gsutil cp /tmp/iam-policy-$(date +%Y%m).json \
  gs://${PROJECT_ID}-audit-logs/compliance/iam-reviews/
```

### 6.3 Key Metrics to Track (Year-over-Year)

| Metric | Target | Q1 | Q2 | Q3 | Q4 |
|---|---|---|---|---|---|
| Mean Time to Detect (MTTD) | < 15 min | | | | |
| Mean Time to Respond (MTTR) | < 30 min | | | | |
| Mean Time to Resolve (MTTRes) | < 2 h (P1) | | | | |
| P1 / P2 incidents per quarter | < 2 | | | | |
| Critical CVEs unpatched > 30 days | 0 | | | | |
| Backup success rate | 100% | | | | |
| Unauthorized access incidents | 0 | | | | |

---

## 7. Quick Reference

### Common Commands

```bash
# Check all alerts firing
gcloud alpha monitoring incidents list --filter="state=OPEN" --project=<PROJECT_ID>

# View recent Cloud Function errors
gcloud functions logs read --severity=ERROR --limit=100 --project=<PROJECT_ID>

# List all admin users in Firestore (via CLI)
gcloud firestore export gs://${PROJECT_ID}-firestore-backups/manual/ \
  --collection-ids=admins --project=<PROJECT_ID>

# Disable a Firebase user
# (Use firebase-admin in a Node.js script or Firebase Console)

# Rotate a secret
gcloud secrets versions add <SECRET_NAME> \
  --data-file=- --project=<PROJECT_ID> <<< "NEW_VALUE"

# Check backup bucket contents
gsutil ls -l gs://${PROJECT_ID}-firestore-backups/daily/ | sort | tail -10

# Trigger manual backup
gcloud firestore export \
  gs://${PROJECT_ID}-firestore-backups/manual/$(date +%Y%m%d-%H%M%S) \
  --project=<PROJECT_ID>
```

### Security Contact Summary

| Contact | For |
|---|---|
| oncall@yourdomain.com | All production alerts |
| security@yourdomain.com | Security incidents |
| Firebase Support | Firebase / GCP infrastructure |
| incident@cert-in.org.in | Data breaches (government notification) |
