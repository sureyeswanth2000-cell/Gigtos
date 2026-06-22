# Gigtos — Production Deployment Checklist

> **Version:** 1.0  
> **Last Updated:** 2026-03-04  
> **Scope:** Firebase (Firestore, Auth, Functions, Hosting), GCP Secret Manager  
> **Owner:** Operations / Security Team

---

## How to Use This Checklist

Work through each section **top-to-bottom** before every production deployment.  
Mark each item ✅ when verified. If an item fails, open a blocking issue and halt the deployment until it is resolved.

---

## 1. Pre-Deployment Security Verification

### 1.1 Code Review Gate
- [ ] All changes reviewed and approved by ≥ 1 senior engineer
- [ ] No hardcoded credentials, API keys, or secrets present in source files
  ```bash
  # Quick scan for hardcoded secrets
  git grep -Ei "(api_key|apikey|password|secret|token)\s*=\s*['\"][^'\"]{8,}" -- ':!*.md' ':!*.sh'
  ```
- [ ] `.gitignore` excludes `.env`, `serviceAccountKey.json`, and any `*.pem` / `*.key` files
- [ ] `firebase.rules` diff reviewed — no unintentional `allow read, write: if true;` rules
- [ ] Dependency audit passed with zero high/critical CVEs
  ```bash
  cd functions && npm audit --audit-level=high
  cd ../react-app && npm audit --audit-level=high
  ```

### 1.2 Firestore Security Rules Validation
- [ ] Rules linted and tested against the Firebase emulator
  ```bash
  firebase emulators:start --only firestore
  # Run rules unit tests (if present) in a separate terminal
  ```
- [ ] Verify the following access restrictions are enforced:
  - Users can only read/write their **own** `users/{userId}` documents
  - Booking `delete` is globally denied (`allow delete: if false`)
  - `activity_logs` creation is denied from client side (`allow create: if false`)
  - `cashbacks` create/update/delete denied from client (`allow create, update, delete: if false`)
  - Only `superadmin` can create/delete admin accounts
- [ ] Deploy rules to production
  ```bash
  firebase deploy --only firestore:rules
  ```

### 1.3 Authentication Configuration
- [ ] Firebase Authentication → **Authorized Domains** list contains only production domains; `localhost` removed
- [ ] Phone OTP sign-in enabled and reCAPTCHA configured for web client
- [ ] Email/Password sign-in restricted to admin provisioning flow only
- [ ] Multi-factor authentication (MFA) enforced for all admin accounts
- [ ] Session cookie expiry set to ≤ 1 hour for admin sessions
- [ ] Firebase App Check enabled with **reCAPTCHA v3** for production web app

### 1.4 Branch & Deployment Hygiene
- [ ] Deployment is from the `main` branch with a tagged release
- [ ] No uncommitted changes in working tree: `git status`
- [ ] CI pipeline passed (build + tests green)

---

## 2. Secret Manager Setup (GCP)

All runtime secrets **must** be stored in GCP Secret Manager, not in Firebase Functions config or environment files.

### 2.1 Enable the API
```bash
gcloud services enable secretmanager.googleapis.com --project=<PROJECT_ID>
```

### 2.2 Create Secrets
Run once per environment. **Never commit these values.**

```bash
PROJECT_ID="your-gcp-project-id"

# Gmail credentials (used by Nodemailer in functions/index.js)
echo -n "your-gmail-address@gmail.com" | \
  gcloud secrets create gigtos-gmail-user \
    --data-file=- --project=$PROJECT_ID

echo -n "your-gmail-app-password" | \
  gcloud secrets create gigtos-gmail-pass \
    --data-file=- --project=$PROJECT_ID

# Twilio credentials (used for OTP / SMS notifications)
echo -n "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" | \
  gcloud secrets create gigtos-twilio-sid \
    --data-file=- --project=$PROJECT_ID

echo -n "your-twilio-auth-token" | \
  gcloud secrets create gigtos-twilio-token \
    --data-file=- --project=$PROJECT_ID

echo -n "+1234567890" | \
  gcloud secrets create gigtos-twilio-phone \
    --data-file=- --project=$PROJECT_ID

# Firebase Admin SDK service account key (if needed outside Functions runtime)
gcloud secrets create gigtos-firebase-admin-key \
  --data-file=serviceAccountKey.json --project=$PROJECT_ID
# Delete the local file immediately after uploading
rm -f serviceAccountKey.json
```

### 2.3 Secret Versioning Policy
- [ ] Each secret has at least **2 active versions** (current + previous) to allow zero-downtime rotation
- [ ] Automatic rotation schedule configured (90 days maximum)
  ```bash
  gcloud secrets update gigtos-gmail-pass \
    --rotation-period=7776000s \
    --next-rotation-time=$(date -d '+90 days' --iso-8601=seconds) \
    --project=$PROJECT_ID
  ```
- [ ] Secret access audit logs enabled (default in GCP, verify in IAM > Audit Logs)

### 2.4 Rotate Secrets Before First Deployment
- [ ] Gmail App Password rotated within the last 30 days
- [ ] Twilio token active and not previously exposed in any repository

---

## 3. Firebase Configuration

### 3.1 Firebase Project Settings
- [ ] Production Firebase project is **separate** from the development/staging project
- [ ] Firebase project ID noted: `_______________________`
- [ ] Billing account linked and Blaze plan confirmed (required for Cloud Functions)
- [ ] Default GCP region set to the closest region: `asia-south1` (Mumbai) recommended for Kavali deployments

### 3.2 Firebase Hosting
- [ ] `firebase.json` reviewed — only intended directories exposed under `hosting.public`
- [ ] Redirect rules and HTTP headers configured:
  ```json
  {
    "hosting": {
      "headers": [
        {
          "source": "**",
          "headers": [
            { "key": "X-Content-Type-Options", "value": "nosniff" },
            { "key": "X-Frame-Options", "value": "DENY" },
            { "key": "X-XSS-Protection", "value": "1; mode=block" },
            { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
            { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
          ]
        }
      ]
    }
  }
  ```
- [ ] Deploy hosting:
  ```bash
  firebase deploy --only hosting
  ```

### 3.3 Cloud Functions
- [ ] `functions/index.js` reviewed — all secrets read from `functions.config()` or Secret Manager, not hardcoded
- [ ] Function timeout values explicitly set (default 60 s; adjust for long-running tasks)
- [ ] Memory allocation reviewed per function (default 256 MB)
- [ ] Functions deployed:
  ```bash
  cd functions
  npm ci --production
  firebase deploy --only functions
  ```
- [ ] Post-deploy smoke test — trigger a test booking and verify email + SMS arrive

### 3.4 Firebase Functions Environment Variables
> Prefer Secret Manager; use `functions:config` only for non-sensitive configuration.

```bash
# Set non-sensitive config
firebase functions:config:set app.env="production" app.region="asia-south1"

# Link secrets from Secret Manager (Functions v2 / Gen 2)
# Reference secrets directly in function code via Secret Manager client
```

- [ ] `firebase functions:config:get` returns no plain-text passwords or tokens
- [ ] All references to `functions.config().gmail.pass` and `functions.config().twilio.token` replaced with Secret Manager calls in production

---

## 4. Service Account IAM Roles

### 4.1 Principle of Least Privilege
Each service account should have **only the permissions it needs**.

| Service Account | Purpose | Required Roles |
|---|---|---|
| `firebase-adminsdk-*@*.iam.gserviceaccount.com` | Admin SDK (Cloud Functions) | `roles/datastore.user`, `roles/firebase.admin` |
| `functions-sa@*.iam.gserviceaccount.com` | Cloud Functions runtime | `roles/secretmanager.secretAccessor`, `roles/logging.logWriter`, `roles/monitoring.metricWriter` |
| `backup-sa@*.iam.gserviceaccount.com` | Firestore export | `roles/datastore.importExportAdmin`, `roles/storage.objectAdmin` |
| `ci-deploy-sa@*.iam.gserviceaccount.com` | CI/CD pipeline | `roles/firebase.developAdmin`, `roles/cloudfunctions.developer` |

### 4.2 Grant Roles
```bash
PROJECT_ID="your-gcp-project-id"
FUNCTIONS_SA="functions-sa@${PROJECT_ID}.iam.gserviceaccount.com"

# Grant Secret Manager access to the Functions service account
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${FUNCTIONS_SA}" \
  --role="roles/secretmanager.secretAccessor"

# Grant Firestore access
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${FUNCTIONS_SA}" \
  --role="roles/datastore.user"
```

### 4.3 Audit IAM Bindings
- [ ] Review all project-level IAM bindings before deployment
  ```bash
  gcloud projects get-iam-policy $PROJECT_ID --format=json | \
    python3 -c "import json,sys; p=json.load(sys.stdin); \
    [print(b) for b in p['bindings'] if 'roles/owner' in b['role'] or 'roles/editor' in b['role']]"
  ```
- [ ] No user accounts have `roles/owner` or `roles/editor` in production
- [ ] Service account keys are **not** downloaded unless strictly necessary; prefer Workload Identity Federation

---

## 5. Security Rules Deployment

### 5.1 Pre-Deploy Rules Check
- [ ] Review diff against currently deployed rules:
  ```bash
  firebase firestore:rules:get > current_rules.txt
  diff current_rules.txt firebase.rules
  ```
- [ ] Emulator-based rules tests pass:
  ```bash
  firebase emulators:exec --only firestore "npm test" --project=<PROJECT_ID>
  ```

### 5.2 Deploy Rules
```bash
firebase deploy --only firestore:rules --project=<PROJECT_ID>
```

### 5.3 Post-Deploy Verification
- [ ] Attempt an unauthorized read via the Firebase Console → Rules Playground → verify denial
- [ ] Verify `users/{userId}` write blocked for a different `uid`
- [ ] Verify `bookings` delete attempt is denied
- [ ] Verify `cashbacks` client-side write attempt is denied

---

## 6. Firestore Backup Configuration

### 6.1 Create Backup Bucket
```bash
BUCKET_NAME="${PROJECT_ID}-firestore-backups"
gsutil mb -l asia-south1 gs://${BUCKET_NAME}

# Enable versioning
gsutil versioning set on gs://${BUCKET_NAME}

# Set lifecycle: delete exports older than 90 days
cat > /tmp/lifecycle.json <<'EOF'
{
  "rule": [
    {
      "action": { "type": "Delete" },
      "condition": { "age": 90 }
    }
  ]
}
EOF
gsutil lifecycle set /tmp/lifecycle.json gs://${BUCKET_NAME}
```

### 6.2 Schedule Daily Exports
```bash
# Create the backup service account
gcloud iam service-accounts create firestore-backup-sa \
  --display-name="Firestore Backup SA" --project=$PROJECT_ID

BACKUP_SA="firestore-backup-sa@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:${BACKUP_SA}" \
  --role="roles/datastore.importExportAdmin"

gsutil iam ch "serviceAccount:${BACKUP_SA}:roles/storage.objectAdmin" \
  gs://${BUCKET_NAME}

# Schedule daily at 02:00 IST (20:30 UTC)
gcloud scheduler jobs create http gigtos-firestore-daily-backup \
  --schedule="30 20 * * *" \
  --uri="https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default):exportDocuments" \
  --message-body="{\"outputUriPrefix\": \"gs://${BUCKET_NAME}/daily\"}" \
  --oauth-service-account-email="${BACKUP_SA}" \
  --time-zone="UTC" \
  --project=$PROJECT_ID
```

### 6.3 Backup Verification
- [ ] Trigger a manual export and confirm objects appear in GCS bucket
  ```bash
  gcloud firestore export gs://${BUCKET_NAME}/manual-test --project=$PROJECT_ID
  gsutil ls gs://${BUCKET_NAME}/manual-test/
  ```
- [ ] Test restore to a **staging** project (never restore directly to production without testing)
  ```bash
  gcloud firestore import gs://${BUCKET_NAME}/manual-test/<TIMESTAMP>/ \
    --project=<STAGING_PROJECT_ID>
  ```

---

## 7. SSL/TLS Verification

### 7.1 Firebase Hosting (Automatic)
Firebase Hosting provisions and auto-renews TLS certificates via Let's Encrypt.

- [ ] Custom domain connected in **Firebase Console → Hosting → Add custom domain**
- [ ] DNS records (`A` / `TXT`) propagated; verify:
  ```bash
  dig +short A your-production-domain.com
  dig +short TXT your-production-domain.com
  ```
- [ ] Certificate status shown as **Active** in Firebase Console

### 7.2 Manual TLS Check
```bash
DOMAIN="your-production-domain.com"

# Check certificate validity
echo | openssl s_client -connect ${DOMAIN}:443 -servername ${DOMAIN} 2>/dev/null \
  | openssl x509 -noout -dates -subject -issuer

# Verify TLS 1.2+ only (TLS 1.0 / 1.1 should be absent)
nmap --script ssl-enum-ciphers -p 443 ${DOMAIN} | grep -E "TLSv|SSLv"
```

- [ ] Certificate expiry > 30 days
- [ ] Certificate issued by a trusted CA (Let's Encrypt / Google)
- [ ] TLS 1.0 and 1.1 disabled; only TLS 1.2+ accepted
- [ ] HSTS header present with `max-age ≥ 31536000`
- [ ] Run SSL Labs scan: https://www.ssllabs.com/ssltest/ — target grade **A**

### 7.3 Internal API Endpoints (Cloud Functions)
- [ ] All Cloud Functions HTTPS endpoints accessed over TLS (Firebase enforces this by default)
- [ ] No plain HTTP calls from the React app to any backend

---

## 8. Final Sign-Off

| Role | Name | Date | Signature |
|---|---|---|---|
| Lead Developer | | | |
| Security Reviewer | | | |
| Operations Lead | | | |

> **Deployment approved.** All checklist items verified. Proceed with deployment.

---

## Troubleshooting

| Symptom | Likely Cause | Resolution |
|---|---|---|
| `PERMISSION_DENIED` on Firestore write | Security rules not yet deployed | `firebase deploy --only firestore:rules` |
| Cloud Function returns 500 | Missing secret or env var | Check Secret Manager and `firebase functions:config:get` |
| TLS cert not provisioning | DNS not fully propagated | Wait up to 24 h; check DNS records |
| Backup export fails | Incorrect IAM role on backup SA | Re-apply `roles/datastore.importExportAdmin` |
| `functions.config()` returns undefined | Config not set | `firebase functions:config:set <key>="<val>"` then redeploy |
