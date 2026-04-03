#!/usr/bin/env bash
# =============================================================================
# GIGTOS — ENVIRONMENT SETUP SCRIPT
# =============================================================================
# Purpose  : Automate the initial setup of secrets, IAM permissions, monitoring
#            log sinks, and backup scheduling for the Gigtos production
#            Firebase / GCP environment.
#
# Usage    : bash ENVIRONMENT_SETUP.sh [--project PROJECT_ID] [--region REGION]
#            [--dry-run] [--skip-secrets] [--skip-monitoring] [--skip-backups]
#
# Prerequisites:
#   - gcloud CLI installed and authenticated (gcloud auth login)
#   - firebase CLI installed (npm install -g firebase-tools)
#   - jq installed (apt-get install jq / brew install jq)
#   - Owner or Editor role on the GCP project (scoped down after initial setup)
#
# Sections:
#   1.  Argument parsing & validation
#   2.  GCP API enablement
#   3.  Secret Manager setup
#   4.  IAM / Service account configuration
#   5.  Firestore security rules deployment
#   6.  GCS backup bucket and scheduling
#   7.  Cloud Monitoring — log-based metrics
#   8.  Cloud Monitoring — alert policies
#   9.  Log aggregation sink (GCS)
#  10.  Firebase Hosting security headers
#  11.  Post-setup verification
# =============================================================================

set -euo pipefail
IFS=$'\n\t'

# ---------------------------------------------------------------------------
# Color helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m' # No Color

log_info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
log_section() { echo -e "\n${BOLD}${BLUE}══════════════════════════════════════════${NC}"; \
                echo -e "${BOLD}  $*${NC}"; \
                echo -e "${BOLD}${BLUE}══════════════════════════════════════════${NC}\n"; }

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
PROJECT_ID=""
REGION="asia-south1"
DRY_RUN=false
SKIP_SECRETS=false
SKIP_MONITORING=false
SKIP_BACKUPS=false
NOTIFICATION_EMAIL="security@yourdomain.com"

# ---------------------------------------------------------------------------
# 1. Argument Parsing
# ---------------------------------------------------------------------------
log_section "1. Argument Parsing & Validation"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project)      PROJECT_ID="$2"; shift 2 ;;
    --region)       REGION="$2"; shift 2 ;;
    --email)        NOTIFICATION_EMAIL="$2"; shift 2 ;;
    --dry-run)      DRY_RUN=true; shift ;;
    --skip-secrets) SKIP_SECRETS=true; shift ;;
    --skip-monitoring) SKIP_MONITORING=true; shift ;;
    --skip-backups) SKIP_BACKUPS=true; shift ;;
    -h|--help)
      echo "Usage: $0 --project PROJECT_ID [--region REGION] [--email EMAIL]"
      echo "          [--dry-run] [--skip-secrets] [--skip-monitoring] [--skip-backups]"
      exit 0
      ;;
    *) log_error "Unknown argument: $1"; exit 1 ;;
  esac
done

# If project not provided via flag, try to detect from gcloud config
if [[ -z "$PROJECT_ID" ]]; then
  PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
fi

if [[ -z "$PROJECT_ID" ]]; then
  log_error "GCP Project ID is required. Pass --project PROJECT_ID or run: gcloud config set project PROJECT_ID"
  exit 1
fi

log_info "Project ID  : ${PROJECT_ID}"
log_info "Region      : ${REGION}"
log_info "Alert email : ${NOTIFICATION_EMAIL}"
log_info "Dry-run     : ${DRY_RUN}"
echo ""

if $DRY_RUN; then
  log_warn "DRY-RUN MODE — commands will be printed but not executed."
fi

run() {
  if $DRY_RUN; then
    echo "  [DRY-RUN] $*"
  else
    eval "$@"
  fi
}

# Check required tools
for tool in gcloud firebase jq; do
  if ! command -v "$tool" &>/dev/null; then
    log_error "'$tool' is not installed. Please install it and try again."
    exit 1
  fi
done
log_ok "Required tools available."

# ---------------------------------------------------------------------------
# 2. GCP API Enablement
# ---------------------------------------------------------------------------
log_section "2. Enabling Required GCP APIs"

REQUIRED_APIS=(
  "secretmanager.googleapis.com"
  "monitoring.googleapis.com"
  "logging.googleapis.com"
  "cloudscheduler.googleapis.com"
  "firestore.googleapis.com"
  "cloudfunctions.googleapis.com"
  "storage.googleapis.com"
  "iam.googleapis.com"
  "cloudresourcemanager.googleapis.com"
)

for API in "${REQUIRED_APIS[@]}"; do
  log_info "Enabling ${API} ..."
  run gcloud services enable "$API" --project="$PROJECT_ID" --quiet
done
log_ok "All required APIs enabled."

# ---------------------------------------------------------------------------
# 3. Secret Manager Setup
# ---------------------------------------------------------------------------
log_section "3. Secret Manager — Creating / Verifying Secrets"

if $SKIP_SECRETS; then
  log_warn "Skipping Secret Manager setup (--skip-secrets)."
else
  # Function to create a secret if it does not already exist
  ensure_secret() {
    local SECRET_NAME="$1"
    local DESCRIPTION="$2"

    if gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" &>/dev/null 2>&1; then
      log_info "Secret '${SECRET_NAME}' already exists — skipping creation."
    else
      log_info "Creating secret '${SECRET_NAME}' ..."
      run gcloud secrets create "$SECRET_NAME" \
        --replication-policy=automatic \
        --labels="app=gigtos,env=production" \
        --project="$PROJECT_ID"
      log_ok "Secret '${SECRET_NAME}' created. Add a version with: gcloud secrets versions add ${SECRET_NAME} --data-file=- --project=${PROJECT_ID}"
    fi
  }

  ensure_secret "gigtos-gmail-user"    "Gmail address used by Nodemailer"
  ensure_secret "gigtos-gmail-pass"    "Gmail app password for Nodemailer"
  ensure_secret "gigtos-twilio-sid"    "Twilio Account SID"
  ensure_secret "gigtos-twilio-token"  "Twilio Auth Token"
  ensure_secret "gigtos-twilio-phone"  "Twilio sending phone number"

  log_warn "ACTION REQUIRED: Populate each secret with its value:"
  cat <<'INSTRUCTIONS'

  gcloud secrets versions add gigtos-gmail-user   --data-file=- --project=PROJECT_ID <<< "you@gmail.com"
  gcloud secrets versions add gigtos-gmail-pass   --data-file=- --project=PROJECT_ID <<< "your-app-password"
  gcloud secrets versions add gigtos-twilio-sid   --data-file=- --project=PROJECT_ID <<< "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  gcloud secrets versions add gigtos-twilio-token --data-file=- --project=PROJECT_ID <<< "your-twilio-auth-token"
  gcloud secrets versions add gigtos-twilio-phone --data-file=- --project=PROJECT_ID <<< "+1234567890"

INSTRUCTIONS

  # Set rotation reminders (90 days)
  log_info "Configuring 90-day rotation reminders on secrets ..."
  ROTATION_PERIOD="7776000s"  # 90 days in seconds
  NEXT_ROTATION=$(date -d '+90 days' --iso-8601=seconds 2>/dev/null || \
                  date -v+90d '+%Y-%m-%dT%H:%M:%S+00:00' 2>/dev/null || \
                  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ)")

  for SECRET_NAME in gigtos-gmail-pass gigtos-twilio-token; do
    run gcloud secrets update "$SECRET_NAME" \
      --next-rotation-time="$NEXT_ROTATION" \
      --rotation-period="$ROTATION_PERIOD" \
      --project="$PROJECT_ID" || log_warn "Could not set rotation on ${SECRET_NAME} (may need a version first)."
  done

  log_ok "Secret Manager setup complete."
fi

# ---------------------------------------------------------------------------
# 4. IAM — Service Accounts & Permissions
# ---------------------------------------------------------------------------
log_section "4. IAM — Service Account Configuration"

# Create Cloud Functions runtime service account
FUNCTIONS_SA_NAME="gigtos-functions-sa"
FUNCTIONS_SA_EMAIL="${FUNCTIONS_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe "$FUNCTIONS_SA_EMAIL" --project="$PROJECT_ID" &>/dev/null 2>&1; then
  log_info "Creating Cloud Functions service account: ${FUNCTIONS_SA_EMAIL}"
  run gcloud iam service-accounts create "$FUNCTIONS_SA_NAME" \
    --display-name="Gigtos Cloud Functions Runtime" \
    --description="Service account for Gigtos Cloud Functions — least privilege" \
    --project="$PROJECT_ID"
else
  log_info "Service account '${FUNCTIONS_SA_EMAIL}' already exists."
fi

# Grant required roles to Functions SA
log_info "Granting IAM roles to Functions service account ..."
FUNCTIONS_ROLES=(
  "roles/datastore.user"
  "roles/secretmanager.secretAccessor"
  "roles/logging.logWriter"
  "roles/monitoring.metricWriter"
)
for ROLE in "${FUNCTIONS_ROLES[@]}"; do
  run gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${FUNCTIONS_SA_EMAIL}" \
    --role="$ROLE" \
    --condition=None \
    --quiet
  log_ok "  Granted: ${ROLE}"
done

# Create Firestore Backup service account
BACKUP_SA_NAME="gigtos-backup-sa"
BACKUP_SA_EMAIL="${BACKUP_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe "$BACKUP_SA_EMAIL" --project="$PROJECT_ID" &>/dev/null 2>&1; then
  log_info "Creating Firestore Backup service account: ${BACKUP_SA_EMAIL}"
  run gcloud iam service-accounts create "$BACKUP_SA_NAME" \
    --display-name="Gigtos Firestore Backup SA" \
    --description="Service account for scheduled Firestore exports" \
    --project="$PROJECT_ID"
else
  log_info "Service account '${BACKUP_SA_EMAIL}' already exists."
fi

run gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${BACKUP_SA_EMAIL}" \
  --role="roles/datastore.importExportAdmin" \
  --condition=None \
  --quiet

log_ok "IAM configuration complete."

# ---------------------------------------------------------------------------
# 5. Firestore Security Rules Deployment
# ---------------------------------------------------------------------------
log_section "5. Firestore Security Rules Deployment"

RULES_FILE="firebase.rules"
if [[ ! -f "$RULES_FILE" ]]; then
  log_warn "firebase.rules not found in current directory. Skipping rules deployment."
  log_warn "Run this script from the root of the Gigtos repository."
else
  log_info "Deploying Firestore security rules from ${RULES_FILE} ..."
  run firebase deploy --only firestore:rules --project="$PROJECT_ID" --non-interactive
  log_ok "Firestore security rules deployed."
fi

# ---------------------------------------------------------------------------
# 6. GCS Backup Bucket & Scheduler
# ---------------------------------------------------------------------------
log_section "6. Firestore Backup — GCS Bucket & Cloud Scheduler"

if $SKIP_BACKUPS; then
  log_warn "Skipping backup setup (--skip-backups)."
else
  BACKUP_BUCKET="${PROJECT_ID}-firestore-backups"
  AUDIT_LOG_BUCKET="${PROJECT_ID}-audit-logs"

  # Create backup bucket
  if ! gsutil ls -b "gs://${BACKUP_BUCKET}" &>/dev/null 2>&1; then
    log_info "Creating backup bucket: gs://${BACKUP_BUCKET}"
    run gsutil mb -l "$REGION" "gs://${BACKUP_BUCKET}"
    run gsutil versioning set on "gs://${BACKUP_BUCKET}"
  else
    log_info "Backup bucket already exists: gs://${BACKUP_BUCKET}"
  fi

  # Lifecycle policy: delete exports older than 90 days
  LIFECYCLE_FILE=$(mktemp /tmp/gigtos-lifecycle-XXXXXX.json)
  cat > "$LIFECYCLE_FILE" <<'EOF'
{
  "rule": [
    {
      "action": { "type": "Delete" },
      "condition": { "age": 90 }
    }
  ]
}
EOF
  run gsutil lifecycle set "$LIFECYCLE_FILE" "gs://${BACKUP_BUCKET}"
  rm -f "$LIFECYCLE_FILE"
  log_ok "Backup bucket lifecycle policy set (90-day retention)."

  # Grant backup SA access to bucket
  run gsutil iam ch \
    "serviceAccount:${BACKUP_SA_EMAIL}:roles/storage.objectAdmin" \
    "gs://${BACKUP_BUCKET}"
  log_ok "Granted backup SA access to bucket."

  # Create audit log bucket
  if ! gsutil ls -b "gs://${AUDIT_LOG_BUCKET}" &>/dev/null 2>&1; then
    log_info "Creating audit log bucket: gs://${AUDIT_LOG_BUCKET}"
    run gsutil mb -l "$REGION" "gs://${AUDIT_LOG_BUCKET}"
    run gsutil retention set 2y "gs://${AUDIT_LOG_BUCKET}"
  else
    log_info "Audit log bucket already exists: gs://${AUDIT_LOG_BUCKET}"
  fi

  # Schedule daily Firestore backup at 02:00 IST (20:30 UTC)
  SCHEDULER_JOB="gigtos-firestore-daily-backup"
  if ! gcloud scheduler jobs describe "$SCHEDULER_JOB" --location="$REGION" --project="$PROJECT_ID" &>/dev/null 2>&1; then
    log_info "Creating Cloud Scheduler job: ${SCHEDULER_JOB}"
    BACKUP_BODY="{\"outputUriPrefix\": \"gs://${BACKUP_BUCKET}/daily\"}"
    run gcloud scheduler jobs create http "$SCHEDULER_JOB" \
      --location="$REGION" \
      --schedule="30 20 * * *" \
      --uri="https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default):exportDocuments" \
      --message-body="$BACKUP_BODY" \
      --oauth-service-account-email="$BACKUP_SA_EMAIL" \
      --time-zone="UTC" \
      --description="Daily Gigtos Firestore backup to GCS" \
      --project="$PROJECT_ID"
    log_ok "Cloud Scheduler job '${SCHEDULER_JOB}' created."
  else
    log_info "Scheduler job '${SCHEDULER_JOB}' already exists."
  fi

  log_ok "Backup configuration complete."
fi

# ---------------------------------------------------------------------------
# 7. Cloud Monitoring — Log-Based Metrics
# ---------------------------------------------------------------------------
log_section "7. Cloud Monitoring — Log-Based Metrics"

if $SKIP_MONITORING; then
  log_warn "Skipping monitoring setup (--skip-monitoring)."
else
  create_metric() {
    local NAME="$1"
    local DESCRIPTION="$2"
    local FILTER="$3"

    if gcloud logging metrics describe "$NAME" --project="$PROJECT_ID" &>/dev/null 2>&1; then
      log_info "Log metric '${NAME}' already exists."
    else
      log_info "Creating log metric: ${NAME}"
      run gcloud logging metrics create "$NAME" \
        --description="$DESCRIPTION" \
        --log-filter="$FILTER" \
        --project="$PROJECT_ID"
      log_ok "Created: ${NAME}"
    fi
  }

  create_metric "auth_failures" \
    "Firebase Authentication failure events" \
    'resource.type="firebase_project" severity>=WARNING (textPayload=~"SIGN_IN_FAILED" OR textPayload=~"TOO_MANY_ATTEMPTS")'

  create_metric "firestore_denied" \
    "Firestore security rule permission-denied events" \
    'protoPayload.serviceName="firestore.googleapis.com" protoPayload.status.code=7'

  create_metric "backup_success" \
    "Successful Firestore backup export job completions" \
    'resource.type="cloud_scheduler_job" resource.labels.job_id="gigtos-firestore-daily-backup" textPayload=~"Export.*completed"'

  create_metric "callable_auth_errors" \
    "Unauthorized or unauthenticated calls to Cloud Functions callable endpoints" \
    'resource.type="cloud_function" (textPayload=~"UNAUTHENTICATED" OR textPayload=~"PERMISSION_DENIED")'

  log_ok "Log-based metrics setup complete."

  # ---------------------------------------------------------------------------
  # 8. Cloud Monitoring — Alert Policies & Notification Channel
  # ---------------------------------------------------------------------------
  log_section "8. Cloud Monitoring — Notification Channel & Alert Policies"

  # Create email notification channel
  log_info "Creating email notification channel for: ${NOTIFICATION_EMAIL}"
  CHANNEL_ID=""
  if ! $DRY_RUN; then
    CHANNEL_RESULT=$(gcloud alpha monitoring channels create \
      --display-name="Gigtos Security Team" \
      --type=email \
      --channel-labels="email_address=${NOTIFICATION_EMAIL}" \
      --project="$PROJECT_ID" \
      --format="value(name)" 2>/dev/null || echo "")
    CHANNEL_ID="${CHANNEL_RESULT}"
    if [[ -n "$CHANNEL_ID" ]]; then
      log_ok "Notification channel created: ${CHANNEL_ID}"
    else
      log_warn "Could not create notification channel automatically."
      log_warn "Create it manually: GCP Console → Monitoring → Alerting → Notification channels"
      CHANNEL_ID="REPLACE_WITH_CHANNEL_ID"
    fi
  else
    log_info "[DRY-RUN] Would create notification channel for ${NOTIFICATION_EMAIL}"
    CHANNEL_ID="DRY_RUN_CHANNEL_ID"
  fi

  # Helper to create an alert policy from a JSON file
  create_alert() {
    local DISPLAY_NAME="$1"
    local POLICY_JSON="$2"

    # Check if alert with this name already exists
    EXISTING=$(gcloud alpha monitoring policies list \
      --filter="displayName='${DISPLAY_NAME}'" \
      --project="$PROJECT_ID" \
      --format="value(name)" 2>/dev/null | head -1 || true)

    if [[ -n "$EXISTING" ]]; then
      log_info "Alert policy '${DISPLAY_NAME}' already exists."
    else
      log_info "Creating alert policy: ${DISPLAY_NAME}"
      POLICY_FILE=$(mktemp /tmp/alert-policy-XXXXXX.json)
      echo "$POLICY_JSON" > "$POLICY_FILE"
      run gcloud alpha monitoring policies create \
        --policy-from-file="$POLICY_FILE" \
        --project="$PROJECT_ID"
      rm -f "$POLICY_FILE"
      log_ok "Alert created: ${DISPLAY_NAME}"
    fi
  }

  # Alert: High Auth Failure Rate
  create_alert "[GIGTOS-SEC] High Auth Failure Rate" "$(cat <<EOF
{
  "displayName": "[GIGTOS-SEC] High Auth Failure Rate",
  "conditions": [
    {
      "displayName": "Auth failures > 10 per minute",
      "conditionThreshold": {
        "filter": "metric.type=\"logging.googleapis.com/user/auth_failures\" resource.type=\"global\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 10,
        "duration": "60s",
        "aggregations": [
          {
            "alignmentPeriod": "60s",
            "perSeriesAligner": "ALIGN_SUM"
          }
        ]
      }
    }
  ],
  "alertStrategy": { "autoClose": "1800s" },
  "notificationChannels": ["${CHANNEL_ID}"],
  "documentation": {
    "content": "High authentication failure rate detected. Potential brute-force attempt. Runbook: SECURITY_TEAM_RUNBOOK.md §1.3",
    "mimeType": "text/markdown"
  }
}
EOF
)"

  # Alert: Firestore Denial Spike
  create_alert "[GIGTOS-SEC] Firestore Denial Spike" "$(cat <<EOF
{
  "displayName": "[GIGTOS-SEC] Firestore Denial Spike",
  "conditions": [
    {
      "displayName": "Security rule denials > 50 in 5 minutes",
      "conditionThreshold": {
        "filter": "metric.type=\"logging.googleapis.com/user/firestore_denied\" resource.type=\"global\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 50,
        "duration": "300s",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_SUM"
          }
        ]
      }
    }
  ],
  "notificationChannels": ["${CHANNEL_ID}"],
  "documentation": {
    "content": "Elevated Firestore security rule denials. Review logs. Runbook: INCIDENT_RESPONSE_PLAN.md §3.",
    "mimeType": "text/markdown"
  }
}
EOF
)"

  # Alert: Cloud Function Error Rate Elevated
  create_alert "[GIGTOS-OPS] Cloud Function Error Rate Elevated" "$(cat <<EOF
{
  "displayName": "[GIGTOS-OPS] Cloud Function Error Rate Elevated",
  "conditions": [
    {
      "displayName": "Function invocations with non-OK status > 50/min",
      "conditionThreshold": {
        "filter": "metric.type=\"cloudfunctions.googleapis.com/function/execution_count\" metric.labels.status!=\"ok\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 50,
        "duration": "120s",
        "aggregations": [
          {
            "alignmentPeriod": "60s",
            "perSeriesAligner": "ALIGN_RATE",
            "crossSeriesReducer": "REDUCE_SUM"
          }
        ]
      }
    }
  ],
  "notificationChannels": ["${CHANNEL_ID}"],
  "documentation": {
    "content": "Cloud Function error rate elevated. Check function logs for root cause.",
    "mimeType": "text/markdown"
  }
}
EOF
)"

  # Alert: Backup Missing
  create_alert "[GIGTOS-OPS] Firestore Backup Missing" "$(cat <<EOF
{
  "displayName": "[GIGTOS-OPS] Firestore Backup Missing",
  "conditions": [
    {
      "displayName": "No backup success in 25 hours",
      "conditionAbsent": {
        "filter": "metric.type=\"logging.googleapis.com/user/backup_success\" resource.type=\"global\"",
        "duration": "90000s",
        "aggregations": [
          {
            "alignmentPeriod": "86400s",
            "perSeriesAligner": "ALIGN_SUM"
          }
        ]
      }
    }
  ],
  "notificationChannels": ["${CHANNEL_ID}"],
  "documentation": {
    "content": "No Firestore backup logged in 25 hours. Check Cloud Scheduler job and backup SA permissions.",
    "mimeType": "text/markdown"
  }
}
EOF
)"

  log_ok "Alert policies setup complete."

  # ---------------------------------------------------------------------------
  # 9. Log Aggregation Sink
  # ---------------------------------------------------------------------------
  log_section "9. Cloud Logging — GCS Sink for Audit Logs"

  AUDIT_LOG_BUCKET="${PROJECT_ID}-audit-logs"
  SINK_NAME="gigtos-audit-sink"

  if gcloud logging sinks describe "$SINK_NAME" --project="$PROJECT_ID" &>/dev/null 2>&1; then
    log_info "Log sink '${SINK_NAME}' already exists."
  else
    log_info "Creating log sink: ${SINK_NAME} → gs://${AUDIT_LOG_BUCKET}"
    run gcloud logging sinks create "$SINK_NAME" \
      "storage.googleapis.com/${AUDIT_LOG_BUCKET}" \
      --log-filter='protoPayload.serviceName="firestore.googleapis.com" OR protoPayload.serviceName="cloudfunctions.googleapis.com" OR protoPayload.serviceName="firebase.googleapis.com"' \
      --project="$PROJECT_ID"
    log_ok "Log sink created."

    # Grant the sink's writer SA access to the audit bucket
    if ! $DRY_RUN; then
      SINK_SA=$(gcloud logging sinks describe "$SINK_NAME" \
        --project="$PROJECT_ID" \
        --format="value(writerIdentity)")
      run gsutil iam ch "${SINK_SA}:roles/storage.objectCreator" "gs://${AUDIT_LOG_BUCKET}"
      log_ok "Granted sink writer access to audit log bucket."
    fi
  fi

fi  # end if not skip_monitoring

# ---------------------------------------------------------------------------
# 10. Firebase Hosting — Security Headers
# ---------------------------------------------------------------------------
log_section "10. Firebase Hosting — Security Headers"

FIREBASE_JSON="firebase.json"

if [[ ! -f "$FIREBASE_JSON" ]]; then
  log_warn "firebase.json not found. Skipping hosting headers setup."
else
  # Check if hosting headers are already configured
  if jq -e '.hosting.headers' "$FIREBASE_JSON" &>/dev/null 2>&1; then
    log_info "firebase.json already contains hosting headers configuration."
  else
    log_info "Adding security headers to firebase.json ..."
    HEADERS_JSON='{
  "source": "**",
  "headers": [
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "X-Frame-Options", "value": "DENY" },
    { "key": "X-XSS-Protection", "value": "1; mode=block" },
    { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
    { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
  ]
}'
    if ! $DRY_RUN; then
      TMP=$(mktemp /tmp/firebase-json-XXXXXX.json)
      jq --argjson hdr "$HEADERS_JSON" \
        'if .hosting then .hosting.headers = [$hdr] else . + {"hosting": {"headers": [$hdr]}} end' \
        "$FIREBASE_JSON" > "$TMP"
      mv "$TMP" "$FIREBASE_JSON"
      log_ok "Security headers added to firebase.json."
      log_warn "Remember to run: firebase deploy --only hosting --project=${PROJECT_ID}"
    else
      log_info "[DRY-RUN] Would add security headers to firebase.json."
    fi
  fi
fi

# ---------------------------------------------------------------------------
# 11. Post-Setup Verification
# ---------------------------------------------------------------------------
log_section "11. Post-Setup Verification"

PASS=0
FAIL=0

check() {
  local DESCRIPTION="$1"
  local CMD="$2"

  if $DRY_RUN; then
    log_info "[DRY-RUN] Would check: ${DESCRIPTION}"
    return
  fi

  if eval "$CMD" &>/dev/null 2>&1; then
    log_ok "  ✓ ${DESCRIPTION}"
    PASS=$((PASS + 1))
  else
    log_error "  ✗ ${DESCRIPTION}"
    FAIL=$((FAIL + 1))
  fi
}

check "Secret 'gigtos-gmail-user' exists" \
  "gcloud secrets describe gigtos-gmail-user --project=${PROJECT_ID}"

check "Secret 'gigtos-gmail-pass' exists" \
  "gcloud secrets describe gigtos-gmail-pass --project=${PROJECT_ID}"

check "Secret 'gigtos-twilio-sid' exists" \
  "gcloud secrets describe gigtos-twilio-sid --project=${PROJECT_ID}"

check "Cloud Functions SA exists" \
  "gcloud iam service-accounts describe ${FUNCTIONS_SA_EMAIL} --project=${PROJECT_ID}"

check "Backup SA exists" \
  "gcloud iam service-accounts describe ${BACKUP_SA_EMAIL} --project=${PROJECT_ID}"

if ! $SKIP_BACKUPS; then
  check "Backup bucket exists" \
    "gsutil ls -b gs://${PROJECT_ID}-firestore-backups"

  check "Cloud Scheduler backup job exists" \
    "gcloud scheduler jobs describe gigtos-firestore-daily-backup --location=${REGION} --project=${PROJECT_ID}"
fi

if ! $SKIP_MONITORING; then
  check "Log metric 'auth_failures' exists" \
    "gcloud logging metrics describe auth_failures --project=${PROJECT_ID}"

  check "Log metric 'firestore_denied' exists" \
    "gcloud logging metrics describe firestore_denied --project=${PROJECT_ID}"

  check "Log metric 'backup_success' exists" \
    "gcloud logging metrics describe backup_success --project=${PROJECT_ID}"

  check "Log sink '${SINK_NAME}' exists" \
    "gcloud logging sinks describe ${SINK_NAME} --project=${PROJECT_ID}" || true
fi

echo ""
log_section "Setup Complete"

if ! $DRY_RUN; then
  log_ok "Verification results: ${PASS} passed, ${FAIL} failed."

  if [[ $FAIL -gt 0 ]]; then
    log_error "Some checks failed. Review the output above and remediate before deploying to production."
    exit 1
  fi
fi

echo ""
echo -e "${BOLD}Next Steps:${NC}"
echo "  1. Populate secrets with real values (see instructions printed above)"
echo "  2. Deploy Firestore rules: firebase deploy --only firestore:rules --project=${PROJECT_ID}"
echo "  3. Deploy Cloud Functions: firebase deploy --only functions --project=${PROJECT_ID}"
echo "  4. Deploy Hosting:         firebase deploy --only hosting  --project=${PROJECT_ID}"
echo "  5. Review DEPLOYMENT_CHECKLIST.md and complete all items"
echo "  6. Set up the monitoring dashboard (MONITORING_SETUP.md §2)"
echo "  7. Brief the on-call team with SECURITY_TEAM_RUNBOOK.md"
echo ""
log_ok "ENVIRONMENT_SETUP.sh finished successfully."
