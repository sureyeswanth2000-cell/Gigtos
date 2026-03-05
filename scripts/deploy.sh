#!/usr/bin/env bash
# scripts/deploy.sh
# Main deployment orchestrator for the Gigtos createBooking Cloud Function.
#
# Usage:
#   ./scripts/deploy.sh [--dry-run] [--skip-tests] [--verbose]
#
# Flags:
#   --dry-run     Print commands without executing them.
#   --skip-tests  Skip the automated test suite after deployment.
#   --verbose     Enable verbose/debug output.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=scripts/colors.sh
source "${SCRIPT_DIR}/colors.sh"
# shellcheck source=scripts/config.sh
source "${SCRIPT_DIR}/config.sh"
# shellcheck source=scripts/utils.sh
source "${SCRIPT_DIR}/utils.sh"

# ── Parse flags ───────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --dry-run)      DRY_RUN=true ;;
    --skip-tests)   SKIP_TESTS=true ;;
    --verbose)      VERBOSE=true ;;
    --help|-h)
      echo "Usage: $0 [--dry-run] [--skip-tests] [--verbose]"
      exit 0
      ;;
    *)
      echo "Unknown flag: $arg"
      exit 1
      ;;
  esac
done

export DRY_RUN VERBOSE SKIP_TESTS

# ── Rollback state ────────────────────────────────────────────────────────────
ROLLBACK_SHA=""

perform_rollback() {
  log_warn "Initiating rollback to ${ROLLBACK_SHA}…"
  if [[ -n "$ROLLBACK_SHA" && "${DRY_RUN}" != "true" ]]; then
    cd "$REPO_ROOT"
    git checkout "$ROLLBACK_SHA" -- functions/index.js 2>/dev/null || true
    firebase deploy --only functions --project "${FIREBASE_PROJECT_ID}" 2>/dev/null || true
    log_warn "Rollback attempted. Please verify the previous state manually."
  else
    log_warn "[DRY-RUN] Would rollback to ${ROLLBACK_SHA}"
  fi
}

# ── Trap errors for rollback ──────────────────────────────────────────────────
on_error() {
  local exit_code=$?
  echo ""
  print_fail_header "DEPLOYMENT FAILED (exit ${exit_code})"
  perform_rollback
  cleanup "$exit_code"
  exit "$exit_code"
}
trap on_error ERR

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 1 – PREREQUISITES
# ─────────────────────────────────────────────────────────────────────────────
check_prerequisites() {
  print_check_header "PREREQUISITES CHECK"

  local all_ok=true
  for cmd in git node firebase gh; do
    check_command "$cmd" || all_ok=false
  done

  if [[ "$all_ok" == "false" ]]; then
    log_error "One or more required tools are missing. Install them and re-run."
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 2 – ENVIRONMENT VALIDATION
# ─────────────────────────────────────────────────────────────────────────────
check_environment() {
  print_check_header "ENVIRONMENT VALIDATION"
  init_config
  print_ok "FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}"
  local configured=0
  for var in GMAIL_USER GMAIL_PASS TWILIO_SID TWILIO_TOKEN TWILIO_PHONE; do
    [[ -n "${!var:-}" ]] && configured=$((configured + 1))
  done
  print_ok "${configured} optional notification variables configured"
  print_ok "All required variables present"
}

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 3 – MERGE PR #14
# ─────────────────────────────────────────────────────────────────────────────
merge_pr() {
  print_check_header "PR #${PR_NUMBER} MERGE"

  cd "$REPO_ROOT"

  # Store pre-merge SHA for rollback
  ROLLBACK_SHA=$(git rev-parse HEAD)
  log_debug "Rollback SHA: ${ROLLBACK_SHA}"

  if [[ "${DRY_RUN}" == "true" ]]; then
    print_warn "[DRY-RUN] Would fetch origin and merge PR #${PR_NUMBER}"
    return 0
  fi

  # Fetch latest
  git fetch origin
  print_ok "Fetched latest changes"

  # Check if PR is already merged into current branch
  local pr_sha
  pr_sha=$(gh pr view "${PR_NUMBER}" --json mergeCommit --jq '.mergeCommit.oid' 2>/dev/null || echo "")
  if [[ -n "$pr_sha" ]]; then
    print_ok "PR #${PR_NUMBER} already merged (commit: ${pr_sha:0:12})"
    return 0
  fi

  # Merge the PR
  gh pr merge "${PR_NUMBER}" \
    --merge \
    --auto \
    --subject "Merge PR #${PR_NUMBER}: createBooking Cloud Function" \
    2>&1 | tee /tmp/gigtos_deploy_merge.tmp || true

  local merge_output
  merge_output=$(cat /tmp/gigtos_deploy_merge.tmp)

  if echo "$merge_output" | grep -qi "merged\|already"; then
    local new_sha
    new_sha=$(git rev-parse HEAD)
    print_ok "Merged PR #${PR_NUMBER} (commit: ${new_sha:0:12})"
  else
    log_error "PR merge may not have completed. Output: ${merge_output}"
    return 1
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 4 – INSTALL DEPENDENCIES
# ─────────────────────────────────────────────────────────────────────────────
install_dependencies() {
  print_check_header "DEPENDENCY INSTALLATION"

  if [[ "${DRY_RUN}" == "true" ]]; then
    print_warn "[DRY-RUN] Would run: npm install in ${FUNCTIONS_DIR}"
    return 0
  fi

  cd "${FUNCTIONS_DIR}"
  npm install --prefer-offline 2>&1 | tail -5
  local dep_count
  dep_count=$(npm list --depth=0 2>/dev/null | tail -n +2 | wc -l | tr -d ' ')
  print_ok "Installed ${dep_count} npm dependencies"
  cd "$REPO_ROOT"
}

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 5 – DEPLOY CLOUD FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────
deploy_functions() {
  print_check_header "CLOUD FUNCTIONS DEPLOYMENT"

  local deploy_start
  deploy_start=$(date +%s)

  if [[ "${DRY_RUN}" == "true" ]]; then
    print_warn "[DRY-RUN] Would run: firebase deploy --only functions --project ${FIREBASE_PROJECT_ID}"
    return 0
  fi

  firebase deploy \
    --only functions \
    --project "${FIREBASE_PROJECT_ID}" \
    --force \
    2>&1 | tee /tmp/gigtos_deploy_firebase.tmp

  local deploy_end
  deploy_end=$(date +%s)
  local deploy_time
  deploy_time=$(echo "scale=1; (${deploy_end} - ${deploy_start})" | bc 2>/dev/null || echo "$((deploy_end - deploy_start))")

  print_ok "Cloud Functions deployed"
  print_ok "Deployment Time: ${deploy_time}s"

  # Poll for ACTIVE status (best-effort)
  poll_deployment "createBooking" "${FIREBASE_PROJECT_ID}" "${FIREBASE_REGION}" 12 || \
    log_warn "Could not confirm ACTIVE status via CLI; check Firebase console."
}

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 6 – RUN TESTS
# ─────────────────────────────────────────────────────────────────────────────
run_tests() {
  if [[ "${SKIP_TESTS}" == "true" ]]; then
    print_warn "Tests skipped (--skip-tests flag)"
    return 0
  fi

  print_check_header "RUNNING TEST SUITE"
  bash "${SCRIPT_DIR}/test-booking.sh"
}

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 7 – GENERATE REPORT
# ─────────────────────────────────────────────────────────────────────────────
generate_report() {
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  local total_time
  total_time=$(elapsed_time)

  local report
  report="${DIVIDER}
  DEPLOYMENT REPORT - ${timestamp}
${DIVIDER}

${SYM_CHECK} PREREQUISITES CHECK
   ${SYM_OK} Git $(git --version 2>/dev/null | head -1)
   ${SYM_OK} Node.js $(node --version 2>/dev/null)
   ${SYM_OK} Firebase CLI $(firebase --version 2>/dev/null | head -1)
   ${SYM_OK} GitHub CLI $(gh --version 2>/dev/null | head -1)

${SYM_CHECK} ENVIRONMENT VALIDATION
   ${SYM_OK} FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}
   ${SYM_OK} FIREBASE_REGION=${FIREBASE_REGION}

${SYM_CHECK} PR #${PR_NUMBER} MERGE
   ${SYM_OK} Merged createBooking Cloud Function

${SYM_CHECK} CLOUD FUNCTIONS DEPLOYMENT
   ${SYM_OK} Deployed createBooking function
   ${SYM_OK} Project: ${FIREBASE_PROJECT_ID}

${SYM_CHECK} TESTS
   $( [[ "${SKIP_TESTS}" == "true" ]] && echo "${SYM_WARN} Tests skipped" || echo "${SYM_OK} Test suite executed" )

📊 SUMMARY
   Status: ${SYM_CHECK} SUCCESS
   Total Execution Time: ${total_time}
   DRY_RUN: ${DRY_RUN}
${DIVIDER}"

  save_report "deploy-report" "$report"
  echo ""
  echo -e "$report"
}

# ─────────────────────────────────────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────────────────────────────────────
main() {
  print_header "GIGTOS DEPLOYMENT PIPELINE" "PR #${PR_NUMBER:-14} – createBooking Cloud Function"

  init_logging "deploy"

  check_prerequisites
  check_environment
  merge_pr
  install_dependencies
  deploy_functions
  run_tests
  generate_report

  echo ""
  print_check_header "DEPLOYMENT COMPLETE"
  log_success "All steps finished successfully. Total time: $(elapsed_time)"
}

main "$@"
