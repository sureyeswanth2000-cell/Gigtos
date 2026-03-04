#!/usr/bin/env bash
# =============================================================================
# setup-ci-cd.sh — GitHub Actions and branch protection setup for Gigtos
# =============================================================================
# Usage:
#   ./scripts/setup-ci-cd.sh [--dry-run] [--verbose] [--help]
#
# What this script does:
#   1. Checks that GitHub CLI (gh) is installed and authenticated
#   2. Enables GitHub Actions for the repository
#   3. Configures required secrets (reads from .env or prompts)
#   4. Sets up branch protection rules on the main branch
#   5. Verifies the workflows are present
#
# Exit codes:
#   0  Success
#   1  Failure
# =============================================================================

set -euo pipefail

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
    --dry-run) DRY_RUN=true  ;;
    --verbose) VERBOSE=true  ;;
    --help|-h)
      grep '^#' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) log_warning "Unknown argument: ${arg}" ;;
  esac
done

# ── Initialise ────────────────────────────────────────────────────────────────
ensure_dir "${REPORTS_DIR}"
TIMESTAMP="$(date '+%Y%m%d-%H%M%S')"
REPORT_FILE="${REPORTS_DIR}/setup-ci-cd-${TIMESTAMP}.txt"
init_log "${REPORT_FILE}"
start_timer

print_header "GIGTOS CI/CD SETUP"
[ "${DRY_RUN}" = "true" ] && log_info "DRY-RUN mode — no changes will be made"

# =============================================================================
# STEP 1 — Verify GitHub CLI
# =============================================================================
print_section "✅ GITHUB CLI CHECK"

require_command gh "GitHub CLI"

if [ "${DRY_RUN}" = "false" ]; then
  if gh auth status >/dev/null 2>&1; then
    log_success "GitHub CLI is authenticated"
    record_pass
  else
    log_error "GitHub CLI is not authenticated. Run: gh auth login"
    exit 1
  fi
else
  log_info "[DRY RUN] Would check gh auth status"
fi

# =============================================================================
# STEP 2 — Enable GitHub Actions
# =============================================================================
print_section "✅ ENABLE GITHUB ACTIONS"

if [ "${DRY_RUN}" = "true" ]; then
  log_info "[DRY RUN] Would enable GitHub Actions via: gh api repos/${GITHUB_REPO}/actions/permissions"
  record_pass
else
  start_spinner "Enabling GitHub Actions…"
  if gh api \
      --method PUT \
      "repos/${GITHUB_REPO}/actions/permissions" \
      -f enabled=true \
      -f allowed_actions=all >/dev/null 2>&1; then
    stop_spinner 0
    log_success "GitHub Actions enabled"
    record_pass
  else
    stop_spinner 1
    log_warning "Could not enable GitHub Actions via API (may already be enabled or need admin rights)"
    record_warn
  fi
fi

# =============================================================================
# STEP 3 — Configure secrets
# =============================================================================
print_section "✅ CONFIGURE REPOSITORY SECRETS"

_set_secret() {
  local secret_name="$1"
  local secret_value="$2"
  local description="${3:-${secret_name}}"

  if [ -z "${secret_value}" ]; then
    log_warning "Skipping ${description} — value is empty"
    record_warn
    return
  fi

  if [ "${DRY_RUN}" = "true" ]; then
    log_info "[DRY RUN] Would set secret: ${secret_name}"
    record_pass
    return
  fi

  if echo "${secret_value}" | gh secret set "${secret_name}" \
      --repo "${GITHUB_REPO}" >/dev/null 2>&1; then
    log_success "Secret set: ${description}"
    record_pass
  else
    log_error "Failed to set secret: ${description}"
    record_fail
  fi
}

_set_secret "FIREBASE_PROJECT_ID"  "${FIREBASE_PROJECT_ID:-}"  "Firebase Project ID"
_set_secret "FIREBASE_REGION"      "${FIREBASE_REGION:-}"      "Firebase Region"
_set_secret "GITHUB_TOKEN"         "${GITHUB_TOKEN:-}"         "GitHub Token"
_set_secret "GMAIL_USER"           "${GMAIL_USER:-}"           "Gmail user"
_set_secret "GMAIL_PASS"           "${GMAIL_PASS:-}"           "Gmail app-password"
_set_secret "TWILIO_SID"           "${TWILIO_SID:-}"           "Twilio Account SID"
_set_secret "TWILIO_TOKEN"         "${TWILIO_TOKEN:-}"         "Twilio Auth Token"
_set_secret "TWILIO_PHONE"         "${TWILIO_PHONE:-}"         "Twilio phone number"
_set_secret "SLACK_WEBHOOK_URL"    "${SLACK_WEBHOOK_URL:-}"    "Slack webhook (optional)"

# =============================================================================
# STEP 4 — Branch protection rules
# =============================================================================
print_section "✅ BRANCH PROTECTION RULES"

PROTECTION_PAYLOAD='{
  "required_status_checks": {
    "strict": true,
    "contexts": ["test-on-push"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null
}'

if [ "${DRY_RUN}" = "true" ]; then
  log_info "[DRY RUN] Would apply branch protection to: ${TARGET_BRANCH}"
  record_pass
else
  start_spinner "Applying branch protection to '${TARGET_BRANCH}'…"
  if echo "${PROTECTION_PAYLOAD}" | gh api \
      --method PUT \
      "repos/${GITHUB_REPO}/branches/${TARGET_BRANCH}/protection" \
      --input - >/dev/null 2>&1; then
    stop_spinner 0
    log_success "Branch protection applied to '${TARGET_BRANCH}'"
    record_pass
  else
    stop_spinner 1
    log_warning "Could not apply branch protection (may need admin rights or branch doesn't exist)"
    record_warn
  fi
fi

# =============================================================================
# STEP 5 — Verify workflow files
# =============================================================================
print_section "✅ VERIFY WORKFLOW FILES"

WORKFLOWS=(
  ".github/workflows/auto-deploy.yml"
  ".github/workflows/test-on-push.yml"
)

for wf in "${WORKFLOWS[@]}"; do
  if [ -f "${REPO_ROOT}/${wf}" ]; then
    log_success "Workflow file present: ${wf}"
    record_pass
  else
    log_error "Workflow file missing: ${wf}"
    record_fail
  fi
done

# =============================================================================
# SUMMARY
# =============================================================================
print_summary "CI/CD Setup Summary"

{
  printf "CI/CD SETUP REPORT — %s\n" "$(date '+%Y-%m-%d %H:%M:%S')"
  printf "%s\n\n" "$(printf '%0.s═' $(seq 1 65))"
  printf "Repo     : %s\n"  "${GITHUB_REPO}"
  printf "Branch   : %s\n"  "${TARGET_BRANCH}"
  printf "Dry-run  : %s\n"  "${DRY_RUN}"
  printf "\nPassed   : %d\n" "${SUMMARY_PASSED}"
  printf "Failed   : %d\n"  "${SUMMARY_FAILED}"
  printf "Warnings : %d\n"  "${SUMMARY_WARNED}"
  printf "Elapsed  : %s\n"  "$(elapsed_time)"
  printf "\nStatus: %s\n" "$([ "${SUMMARY_FAILED}" -eq 0 ] && echo 'SUCCESS' || echo 'FAILURE')"
} >> "${REPORT_FILE}"

log_info "Report saved to: ${REPORT_FILE}"

[ "${SUMMARY_FAILED}" -eq 0 ] && exit 0 || exit 1
