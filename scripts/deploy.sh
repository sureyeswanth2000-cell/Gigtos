#!/bin/bash
# deploy.sh - Main deployment script for Gigtos
#
# Usage: ./scripts/deploy.sh [--dry-run] [--skip-tests]
#
#   --dry-run      Print what would happen without making changes
#   --skip-tests   Skip post-deploy test run
#
# Required environment variables (set in .env or export before running):
#   FIREBASE_PROJECT_ID   Your Firebase project ID
#
# Optional environment variables:
#   GITHUB_TOKEN          Personal access token for gh CLI (if not already logged in)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=config.sh
source "${SCRIPT_DIR}/config.sh"
# shellcheck source=utils.sh
source "${SCRIPT_DIR}/utils.sh"

# ─── Parse CLI flags ──────────────────────────────────────────────────────────
SKIP_TESTS=false
parse_flags "$@"

# ─── Initialise log and timer ─────────────────────────────────────────────────
set_log_file "${DEPLOY_REPORT}"
start_timer

# ─── Rollback support ─────────────────────────────────────────────────────────
ORIGINAL_COMMIT=""
ROLLBACK_NEEDED=false

rollback() {
    if [ "${ROLLBACK_NEEDED}" = true ] && [ -n "${ORIGINAL_COMMIT}" ]; then
        print_warning "Rolling back to commit ${ORIGINAL_COMMIT}…"
        git reset --hard "${ORIGINAL_COMMIT}" 2>/dev/null || true
        print_warning "Rollback complete. Review logs at: ${DEPLOY_REPORT}"
    fi
}
trap rollback ERR

# ─── Banner ───────────────────────────────────────────────────────────────────
print_section "GIGTOS DEPLOYMENT SCRIPT  ${ICON_ROCKET}"
print_info "Timestamp : $(date '+%Y-%m-%d %H:%M:%S')"
print_info "Project   : ${PROJECT_ROOT}"
print_info "Log file  : ${DEPLOY_REPORT}"
if [ "${DRY_RUN}" = true ]; then
    print_warning "DRY-RUN MODE — no changes will be made"
fi

# ─── Step 1: Prerequisites ────────────────────────────────────────────────────
print_section "STEP 1 — PREREQUISITES CHECK"
if ! check_all_prerequisites; then
    print_error "One or more prerequisites are missing. Aborting."
    exit 1
fi

# ─── Step 2: Environment validation ──────────────────────────────────────────
print_section "STEP 2 — ENVIRONMENT VALIDATION"
if ! validate_env; then
    exit 1
fi

print_subsection "Firebase Authentication"
if ! firebase_check_auth; then
    exit 1
fi

print_subsection "Git Repository State"
if ! is_git_repo "${PROJECT_ROOT}"; then
    print_error "Not a git repository: ${PROJECT_ROOT}"
    exit 1
fi
print_success "Git repository detected"

if ! stash_changes; then
    print_error "Failed to stash local changes. Resolve conflicts and retry."
    exit 1
fi

ORIGINAL_COMMIT=$(git rev-parse HEAD)
print_success "Current commit: ${ORIGINAL_COMMIT}"

# ─── Step 3: Fetch latest code ────────────────────────────────────────────────
print_section "STEP 3 — FETCH LATEST CODE"
print_step "Fetching from origin…"
run_cmd git fetch origin
print_success "Fetch complete"

# ─── Step 4: Merge PR #14 ─────────────────────────────────────────────────────
print_section "STEP 4 — MERGE PR #${PR_NUMBER}"
ROLLBACK_NEEDED=true

PR_STATE=$(gh_pr_state "${PR_NUMBER}")

if [ "${PR_STATE}" = "MERGED" ]; then
    print_info "PR #${PR_NUMBER} is already merged."
elif [ "${PR_STATE}" = "OPEN" ]; then
    gh_pr_merge "${PR_NUMBER}"
    print_success "PR #${PR_NUMBER} merged successfully"
else
    print_warning "PR #${PR_NUMBER} state is '${PR_STATE}'. Attempting merge anyway…"
    gh_pr_merge "${PR_NUMBER}" || {
        print_error "Could not merge PR #${PR_NUMBER}. Check GitHub for conflicts."
        exit 1
    }
fi

MERGED_COMMIT=$(git rev-parse HEAD)
print_success "HEAD is now at: ${MERGED_COMMIT}"

# ─── Step 5: Install dependencies ────────────────────────────────────────────
print_section "STEP 5 — INSTALL DEPENDENCIES"
npm_install "${FUNCTIONS_DIR}"
print_success "Dependencies installed in functions/"

# ─── Step 6: Deploy Cloud Functions ──────────────────────────────────────────
print_section "STEP 6 — DEPLOY CLOUD FUNCTIONS"
DEPLOY_START=$(date +%s)
firebase_deploy_functions "${FIREBASE_PROJECT_ID}"
DEPLOY_END=$(date +%s)
DEPLOY_TIME=$(( DEPLOY_END - DEPLOY_START ))
print_success "Cloud Functions deployed in ${DEPLOY_TIME}s"

# ─── Step 7: Run tests ────────────────────────────────────────────────────────
TEST_STATUS="SKIPPED"
if [ "${SKIP_TESTS}" = false ]; then
    print_section "STEP 7 — RUN POST-DEPLOY TESTS"
    if bash "${SCRIPT_DIR}/test-booking.sh"; then
        TEST_STATUS="PASSED"
        print_success "All tests passed"
    else
        TEST_STATUS="FAILED"
        print_warning "Some tests failed — check test report for details"
    fi
else
    print_section "STEP 7 — RUN POST-DEPLOY TESTS (SKIPPED)"
    print_info "Tests skipped via --skip-tests flag"
fi

# ─── Step 8: Deployment summary ───────────────────────────────────────────────
TOTAL_TIME=$(elapsed_time)
ROLLBACK_NEEDED=false

print_section "DEPLOYMENT REPORT — $(date '+%Y-%m-%d %H:%M:%S')"

{
    report_section "DEPLOYMENT REPORT — $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    echo "✅ PREREQUISITES CHECK"
    echo "   ✓ git / node / npm / firebase-cli / gh-cli verified"
    echo ""
    echo "✅ ENVIRONMENT VALIDATION"
    echo "   ✓ FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}"
    echo "   ✓ Firebase authenticated"
    echo ""
    echo "✅ PR #${PR_NUMBER} MERGE"
    echo "   ✓ Merged commit: ${MERGED_COMMIT}"
    echo ""
    echo "✅ CLOUD FUNCTIONS DEPLOYMENT"
    echo "   ✓ Deployed in ${DEPLOY_TIME}s"
    echo ""
    echo "📋 TESTS: ${TEST_STATUS}"
    echo ""
    echo "⏱  Total Time: ${TOTAL_TIME}"
    echo "📄 Full log  : ${DEPLOY_REPORT}"
} | tee -a "${DEPLOY_REPORT}"

print_section "DEPLOYMENT COMPLETE ${ICON_CHECK_MARK}"
print_info "Full deployment log saved to: ${DEPLOY_REPORT}"
print_info "Total time: ${TOTAL_TIME}"
