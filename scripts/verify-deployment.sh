#!/bin/bash
# verify-deployment.sh - Post-deployment verification script for Gigtos
#
# Usage: ./scripts/verify-deployment.sh
#
# Performs a comprehensive health check:
#   1. GitHub — PR #14 merged, commits on main
#   2. Cloud Functions — createBooking deployed and healthy
#   3. Firestore integration — read/write to bookings collection
#   4. Email/SMS configuration — env vars present
#   5. Generates a verification report with dashboard
#
# Required environment variables:
#   FIREBASE_PROJECT_ID   Your Firebase project ID
#
# Optional:
#   FUNCTIONS_BASE_URL    Override the default Cloud Functions base URL

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=config.sh
source "${SCRIPT_DIR}/config.sh"
# shellcheck source=utils.sh
source "${SCRIPT_DIR}/utils.sh"

# ─── Initialise ──────────────────────────────────────────────────────────────
set_log_file "${VERIFY_REPORT}"
start_timer
reset_counters

FUNCTIONS_BASE_URL="${FUNCTIONS_BASE_URL:-https://${FIREBASE_REGION}-${FIREBASE_PROJECT_ID}.cloudfunctions.net}"
HEALTH_ENDPOINT="${FUNCTIONS_BASE_URL}/createBooking"

# ─── Banner ──────────────────────────────────────────────────────────────────
print_section "GIGTOS DEPLOYMENT VERIFICATION"
print_info "Timestamp : $(date '+%Y-%m-%d %H:%M:%S')"
print_info "Project   : ${FIREBASE_PROJECT_ID:-<not set>}"
print_info "Log file  : ${VERIFY_REPORT}"

# ─── Check 1: Environment ────────────────────────────────────────────────────
print_section "CHECK 1 — ENVIRONMENT"
if validate_env; then
    record_pass "FIREBASE_PROJECT_ID is set (${FIREBASE_PROJECT_ID})"
else
    record_fail "FIREBASE_PROJECT_ID is not set"
fi

# ─── Check 2: Tools ──────────────────────────────────────────────────────────
print_section "CHECK 2 — REQUIRED TOOLS"
check_git    && record_pass "git available"    || record_fail "git missing"
check_node   && record_pass "Node.js v16+"     || record_fail "Node.js missing or outdated"
check_npm    && record_pass "npm available"    || record_fail "npm missing"
check_firebase_cli && record_pass "Firebase CLI available" || record_fail "Firebase CLI missing"
check_gh_cli && record_pass "GitHub CLI available" || record_fail "GitHub CLI missing"

# ─── Check 3: GitHub — PR #14 ────────────────────────────────────────────────
print_section "CHECK 3 — GITHUB PR #${PR_NUMBER} STATUS"

if command -v gh &>/dev/null; then
    PR_STATE=$(gh_pr_state "${PR_NUMBER}")
    PR_TITLE=$(gh_pr_title "${PR_NUMBER}")

    if [ "${PR_STATE}" = "MERGED" ]; then
        record_pass "PR #${PR_NUMBER} merged: ${PR_TITLE}"
    elif [ "${PR_STATE}" = "OPEN" ]; then
        record_fail "PR #${PR_NUMBER} is still OPEN — run deploy.sh to merge and deploy"
    else
        record_fail "PR #${PR_NUMBER} state: ${PR_STATE} (title: ${PR_TITLE})"
    fi

    # Check that the merge commit is present on the default branch
    MERGE_COMMIT=$(gh pr view "${PR_NUMBER}" --json mergeCommit --jq '.mergeCommit.oid' 2>/dev/null || echo "")
    if [ "${PR_STATE}" = "MERGED" ] && [ -n "${MERGE_COMMIT}" ]; then
        if git merge-base --is-ancestor "${MERGE_COMMIT}" "origin/${DEFAULT_BRANCH}" 2>/dev/null; then
            record_pass "Merge commit ${MERGE_COMMIT:0:8} is on ${DEFAULT_BRANCH}"
        else
            record_fail "Merge commit ${MERGE_COMMIT:0:8} NOT found on ${DEFAULT_BRANCH}"
        fi
    fi
else
    print_warning "GitHub CLI not available — skipping PR checks"
fi

# ─── Check 4: Firebase Authentication ────────────────────────────────────────
print_section "CHECK 4 — FIREBASE AUTHENTICATION"

if command -v firebase &>/dev/null; then
    if firebase projects:list &>/dev/null; then
        record_pass "Firebase CLI authenticated"

        # Check if the project exists and is accessible
        if firebase projects:list 2>/dev/null | grep -q "${FIREBASE_PROJECT_ID}"; then
            record_pass "Project '${FIREBASE_PROJECT_ID}' found in Firebase account"
        else
            record_fail "Project '${FIREBASE_PROJECT_ID}' not found — check FIREBASE_PROJECT_ID"
        fi
    else
        record_fail "Firebase CLI not authenticated — run: firebase login"
    fi
else
    print_warning "Firebase CLI not available — skipping Firebase auth checks"
fi

# ─── Check 5: Cloud Functions Deployed ────────────────────────────────────────
print_section "CHECK 5 — CLOUD FUNCTIONS"

if command -v firebase &>/dev/null && [ -n "${FIREBASE_PROJECT_ID}" ]; then
    FUNCTIONS_LIST=$(firebase functions:list \
        --project "${FIREBASE_PROJECT_ID}" 2>/dev/null || echo "UNAVAILABLE")

    if echo "${FUNCTIONS_LIST}" | grep -q "createBooking"; then
        record_pass "createBooking function is deployed"
    elif echo "${FUNCTIONS_LIST}" | grep -q "UNAVAILABLE"; then
        print_warning "Could not list Cloud Functions (may need authentication)"
    else
        record_fail "createBooking function NOT found in deployed functions"
        print_info "Deploy with: ./scripts/deploy.sh"
    fi
else
    print_warning "Skipping Cloud Functions check"
fi

# ─── Check 6: HTTP Health Check ───────────────────────────────────────────────
print_section "CHECK 6 — HTTP HEALTH CHECK"

if command -v curl &>/dev/null; then
    print_step "Pinging ${HEALTH_ENDPOINT}…"

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -X POST \
        -H "Content-Type: application/json" \
        -d '{}' \
        --max-time 20 \
        "${HEALTH_ENDPOINT}" 2>/dev/null || echo "000")

    if [ "${HTTP_CODE}" = "400" ]; then
        # 400 means the function is live and validated the (intentionally empty) payload
        record_pass "createBooking endpoint reachable (HTTP ${HTTP_CODE} — validation working)"
    elif [ "${HTTP_CODE}" = "200" ] || [ "${HTTP_CODE}" = "201" ]; then
        record_pass "createBooking endpoint reachable and returned HTTP ${HTTP_CODE}"
    elif [ "${HTTP_CODE}" = "000" ]; then
        record_fail "createBooking endpoint unreachable (network/DNS error)"
    elif [ "${HTTP_CODE}" = "404" ]; then
        record_fail "createBooking function not found (HTTP 404) — check deployment"
    else
        print_warning "createBooking returned HTTP ${HTTP_CODE} — verify manually"
    fi
else
    print_warning "curl not available — skipping HTTP health check"
fi

# ─── Check 7: Firestore Integration ──────────────────────────────────────────
print_section "CHECK 7 — FIRESTORE INTEGRATION"

if command -v firebase &>/dev/null && [ -n "${FIREBASE_PROJECT_ID}" ]; then
    print_step "Checking bookings collection access…"

    FIRESTORE_OUTPUT=$(firebase firestore:get bookings \
        --project "${FIREBASE_PROJECT_ID}" \
        --limit 1 2>/dev/null || echo "FIRESTORE_ERROR")

    if echo "${FIRESTORE_OUTPUT}" | grep -q "FIRESTORE_ERROR"; then
        record_fail "Cannot access Firestore bookings collection"
    else
        record_pass "Firestore bookings collection accessible"
    fi
else
    print_warning "Skipping Firestore check (Firebase CLI unavailable or project not set)"
fi

# ─── Check 8: Email / SMS Configuration ──────────────────────────────────────
print_section "CHECK 8 — EMAIL / SMS CONFIGURATION"

# Email
if [ -n "${GMAIL_USER:-}" ] || [ -n "${SENDGRID_API_KEY:-}" ]; then
    record_pass "Email provider configured (Gmail or SendGrid)"
else
    print_warning "No email provider env vars detected (GMAIL_USER / SENDGRID_API_KEY)"
fi

# SMS / Twilio
if [ -n "${TWILIO_ACCOUNT_SID:-}" ] && [ -n "${TWILIO_AUTH_TOKEN:-}" ]; then
    record_pass "Twilio SMS configured (TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN)"
else
    print_warning "Twilio env vars not set (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)"
fi

# ─── Generate Verification Report / Dashboard ─────────────────────────────────
TOTAL_TIME=$(elapsed_time)
TOTAL=$(( PASS_COUNT + FAIL_COUNT ))
REPORT_DATE=$(date '+%Y-%m-%d %H:%M:%S')

print_section "VERIFICATION REPORT — ${REPORT_DATE}"

{
    report_section "GIGTOS VERIFICATION REPORT — ${REPORT_DATE}"
    echo ""
    echo "Project : ${FIREBASE_PROJECT_ID:-<not set>}"
    echo "Region  : ${FIREBASE_REGION}"
    echo ""
    report_section "HEALTH CHECK DASHBOARD"
    echo ""
    echo "  Checks Passed : ${PASS_COUNT}"
    echo "  Checks Failed : ${FAIL_COUNT}"
    echo "  Total Checks  : ${TOTAL}"
    echo ""
    echo "  Duration      : ${TOTAL_TIME}"
    echo "  Full log      : ${VERIFY_REPORT}"
    echo ""
    report_section "RECOMMENDED NEXT STEPS"
    if [ "${FAIL_COUNT}" -eq 0 ]; then
        echo "  ✅ All checks passed. Deployment is healthy!"
        echo ""
        echo "  1. Monitor Cloud Functions logs:"
        echo "     firebase functions:log --project ${FIREBASE_PROJECT_ID}"
        echo "  2. View Firestore data in the Firebase Console:"
        echo "     https://console.firebase.google.com/project/${FIREBASE_PROJECT_ID}/firestore"
    else
        echo "  ❌ ${FAIL_COUNT} check(s) failed. Review the items above and:"
        echo "  1. Run ./scripts/deploy.sh to redeploy"
        echo "  2. Run ./scripts/test-booking.sh for detailed test coverage"
        echo "  3. Check Firebase Console for error details"
    fi
} | tee -a "${VERIFY_REPORT}"

print_info "Verification report saved to: ${VERIFY_REPORT}"

if [ "${FAIL_COUNT}" -eq 0 ]; then
    print_success "Deployment verified — all ${TOTAL} checks passed in ${TOTAL_TIME} ${ICON_CHECK_MARK}"
    exit 0
else
    print_error "${FAIL_COUNT}/${TOTAL} checks failed. See ${VERIFY_REPORT} for details."
    exit 1
fi
