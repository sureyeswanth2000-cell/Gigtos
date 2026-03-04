#!/usr/bin/env bash
# =============================================================================
# deploy.sh — Main deployment orchestrator for Gigtos PR #14
# =============================================================================
# Usage:
#   ./scripts/deploy.sh [--dry-run] [--skip-tests] [--verbose] [--help]
#
# Options:
#   --dry-run      Print actions without executing them
#   --skip-tests   Skip the automated test suite after deployment
#   --verbose      Enable verbose output
#   --help         Show this help message
#
# Exit codes:
#   0  Success
#   1  Failure (check the report in reports/)
# =============================================================================

set -euo pipefail

# ── Resolve paths ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/colors.sh
source "${SCRIPT_DIR}/colors.sh"
# shellcheck source=scripts/utils.sh
source "${SCRIPT_DIR}/utils.sh"
# shellcheck source=scripts/config.sh
source "${SCRIPT_DIR}/config.sh"

# ── Parse arguments ───────────────────────────────────────────────────────────
for arg in "$@"; do
  case "${arg}" in
    --dry-run)     DRY_RUN=true   ;;
    --skip-tests)  SKIP_TESTS=true ;;
    --verbose)     VERBOSE=true   ;;
    --help|-h)
      grep '^#' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) log_warning "Unknown argument: ${arg}" ;;
  esac
done

# ── Initialise log & timer ────────────────────────────────────────────────────
ensure_dir "${REPORTS_DIR}"
TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
REPORT_FILE="${REPORTS_DIR}/deploy-report-${TIMESTAMP}.txt"
init_log "${REPORT_FILE}"
start_timer

print_header "GIGTOS DEPLOYMENT — PR #${PR_NUMBER}"
[ "${DRY_RUN}" = "true"  ] && log_info "DRY-RUN mode enabled — no real changes will be made"
[ "${VERBOSE}" = "true"  ] && log_info "Verbose output enabled"

# ── Rollback state ────────────────────────────────────────────────────────────
_ROLLBACK_NEEDED=false

_rollback() {
  if [ "${_ROLLBACK_NEEDED}" = "true" ]; then
    echo ""
    log_warning "Initiating rollback…"
    run_cmd firebase deploy --only functions --force 2>/dev/null || true
    log_info "Rollback attempted. Review Firebase console for current state."
  fi
}

_on_exit() {
  local exit_code=$?
  _rollback
  # Only call stop_spinner if one is actually running
  [ -n "${_SPINNER_PID:-}" ] && stop_spinner "${exit_code}" || true
}
trap '_on_exit' EXIT

# =============================================================================
# STEP 1 — Prerequisites check
# =============================================================================
print_section "✅ PREREQUISITES CHECK"

PREREQS_OK=true

check_prereq() {
  local cmd="$1"
  local display="$2"
  if command -v "${cmd}" >/dev/null 2>&1; then
    local ver
    ver="$("${cmd}" --version 2>&1 | head -n1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1 || true)"
    log_success "${display}${ver:+ v${ver}}"
    record_pass
  else
    log_error "${display} not found — please install it"
    record_fail
    PREREQS_OK=false
  fi
}

check_prereq git      "Git"
check_prereq node     "Node.js"
check_prereq npm      "npm"
check_prereq firebase "Firebase CLI"
check_prereq gh       "GitHub CLI"

if [ "${PREREQS_OK}" = "false" ]; then
  log_error "Missing prerequisites. Install them and re-run this script."
  exit 1
fi

# =============================================================================
# STEP 2 — Environment validation
# =============================================================================
print_section "✅ ENVIRONMENT VALIDATION"

ENV_OK=true
validate_config || ENV_OK=false

if [ "${ENV_OK}" = "false" ]; then
  log_error "Environment not fully configured. Check .env (see .env.example)."
  exit 1
fi
record_pass

# =============================================================================
# STEP 3 — Merge PR #14
# =============================================================================
print_section "✅ PR #${PR_NUMBER} MERGE"

start_spinner "Checking PR #${PR_NUMBER} status…"
PR_STATE="$(gh pr view "${PR_NUMBER}" --repo "${GITHUB_REPO}" --json state --jq '.state' 2>/dev/null || echo "UNKNOWN")"
stop_spinner 0

if [ "${PR_STATE}" = "MERGED" ]; then
  log_info "PR #${PR_NUMBER} is already merged"
  record_pass
elif [ "${PR_STATE}" = "OPEN" ]; then
  start_spinner "Merging PR #${PR_NUMBER}…"
  if run_cmd gh pr merge "${PR_NUMBER}" \
        --repo "${GITHUB_REPO}" \
        --merge \
        --auto \
        --delete-branch 2>/dev/null; then
    stop_spinner 0
    log_success "PR #${PR_NUMBER} merged successfully"
    record_pass
  else
    stop_spinner 1
    log_error "Failed to merge PR #${PR_NUMBER}"
    record_fail
    exit 1
  fi
else
  log_warning "PR #${PR_NUMBER} state is '${PR_STATE}' — skipping merge"
  record_warn
fi

# =============================================================================
# STEP 4 — Install dependencies
# =============================================================================
print_section "✅ INSTALL DEPENDENCIES"

start_spinner "Installing Cloud Functions dependencies…"
if run_cmd bash -c "cd '${FUNCTIONS_DIR}' && npm install --silent"; then
  stop_spinner 0
  log_success "Dependencies installed"
  record_pass
else
  stop_spinner 1
  log_error "npm install failed"
  record_fail
  exit 1
fi

# =============================================================================
# STEP 5 — Deploy Cloud Functions
# =============================================================================
print_section "✅ CLOUD FUNCTIONS DEPLOYMENT"

_ROLLBACK_NEEDED=true   # Enable rollback from this point on

start_spinner "Deploying Cloud Functions to ${FIREBASE_PROJECT_ID}…"
if run_cmd firebase deploy \
      --only functions \
      --project "${FIREBASE_PROJECT_ID}" \
      --force 2>/dev/null; then
  stop_spinner 0
  log_success "Cloud Functions deployed"
  record_pass
  _ROLLBACK_NEEDED=false
else
  stop_spinner 1
  log_error "Firebase deploy failed"
  record_fail
  exit 1
fi

# Wait for functions to become active
wait_for_deployment "createBooking" 12

# =============================================================================
# STEP 6 — Run tests
# =============================================================================
if [ "${SKIP_TESTS}" = "true" ]; then
  print_section "⏭  TESTS SKIPPED (--skip-tests)"
  log_info "Automated tests were skipped by request"
  record_warn
else
  print_section "✅ AUTOMATED TESTS"
  start_spinner "Running booking test suite…"
  if run_cmd bash "${SCRIPT_DIR}/test-booking.sh" ${DRY_RUN:+--dry-run}; then
    stop_spinner 0
    log_success "All tests passed"
    record_pass
  else
    stop_spinner 1
    log_error "Test suite reported failures — check the test report"
    record_fail
    # Tests failing does not trigger rollback of Cloud Functions
  fi
fi

# =============================================================================
# STEP 7 — Summary & report
# =============================================================================
print_section "📊 DEPLOYMENT SUMMARY"

printf "   Status       : "
if [ "${SUMMARY_FAILED}" -eq 0 ]; then
  printf "${COLOR_GREEN}${COLOR_BOLD}SUCCESS${COLOR_RESET}\n"
else
  printf "${COLOR_RED}${COLOR_BOLD}FAILURE (${SUMMARY_FAILED} issue(s))${COLOR_RESET}\n"
fi
printf "   Project      : %s\n" "${FIREBASE_PROJECT_ID}"
printf "   PR merged    : #%s\n" "${PR_NUMBER}"
printf "   Report file  : %s\n" "${REPORT_FILE}"
printf "   Total time   : %s\n" "$(elapsed_time)"

print_separator
echo ""

# Write a plain-text report
{
  printf "DEPLOYMENT REPORT — %s\n" "$(date '+%Y-%m-%d %H:%M:%S')"
  printf "%s\n\n" "$(printf '%0.s═' $(seq 1 65))"
  printf "Project    : %s\n" "${FIREBASE_PROJECT_ID}"
  printf "PR         : #%s\n" "${PR_NUMBER}"
  printf "Branch     : %s\n" "${TARGET_BRANCH}"
  printf "Dry-run    : %s\n" "${DRY_RUN}"
  printf "Skip tests : %s\n" "${SKIP_TESTS}"
  printf "\nChecks passed  : %d\n" "${SUMMARY_PASSED}"
  printf "Checks failed  : %d\n"  "${SUMMARY_FAILED}"
  printf "Warnings       : %d\n"  "${SUMMARY_WARNED}"
  printf "Elapsed time   : %s\n"  "$(elapsed_time)"
  printf "\nStatus: %s\n" "$([ "${SUMMARY_FAILED}" -eq 0 ] && echo SUCCESS || echo FAILURE)"
} >> "${REPORT_FILE}"

log_info "Full log saved to: ${REPORT_FILE}"

[ "${SUMMARY_FAILED}" -eq 0 ] && exit 0 || exit 1
