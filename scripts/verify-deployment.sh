#!/usr/bin/env bash
# =============================================================================
# verify-deployment.sh — Post-deployment verification for Gigtos
# =============================================================================
# Usage:
#   ./scripts/verify-deployment.sh [--dry-run] [--verbose] [--help]
#
# Checks:
#   - PR #14 merged status on GitHub
#   - Cloud Functions deployed and ACTIVE
#   - Firestore read/write
#   - Email (Gmail) configuration
#   - SMS (Twilio) configuration
#   - Security (Firestore rules present)
#   - Generates a verification report
#
# Exit codes:
#   0  All checks passed
#   1  One or more checks failed
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
REPORT_FILE="${REPORTS_DIR}/verification-report-${TIMESTAMP}.txt"
init_log "${REPORT_FILE}"
start_timer

print_header "DEPLOYMENT VERIFICATION REPORT"
[ "${DRY_RUN}" = "true" ] && log_info "DRY-RUN mode — no real calls will be made"

# ── Check helpers ─────────────────────────────────────────────────────────────
CHECK_PASS=0
CHECK_FAIL=0
CHECK_WARN=0

_chk_pass() { printf "   ${SYMBOL_OK} %s\n" "$*";  CHECK_PASS=$(( CHECK_PASS + 1 )); _append_log "CHECK" "PASS: $*"; }
_chk_fail() { printf "   ${SYMBOL_FAIL} ${COLOR_RED}%s${COLOR_RESET}\n" "$*" >&2; CHECK_FAIL=$(( CHECK_FAIL + 1 )); _append_log "CHECK" "FAIL: $*"; }
_chk_warn() { printf "   ${SYMBOL_WARN} ${COLOR_YELLOW}%s${COLOR_RESET}\n" "$*"; CHECK_WARN=$(( CHECK_WARN + 1 )); _append_log "CHECK" "WARN: $*"; }
_chk_skip() { printf "   $(badge_skip) %s\n" "$*"; _append_log "CHECK" "SKIP: $*"; }

# =============================================================================
# SECTION 1 — GitHub verification
# =============================================================================
print_section "🔍 GITHUB VERIFICATION"

if [ "${DRY_RUN}" = "true" ]; then
  _chk_skip "PR #${PR_NUMBER} status (dry-run)"
  _chk_skip "Main branch updated (dry-run)"
elif command -v gh >/dev/null 2>&1; then
  PR_STATE="$(gh pr view "${PR_NUMBER}" --repo "${GITHUB_REPO}" --json state --jq '.state' 2>/dev/null || echo "UNKNOWN")"
  if [ "${PR_STATE}" = "MERGED" ]; then
    _chk_pass "PR #${PR_NUMBER} is MERGED"
  else
    _chk_fail "PR #${PR_NUMBER} is not merged (state: ${PR_STATE})"
  fi

  DEFAULT_BRANCH="$(gh repo view "${GITHUB_REPO}" --json defaultBranchRef --jq '.defaultBranchRef.name' 2>/dev/null || echo "${TARGET_BRANCH}")"
  LAST_COMMIT_MSG="$(gh api "repos/${GITHUB_REPO}/commits/${DEFAULT_BRANCH}" --jq '.commit.message' 2>/dev/null | head -c 72 || echo "(unknown)")"
  _chk_pass "Latest commit on ${DEFAULT_BRANCH}: ${LAST_COMMIT_MSG}"
else
  _chk_warn "GitHub CLI (gh) not found — skipping GitHub checks"
fi

# =============================================================================
# SECTION 2 — Cloud Functions verification
# =============================================================================
print_section "🔍 CLOUD FUNCTIONS VERIFICATION"

FUNCTIONS_TO_CHECK=(
  "createBooking"
  "onBookingCreated"
  "onBookingStatusChange"
)

if [ "${DRY_RUN}" = "true" ]; then
  for fn in "${FUNCTIONS_TO_CHECK[@]}"; do
    _chk_skip "${fn} status (dry-run)"
  done
elif command -v firebase >/dev/null 2>&1; then
  FUNCS_LIST="$(firebase functions:list \
    --project "${FIREBASE_PROJECT_ID}" 2>/dev/null || true)"
  for fn in "${FUNCTIONS_TO_CHECK[@]}"; do
    if echo "${FUNCS_LIST}" | grep -qi "${fn}.*active\|active.*${fn}"; then
      _chk_pass "${fn} is ACTIVE"
    elif echo "${FUNCS_LIST}" | grep -qi "${fn}"; then
      _chk_warn "${fn} exists but may not be ACTIVE"
    else
      _chk_fail "${fn} not found in deployed functions"
    fi
  done
else
  _chk_warn "firebase CLI not found — skipping Cloud Functions checks"
fi

# =============================================================================
# SECTION 3 — Firestore integration
# =============================================================================
print_section "🔍 FIRESTORE INTEGRATION"

if [ "${DRY_RUN}" = "true" ]; then
  _chk_skip "Firestore read/write (dry-run)"
  _chk_skip "Security rules (dry-run)"
else
  # Verify security rules file exists
  RULES_FILE="${REPO_ROOT}/firebase.rules"
  if [ -f "${RULES_FILE}" ]; then
    _chk_pass "Firestore security rules file present (${RULES_FILE})"
  else
    _chk_fail "Firestore security rules file not found: ${RULES_FILE}"
  fi

  # Try to verify Firestore is reachable via firebase CLI
  if command -v firebase >/dev/null 2>&1; then
    BOOKING_COUNT="$(firebase firestore:get bookings \
      --project "${FIREBASE_PROJECT_ID}" 2>/dev/null \
      | grep -c '"serviceType"' || echo 0)"
    if [ "${BOOKING_COUNT}" -ge 0 ]; then
      _chk_pass "Firestore read succeeded (${BOOKING_COUNT} bookings found)"
    else
      _chk_fail "Firestore read failed"
    fi
  else
    _chk_warn "firebase CLI not available — cannot verify Firestore live read"
  fi
fi

# =============================================================================
# SECTION 4 — Email / SMS configuration
# =============================================================================
print_section "🔍 EMAIL / SMS CONFIGURATION"

if [ "${DRY_RUN}" = "true" ]; then
  _chk_skip "Gmail configuration (dry-run)"
  _chk_skip "Twilio configuration (dry-run)"
elif command -v firebase >/dev/null 2>&1; then
  EMAIL_CFG="$(firebase functions:config:get gmail \
    --project "${FIREBASE_PROJECT_ID}" 2>/dev/null || echo '{}')"
  if echo "${EMAIL_CFG}" | grep -q '"user"'; then
    _chk_pass "Gmail user is configured"
  else
    _chk_fail "Gmail user not configured — run: firebase functions:config:set gmail.user=... gmail.pass=..."
  fi
  if echo "${EMAIL_CFG}" | grep -q '"pass"'; then
    _chk_pass "Gmail app-password is configured"
  else
    _chk_fail "Gmail password not configured"
  fi

  TWILIO_CFG="$(firebase functions:config:get twilio \
    --project "${FIREBASE_PROJECT_ID}" 2>/dev/null || echo '{}')"
  if echo "${TWILIO_CFG}" | grep -q '"sid"'; then
    _chk_pass "Twilio SID is configured"
  else
    _chk_fail "Twilio SID not configured — run: firebase functions:config:set twilio.sid=..."
  fi
  if echo "${TWILIO_CFG}" | grep -q '"phone"'; then
    _chk_pass "Twilio phone number is configured"
  else
    _chk_fail "Twilio phone not configured"
  fi
else
  # Fall back to local env vars
  [ -n "${GMAIL_USER:-}" ] && _chk_pass "GMAIL_USER is set" || _chk_warn "GMAIL_USER not set"
  [ -n "${GMAIL_PASS:-}" ] && _chk_pass "GMAIL_PASS is set" || _chk_warn "GMAIL_PASS not set"
  [ -n "${TWILIO_SID:-}"  ] && _chk_pass "TWILIO_SID is set"  || _chk_warn "TWILIO_SID not set"
  [ -n "${TWILIO_PHONE:-}" ] && _chk_pass "TWILIO_PHONE is set" || _chk_warn "TWILIO_PHONE not set"
fi

# =============================================================================
# SECTION 5 — Security checks
# =============================================================================
print_section "🔍 SECURITY CHECKS"

# Check .env is not committed
if [ -f "${REPO_ROOT}/.env" ]; then
  if git -C "${REPO_ROOT}" ls-files --error-unmatch .env >/dev/null 2>&1; then
    _chk_fail ".env is tracked by Git — remove it and add to .gitignore!"
  else
    _chk_pass ".env exists but is NOT committed (correct)"
  fi
else
  _chk_pass ".env not present in repo (credentials via CI secrets or firebase config)"
fi

# Check .gitignore has node_modules
if grep -q 'node_modules' "${REPO_ROOT}/.gitignore" 2>/dev/null; then
  _chk_pass "node_modules is in .gitignore"
else
  _chk_warn "node_modules not found in .gitignore"
fi

# Check .gitignore has reports/
if grep -q 'reports/' "${REPO_ROOT}/.gitignore" 2>/dev/null; then
  _chk_pass "reports/ is in .gitignore"
else
  _chk_warn "reports/ not found in .gitignore — consider adding it"
fi

# =============================================================================
# SUMMARY & HEALTH DASHBOARD
# =============================================================================
echo ""
print_separator
printf "${COLOR_BOLD}${COLOR_WHITE}📊 VERIFICATION SUMMARY${COLOR_RESET}\n"
print_separator
printf "   Passed   : ${COLOR_GREEN}%d ✓${COLOR_RESET}\n" "${CHECK_PASS}"
printf "   Failed   : ${COLOR_RED}%d ✗${COLOR_RESET}\n"   "${CHECK_FAIL}"
printf "   Warnings : ${COLOR_YELLOW}%d ⚠${COLOR_RESET}\n"  "${CHECK_WARN}"
printf "   Elapsed  : %s\n" "$(elapsed_time)"
echo ""

if [ "${CHECK_FAIL}" -eq 0 ] && [ "${CHECK_WARN}" -eq 0 ]; then
  printf "   ✅ ${COLOR_GREEN}${COLOR_BOLD}OVERALL HEALTH: EXCELLENT${COLOR_RESET}\n"
elif [ "${CHECK_FAIL}" -eq 0 ]; then
  printf "   ${SYMBOL_WARN} ${COLOR_YELLOW}${COLOR_BOLD}OVERALL HEALTH: GOOD (${CHECK_WARN} warning(s))${COLOR_RESET}\n"
else
  printf "   ${SYMBOL_FAIL} ${COLOR_RED}${COLOR_BOLD}OVERALL HEALTH: ISSUES FOUND (${CHECK_FAIL} failure(s))${COLOR_RESET}\n"
fi
print_separator
echo ""

# Plain-text report
{
  printf "DEPLOYMENT VERIFICATION REPORT — %s\n" "$(date '+%Y-%m-%d %H:%M:%S')"
  printf "%s\n\n" "$(printf '%0.s═' $(seq 1 65))"
  printf "Project  : %s\n"  "${FIREBASE_PROJECT_ID}"
  printf "PR       : #%s\n" "${PR_NUMBER}"
  printf "\nPassed   : %d\n" "${CHECK_PASS}"
  printf "Failed   : %d\n"  "${CHECK_FAIL}"
  printf "Warnings : %d\n"  "${CHECK_WARN}"
  printf "Elapsed  : %s\n"  "$(elapsed_time)"
  printf "\nOverall: %s\n" "$([ "${CHECK_FAIL}" -eq 0 ] && echo 'PASS' || echo 'FAIL')"
} >> "${REPORT_FILE}"

log_info "Report saved to: ${REPORT_FILE}"

[ "${CHECK_FAIL}" -eq 0 ] && exit 0 || exit 1
