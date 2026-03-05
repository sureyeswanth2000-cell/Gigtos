#!/usr/bin/env bash
# scripts/verify-deployment.sh
# Post-deployment verification: checks PR merge, function status, Firestore,
# notifications, security rules, and API key exposure.
#
# Usage:
#   ./scripts/verify-deployment.sh [--verbose]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# shellcheck source=scripts/colors.sh
source "${SCRIPT_DIR}/colors.sh"
# shellcheck source=scripts/config.sh
source "${SCRIPT_DIR}/config.sh"
# shellcheck source=scripts/utils.sh
source "${SCRIPT_DIR}/utils.sh"

[[ "${1:-}" == "--verbose" ]] && VERBOSE=true

# ── Check state ───────────────────────────────────────────────────────────────
CHECKS_PASSED=0
CHECKS_FAILED=0
CHECKS_WARNED=0
RECOMMENDATIONS=()

pass_check() {
  CHECKS_PASSED=$((CHECKS_PASSED + 1))
  print_ok "$*"
}

fail_check() {
  CHECKS_FAILED=$((CHECKS_FAILED + 1))
  print_fail "$*"
}

warn_check() {
  CHECKS_WARNED=$((CHECKS_WARNED + 1))
  print_warn "$*"
  RECOMMENDATIONS+=("$*")
}

# ─────────────────────────────────────────────────────────────────────────────
#  CHECK 1 – PR #14 merged into main
# ─────────────────────────────────────────────────────────────────────────────
check_pr_merged() {
  print_check_header "PR #14 MERGE STATUS"

  local pr_state
  pr_state=$(gh pr view 14 --json state,mergedAt --jq '.state' 2>/dev/null || echo "UNKNOWN")

  case "${pr_state^^}" in
    MERGED)
      pass_check "PR #14 is merged into main"
      ;;
    OPEN)
      warn_check "PR #14 is still open – run deploy.sh to merge"
      ;;
    CLOSED)
      fail_check "PR #14 was closed without merging"
      ;;
    *)
      warn_check "Could not determine PR #14 state (gh CLI not configured?)"
      ;;
  esac
}

# ─────────────────────────────────────────────────────────────────────────────
#  CHECK 2 – Cloud Functions deployed and ACTIVE
# ─────────────────────────────────────────────────────────────────────────────
check_functions_active() {
  print_check_header "CLOUD FUNCTIONS STATUS"

  if ! command -v firebase &>/dev/null; then
    warn_check "firebase CLI not found – skipping function status check"
    return
  fi

  local functions_output
  functions_output=$(firebase functions:list --project "${FIREBASE_PROJECT_ID}" 2>/dev/null || echo "")

  if echo "$functions_output" | grep -qi "createBooking"; then
    if echo "$functions_output" | grep -i "createBooking" | grep -qi "ACTIVE"; then
      pass_check "createBooking – ACTIVE"
    else
      local status
      status=$(echo "$functions_output" | grep -i "createBooking" | awk '{print $NF}')
      warn_check "createBooking – status: ${status:-UNKNOWN}"
    fi
  else
    fail_check "createBooking not found in deployed functions"
    RECOMMENDATIONS+=("Run: firebase deploy --only functions --project ${FIREBASE_PROJECT_ID}")
  fi

  # Also check onBookingCreated trigger
  if echo "$functions_output" | grep -qi "onBookingCreated"; then
    pass_check "onBookingCreated trigger – present"
  else
    warn_check "onBookingCreated trigger not found (may affect notifications)"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
#  CHECK 3 – Firestore collections accessible
# ─────────────────────────────────────────────────────────────────────────────
check_firestore() {
  print_check_header "FIRESTORE COLLECTIONS"

  # Check firebase.rules exists
  local rules_file="${REPO_ROOT}/firebase.rules"
  if [[ -f "$rules_file" ]]; then
    pass_check "Firestore rules file present (${rules_file})"
  else
    warn_check "firebase.rules not found"
    RECOMMENDATIONS+=("Ensure firebase.rules is committed to the repository")
  fi

  # Check firebase.json references rules
  local fb_json="${REPO_ROOT}/firebase.json"
  if [[ -f "$fb_json" ]]; then
    if grep -q "firebase.rules\|rules" "$fb_json"; then
      pass_check "firebase.json references Firestore rules"
    else
      warn_check "firebase.json may not reference Firestore rules"
    fi
    if grep -q '"functions"' "$fb_json"; then
      pass_check "firebase.json has functions configuration"
    else
      warn_check "firebase.json missing functions configuration"
    fi
  else
    fail_check "firebase.json not found"
  fi

  # Check functions source references bookings collection
  local func_file="${REPO_ROOT}/functions/index.js"
  if grep -q "collection('bookings')\|collection(\"bookings\")" "$func_file"; then
    pass_check "bookings collection referenced in Cloud Functions"
  else
    warn_check "bookings collection reference not found in functions/index.js"
  fi

  if grep -q "activity_logs\|admins" "$func_file"; then
    pass_check "Supporting collections (activity_logs, admins) referenced"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
#  CHECK 4 – Email/SMS configuration
# ─────────────────────────────────────────────────────────────────────────────
check_notifications() {
  print_check_header "EMAIL/SMS CONFIGURATION"

  # Gmail
  if [[ -n "${GMAIL_USER:-}" && -n "${GMAIL_PASS:-}" ]]; then
    pass_check "Gmail credentials configured (GMAIL_USER, GMAIL_PASS)"
  else
    warn_check "Gmail credentials not in .env – email notifications will be disabled"
    RECOMMENDATIONS+=("Set GMAIL_USER and GMAIL_PASS in .env or Firebase config")
  fi

  # Twilio
  if [[ -n "${TWILIO_SID:-}" && -n "${TWILIO_TOKEN:-}" && -n "${TWILIO_PHONE:-}" ]]; then
    pass_check "Twilio credentials configured (SID, TOKEN, PHONE)"
  else
    warn_check "Twilio credentials not in .env – SMS notifications will be disabled"
    RECOMMENDATIONS+=("Set TWILIO_SID, TWILIO_TOKEN, TWILIO_PHONE in .env or Firebase config")
  fi

  # Check sendEmail and sendSms in source
  local func_file="${REPO_ROOT}/functions/index.js"
  if grep -q "sendEmail" "$func_file" && grep -q "sendSms" "$func_file"; then
    pass_check "sendEmail and sendSms helpers present in Cloud Functions"
  else
    fail_check "sendEmail or sendSms helper missing from functions/index.js"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
#  CHECK 5 – Security rules correctness
# ─────────────────────────────────────────────────────────────────────────────
check_security_rules() {
  print_check_header "SECURITY RULES"

  local rules_file="${REPO_ROOT}/firebase.rules"
  if [[ ! -f "$rules_file" ]]; then
    fail_check "firebase.rules not found"
    return
  fi

  # Check rules are not fully open
  if grep -q "allow read, write: if true" "$rules_file"; then
    fail_check "SECURITY RISK: Firestore rules allow all reads/writes (if true)"
    RECOMMENDATIONS+=("Tighten Firestore security rules – 'if true' is insecure for production")
  else
    pass_check "Firestore rules are not open to everyone (no 'if true' detected)"
  fi

  # Check for auth checks
  if grep -q "request.auth" "$rules_file"; then
    pass_check "Authentication checks present in Firestore rules"
  else
    warn_check "No authentication checks found in Firestore rules"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
#  CHECK 6 – API keys not exposed in source
# ─────────────────────────────────────────────────────────────────────────────
check_api_keys() {
  print_check_header "API KEY EXPOSURE CHECK"

  local exposed=false

  # Look for patterns that suggest hardcoded secrets
  local patterns=(
    "apiKey\s*=\s*['\"][A-Za-z0-9_-]{20,}"
    "AIza[0-9A-Za-z_-]{35}"          # Google API key
    "ghp_[0-9A-Za-z]{36}"            # GitHub PAT
    "AC[A-Za-z0-9]{32}"              # Twilio SID
    "gmail\.pass\s*=\s*['\"][^'\"]{4,}"
  )

  for pattern in "${patterns[@]}"; do
    local matches
    matches=$(grep -rE "$pattern" \
      --include="*.js" --include="*.json" --include="*.ts" \
      --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=build \
      "${REPO_ROOT}" 2>/dev/null | \
      grep -v ".env.example\|config.sh\|colors.sh\|utils.sh\|verify-deployment.sh\|firebase.js\|firebaseConfig" || true)

    if [[ -n "$matches" ]]; then
      fail_check "Possible hardcoded secret detected: $(echo "$matches" | head -1 | cut -c1-80)"
      exposed=true
    fi
  done

  if [[ "$exposed" != "true" ]]; then
    pass_check "No obvious hardcoded API keys detected in source files"
  fi

  # Check .env is gitignored
  if grep -q "^\.env$" "${REPO_ROOT}/.gitignore" 2>/dev/null; then
    pass_check ".env is listed in .gitignore"
  else
    warn_check ".env may not be in .gitignore – ensure secrets are not committed"
    RECOMMENDATIONS+=("Add '.env' to .gitignore")
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
#  HEALTH CHECK DASHBOARD & REPORT
# ─────────────────────────────────────────────────────────────────────────────
generate_health_report() {
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')
  local total=$((CHECKS_PASSED + CHECKS_FAILED + CHECKS_WARNED))

  echo ""
  print_divider
  echo -e "${BOLD}  HEALTH CHECK DASHBOARD – ${timestamp}${NC}"
  print_divider
  echo ""
  echo -e "  ${GREEN}Passed:   ${CHECKS_PASSED}${NC}"
  echo -e "  ${RED}Failed:   ${CHECKS_FAILED}${NC}"
  echo -e "  ${YELLOW}Warnings: ${CHECKS_WARNED}${NC}"
  echo -e "  Total:    ${total}"
  echo ""

  if [[ ${#RECOMMENDATIONS[@]} -gt 0 ]]; then
    echo -e "${YELLOW}${BOLD}Recommendations:${NC}"
    for rec in "${RECOMMENDATIONS[@]}"; do
      echo -e "  ${YELLOW}${SYM_ARROW}${NC} $rec"
    done
    echo ""
  fi

  local overall_status
  if [[ $CHECKS_FAILED -eq 0 && $CHECKS_WARNED -eq 0 ]]; then
    overall_status="${SYM_CHECK} ALL CHECKS PASSED"
    echo -e "${GREEN}${BOLD}${overall_status}${NC}"
  elif [[ $CHECKS_FAILED -eq 0 ]]; then
    overall_status="${SYM_WARN} PASSED WITH WARNINGS"
    echo -e "${YELLOW}${BOLD}${overall_status}${NC}"
  else
    overall_status="${SYM_CROSS} FAILED (${CHECKS_FAILED} check(s) failed)"
    echo -e "${RED}${BOLD}${overall_status}${NC}"
  fi

  local report_content
  report_content="VERIFICATION REPORT - ${timestamp}
Passed: ${CHECKS_PASSED}  Failed: ${CHECKS_FAILED}  Warnings: ${CHECKS_WARNED}
Status: ${overall_status}
Recommendations:
$(printf '  - %s\n' "${RECOMMENDATIONS[@]:-none}")"

  save_report "verification-report" "$report_content" 2>/dev/null || true

  [[ $CHECKS_FAILED -eq 0 ]]
}

# ─────────────────────────────────────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────────────────────────────────────
main() {
  print_header "POST-DEPLOYMENT VERIFICATION" "Gigtos – createBooking Cloud Function"

  load_env || true
  set_defaults

  check_pr_merged
  check_functions_active
  check_firestore
  check_notifications
  check_security_rules
  check_api_keys

  generate_health_report
}

main "$@"
