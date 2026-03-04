#!/usr/bin/env bash
# =============================================================================
# test-booking.sh — Comprehensive booking test suite for Gigtos
# =============================================================================
# Usage:
#   ./scripts/test-booking.sh [--dry-run] [--verbose] [--help]
#
# Options:
#   --dry-run   Print test actions without making real HTTP/Firestore calls
#   --verbose   Enable verbose curl output
#   --help      Show this help message
#
# Exit codes:
#   0  All tests passed
#   1  One or more tests failed
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
REPORT_FILE="${REPORTS_DIR}/test-report-${TIMESTAMP}.txt"
init_log "${REPORT_FILE}"
start_timer

print_header "BOOKING TEST REPORT"
[ "${DRY_RUN}" = "true" ] && log_info "DRY-RUN mode — no real calls will be made"

# ── Resolve Cloud Functions base URL ──────────────────────────────────────────
_FUNCTIONS_BASE_URL="${FUNCTIONS_BASE_URL:-}"
if [ -z "${_FUNCTIONS_BASE_URL}" ] && [ "${DRY_RUN}" = "false" ]; then
  _FUNCTIONS_BASE_URL="https://${FIREBASE_REGION}-${FIREBASE_PROJECT_ID}.cloudfunctions.net"
fi
: "${_FUNCTIONS_BASE_URL:=https://us-central1-gigtos-default.cloudfunctions.net}"
BOOKING_URL="${_FUNCTIONS_BASE_URL}/createBooking"

# ── Test helpers ──────────────────────────────────────────────────────────────
TEST_NUMBER=0
TEST_PASS=0
TEST_FAIL=0

_begin_test() {
  TEST_NUMBER=$(( TEST_NUMBER + 1 ))
  printf "\n   ${COLOR_BOLD}TEST %d: %s${COLOR_RESET}\n" "${TEST_NUMBER}" "$*"
  _append_log "TEST" "BEGIN Test ${TEST_NUMBER}: $*"
}

_pass() {
  printf "   $(badge_pass) %s\n" "$*"
  TEST_PASS=$(( TEST_PASS + 1 ))
  _append_log "TEST" "PASS: $*"
}

_fail() {
  printf "   $(badge_fail) ${COLOR_RED}%s${COLOR_RESET}\n" "$*" >&2
  TEST_FAIL=$(( TEST_FAIL + 1 ))
  _append_log "TEST" "FAIL: $*"
}

_skip() {
  printf "   $(badge_skip) %s (dry-run)\n" "$*"
  _append_log "TEST" "SKIP: $*"
}

# Send a booking request; returns the HTTP status code
_post_booking() {
  local payload="$1"
  if [ "${DRY_RUN}" = "true" ]; then
    echo "200"
    return 0
  fi
  local verbose_flag=""
  [ "${VERBOSE}" = "true" ] && verbose_flag="-v"
  curl ${verbose_flag} -s -o /tmp/booking_response.json \
    -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "${payload}" \
    --max-time 30 \
    "${BOOKING_URL}" 2>/dev/null || echo "000"
}

_response_body() {
  cat /tmp/booking_response.json 2>/dev/null || echo "{}"
}

# =============================================================================
# TEST 1 — Missing required field: serviceType
# =============================================================================
_begin_test "Input validation — missing serviceType"
PAYLOAD='{"customerName":"Test User","email":"test@example.com","phone":"+15005550006","date":"2026-03-10"}'
HTTP="$(_post_booking "${PAYLOAD}")"
if [ "${DRY_RUN}" = "true" ]; then
  _skip "Would POST to ${BOOKING_URL} and expect 4xx"
elif [[ "${HTTP}" =~ ^4 ]]; then
  _pass "Server correctly rejected request with HTTP ${HTTP}"
else
  _fail "Expected 4xx, got HTTP ${HTTP} — body: $(_response_body)"
fi

# =============================================================================
# TEST 2 — Missing required field: date
# =============================================================================
_begin_test "Input validation — missing date"
PAYLOAD='{"customerName":"Test User","email":"test@example.com","phone":"+15005550006","serviceType":"cleaning"}'
HTTP="$(_post_booking "${PAYLOAD}")"
if [ "${DRY_RUN}" = "true" ]; then
  _skip "Would POST to ${BOOKING_URL} and expect 4xx"
elif [[ "${HTTP}" =~ ^4 ]]; then
  _pass "Server correctly rejected request with HTTP ${HTTP}"
else
  _fail "Expected 4xx, got HTTP ${HTTP} — body: $(_response_body)"
fi

# =============================================================================
# TEST 3 — Invalid date format
# =============================================================================
_begin_test "Input validation — invalid date format"
PAYLOAD='{"customerName":"Test User","email":"test@example.com","phone":"+15005550006","serviceType":"cleaning","date":"not-a-date"}'
HTTP="$(_post_booking "${PAYLOAD}")"
if [ "${DRY_RUN}" = "true" ]; then
  _skip "Would POST to ${BOOKING_URL} and expect 4xx"
elif [[ "${HTTP}" =~ ^4 ]]; then
  _pass "Server correctly rejected request with HTTP ${HTTP}"
else
  _fail "Expected 4xx, got HTTP ${HTTP} — body: $(_response_body)"
fi

# =============================================================================
# TEST 4 — Past date rejection
# =============================================================================
_begin_test "Future date validation — past date rejected"
PAST_DATE="2020-01-01"
PAYLOAD="{\"customerName\":\"Test User\",\"email\":\"test@example.com\",\"phone\":\"+15005550006\",\"serviceType\":\"cleaning\",\"date\":\"${PAST_DATE}\"}"
HTTP="$(_post_booking "${PAYLOAD}")"
if [ "${DRY_RUN}" = "true" ]; then
  _skip "Would POST to ${BOOKING_URL} with past date and expect 4xx"
elif [[ "${HTTP}" =~ ^4 ]]; then
  _pass "Server correctly rejected past date with HTTP ${HTTP}"
else
  _fail "Expected 4xx for past date, got HTTP ${HTTP}"
fi

# =============================================================================
# TEST 5 — Valid single-day booking
# =============================================================================
_begin_test "Valid single-day booking creation"
FUTURE_DATE="2026-04-15"
PAYLOAD="{\"customerName\":\"Test User\",\"email\":\"${TEST_USER_EMAIL}\",\"phone\":\"${TEST_USER_PHONE}\",\"serviceType\":\"cleaning\",\"date\":\"${FUTURE_DATE}\"}"
HTTP="$(_post_booking "${PAYLOAD}")"
if [ "${DRY_RUN}" = "true" ]; then
  _skip "Would POST to ${BOOKING_URL} and expect 2xx"
elif [[ "${HTTP}" =~ ^2 ]]; then
  _pass "Single-day booking created — HTTP ${HTTP}"
else
  _fail "Expected 2xx, got HTTP ${HTTP} — body: $(_response_body)"
fi

# =============================================================================
# TEST 6 — Valid multi-day booking (2026-03-10 → 2026-03-15)
# =============================================================================
_begin_test "Valid multi-day booking creation (2026-03-10 to 2026-03-15)"
PAYLOAD="{\"customerName\":\"Test User\",\"email\":\"${TEST_USER_EMAIL}\",\"phone\":\"${TEST_USER_PHONE}\",\"serviceType\":\"plumbing\",\"startDate\":\"2026-03-10\",\"endDate\":\"2026-03-15\"}"
HTTP="$(_post_booking "${PAYLOAD}")"
if [ "${DRY_RUN}" = "true" ]; then
  _skip "Would POST multi-day booking and expect 2xx"
elif [[ "${HTTP}" =~ ^2 ]]; then
  _pass "Multi-day booking created — HTTP ${HTTP}"
else
  _fail "Expected 2xx, got HTTP ${HTTP} — body: $(_response_body)"
fi

# =============================================================================
# TEST 7 — Firestore integration: booking document exists after creation
# =============================================================================
_begin_test "Firestore integration — booking document persisted"
if [ "${DRY_RUN}" = "true" ]; then
  _skip "Would query Firestore for booking document"
elif command -v firebase >/dev/null 2>&1; then
  # Use Firebase Emulator or live project to verify
  BOOKING_COUNT="$(firebase firestore:get bookings \
    --project "${FIREBASE_PROJECT_ID}" 2>/dev/null \
    | grep -c '"serviceType"' || echo 0)"
  if [ "${BOOKING_COUNT}" -gt 0 ]; then
    _pass "Found ${BOOKING_COUNT} booking document(s) in Firestore"
  else
    _fail "No booking documents found in Firestore"
  fi
else
  _fail "firebase CLI not available — cannot verify Firestore"
fi

# =============================================================================
# TEST 8 — Cloud Function execution validation
# =============================================================================
_begin_test "Cloud Functions execution validation — createBooking active"
if [ "${DRY_RUN}" = "true" ]; then
  _skip "Would check Firebase for active createBooking function"
elif command -v firebase >/dev/null 2>&1; then
  FUNC_STATUS="$(firebase functions:list \
    --project "${FIREBASE_PROJECT_ID}" 2>/dev/null \
    | grep -i 'createBooking' | grep -i 'active' || true)"
  if [ -n "${FUNC_STATUS}" ]; then
    _pass "createBooking function is ACTIVE"
  else
    _fail "createBooking function not found or not ACTIVE"
  fi
else
  _fail "firebase CLI not available — cannot validate function status"
fi

# =============================================================================
# TEST 9 — Email notification check
# =============================================================================
_begin_test "Email/SMS notification configuration check"
EMAIL_CFG="$(firebase functions:config:get gmail \
  --project "${FIREBASE_PROJECT_ID}" 2>/dev/null || echo '{}')"
if [ "${DRY_RUN}" = "true" ]; then
  _skip "Would verify Gmail config in Firebase Functions config"
elif echo "${EMAIL_CFG}" | grep -q '"user"'; then
  _pass "Gmail configuration is present"
else
  _fail "Gmail configuration missing — run: firebase functions:config:set gmail.user=... gmail.pass=..."
fi

# =============================================================================
# SUMMARY
# =============================================================================
print_separator
printf "${COLOR_BOLD}${COLOR_WHITE}📊 TEST SUMMARY${COLOR_RESET}\n"
print_separator
printf "   Total tests : %d\n"  "${TEST_NUMBER}"
printf "   Passed      : ${COLOR_GREEN}%d ✓${COLOR_RESET}\n" "${TEST_PASS}"
printf "   Failed      : ${COLOR_RED}%d ✗${COLOR_RESET}\n"   "${TEST_FAIL}"
printf "   Elapsed     : %s\n"  "$(elapsed_time)"
echo ""

if [ "${TEST_FAIL}" -eq 0 ]; then
  printf "   ${SYMBOL_OK} ${COLOR_GREEN}${COLOR_BOLD}All tests PASSED${COLOR_RESET}\n"
else
  printf "   ${SYMBOL_FAIL} ${COLOR_RED}${COLOR_BOLD}%d test(s) FAILED${COLOR_RESET}\n" "${TEST_FAIL}"
fi
print_separator
echo ""

# Write plain-text report
{
  printf "BOOKING TEST REPORT — %s\n" "$(date '+%Y-%m-%d %H:%M:%S')"
  printf "%s\n\n" "$(printf '%0.s═' $(seq 1 65))"
  printf "Total     : %d\n" "${TEST_NUMBER}"
  printf "Passed    : %d\n" "${TEST_PASS}"
  printf "Failed    : %d\n" "${TEST_FAIL}"
  printf "Elapsed   : %s\n" "$(elapsed_time)"
  printf "\nStatus: %s\n" "$([ "${TEST_FAIL}" -eq 0 ] && echo PASS || echo FAIL)"
} >> "${REPORT_FILE}"

log_info "Report saved to: ${REPORT_FILE}"

[ "${TEST_FAIL}" -eq 0 ] && exit 0 || exit 1
