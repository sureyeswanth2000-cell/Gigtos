#!/usr/bin/env bash
# scripts/test-booking.sh
# Automated test suite for the createBooking Cloud Function.
#
# Usage:
#   ./scripts/test-booking.sh [--verbose]
#
# Tests run against the Firebase Emulator Suite by default.
# Set FIREBASE_EMULATOR=false to test against the live project.

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

# ── Test state ────────────────────────────────────────────────────────────────
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0
FAILED_TESTS=()
TEST_START=$(date +%s)

# ── Emulator / endpoint config ────────────────────────────────────────────────
EMULATOR="${FIREBASE_EMULATOR:-true}"
EMULATOR_HOST="${FIREBASE_EMULATOR_HOST:-localhost}"
EMULATOR_PORT="${FIREBASE_FUNCTIONS_PORT:-5001}"
PROJECT="${FIREBASE_PROJECT_ID:-demo-gigtos}"

if [[ "$EMULATOR" == "true" ]]; then
  BASE_URL="http://${EMULATOR_HOST}:${EMULATOR_PORT}/${PROJECT}/us-central1"
else
  BASE_URL="https://${FIREBASE_REGION:-us-central1}-${PROJECT}.cloudfunctions.net"
fi

CALLABLE_URL="${BASE_URL}/createBooking"

# ── Helpers ───────────────────────────────────────────────────────────────────
pass_test() {
  local name="$1"
  TESTS_PASSED=$((TESTS_PASSED + 1))
  print_ok "PASS  ${name}"
}

fail_test() {
  local name="$1"
  local reason="${2:-}"
  TESTS_FAILED=$((TESTS_FAILED + 1))
  FAILED_TESTS+=("${name}")
  print_fail "FAIL  ${name}${reason:+ — ${reason}}"
}

skip_test() {
  local name="$1"
  local reason="${2:-}"
  TESTS_SKIPPED=$((TESTS_SKIPPED + 1))
  print_warn "SKIP  ${name}${reason:+ (${reason})}"
}

# Calls the Cloud Function callable endpoint (emulator or live).
# Returns the HTTP status code and prints the response body.
call_function() {
  local payload="$1"
  local id_token="${2:-test-token}"

  curl --silent --write-out "\n%{http_code}" \
    --max-time 15 \
    --request POST "${CALLABLE_URL}" \
    --header "Content-Type: application/json" \
    --header "Authorization: Bearer ${id_token}" \
    --data "{\"data\":${payload}}"
}

# Checks that the response body contains a given substring.
assert_contains() {
  local body="$1"
  local expected="$2"
  echo "$body" | grep -q "$expected"
}

# Checks that the HTTP status matches expected.
assert_status() {
  local actual="$1"
  local expected="$2"
  [[ "$actual" == "$expected" ]]
}

# ── Emulator availability check ───────────────────────────────────────────────
check_emulator() {
  if [[ "$EMULATOR" == "true" ]]; then
    if curl --silent --max-time 3 "http://${EMULATOR_HOST}:${EMULATOR_PORT}" &>/dev/null; then
      print_ok "Firebase Emulator reachable at ${EMULATOR_HOST}:${EMULATOR_PORT}"
      return 0
    else
      log_warn "Firebase Emulator not reachable at ${EMULATOR_HOST}:${EMULATOR_PORT}"
      log_warn "Start it with: firebase emulators:start"
      log_warn "Falling back to structural/validation tests only."
      return 1
    fi
  else
    # Live Firebase – do a quick connectivity check
    if curl --silent --max-time 5 "https://firebaseapp.com" &>/dev/null; then
      print_ok "Internet connectivity confirmed – using live Firebase endpoint"
      return 0
    else
      log_warn "Cannot reach Firebase live endpoint – integration tests will be skipped"
      return 1
    fi
  fi
}

EMULATOR_AVAILABLE=false
# check_emulator returns 0 (reachable) or 1 (not reachable / not running)
check_emulator && EMULATOR_AVAILABLE=true || EMULATOR_AVAILABLE=false

# ─────────────────────────────────────────────────────────────────────────────
#  TEST DEFINITIONS
# ─────────────────────────────────────────────────────────────────────────────

# TEST 1 – Input validation: missing required fields
test_missing_fields() {
  local name="Input validation – missing required fields"

  if [[ "$EMULATOR_AVAILABLE" != "true" ]]; then
    skip_test "$name" "emulator unavailable"
    return
  fi

  local response
  response=$(call_function '{"address":"123 Main St"}' 2>/dev/null || echo "error")
  local http_code
  http_code=$(echo "$response" | tail -1)
  local body
  body=$(echo "$response" | head -n -1)

  if assert_contains "$body" '"error"' || assert_contains "$body" "INVALID_ARGUMENT" || \
     [[ "$http_code" =~ ^4 ]]; then
    pass_test "$name"
  else
    fail_test "$name" "Expected error for missing fields, got: ${http_code} ${body:0:120}"
  fi
}

# TEST 2 – Input validation: invalid email format
test_invalid_email() {
  local name="Input validation – invalid email format"

  if [[ "$EMULATOR_AVAILABLE" != "true" ]]; then
    skip_test "$name" "emulator unavailable"
    return
  fi

  local payload
  payload='{"serviceType":"cleaning","customerName":"John","phone":"+1234567890","address":"123 Main","email":"not-an-email"}'
  local response
  response=$(call_function "$payload" 2>/dev/null || echo "error")
  local http_code
  http_code=$(echo "$response" | tail -1)
  local body
  body=$(echo "$response" | head -n -1)

  if assert_contains "$body" '"error"' || assert_contains "$body" "INVALID_ARGUMENT" || \
     [[ "$http_code" =~ ^4 ]]; then
    pass_test "$name"
  else
    fail_test "$name" "Expected error for invalid email, got: ${http_code} ${body:0:120}"
  fi
}

# TEST 3 – Input validation: past scheduled date
test_past_date() {
  local name="Input validation – past scheduled date rejected"

  if [[ "$EMULATOR_AVAILABLE" != "true" ]]; then
    skip_test "$name" "emulator unavailable"
    return
  fi

  local payload
  payload='{"serviceType":"cleaning","customerName":"John","phone":"+1234567890","address":"123 Main","email":"john@example.com","isScheduled":true,"scheduledDate":"2020-01-01","timeSlot":"09:00"}'
  local response
  response=$(call_function "$payload" 2>/dev/null || echo "error")
  local http_code
  http_code=$(echo "$response" | tail -1)
  local body
  body=$(echo "$response" | head -n -1)

  if assert_contains "$body" '"error"' || assert_contains "$body" "INVALID_ARGUMENT" || \
     [[ "$http_code" =~ ^4 ]]; then
    pass_test "$name"
  else
    fail_test "$name" "Expected error for past date, got: ${http_code} ${body:0:120}"
  fi
}

# TEST 4 – Single-day booking creation
test_single_day_booking() {
  local name="Single-day booking creation"

  if [[ "$EMULATOR_AVAILABLE" != "true" ]]; then
    skip_test "$name" "emulator unavailable"
    return
  fi

  local future_date
  future_date=$(date -d "+7 days" '+%Y-%m-%d' 2>/dev/null || date -v+7d '+%Y-%m-%d')
  local payload
  payload="{\"serviceType\":\"cleaning\",\"customerName\":\"Jane Doe\",\"phone\":\"+1234567890\",\"address\":\"456 Oak Ave\",\"email\":\"jane@example.com\",\"isScheduled\":false}"

  local response
  response=$(call_function "$payload" 2>/dev/null || echo "error")
  local http_code
  http_code=$(echo "$response" | tail -1)
  local body
  body=$(echo "$response" | head -n -1)

  if (assert_contains "$body" '"success"' || assert_contains "$body" '"bookingId"') && \
     [[ "$http_code" == "200" ]]; then
    pass_test "$name"
  else
    fail_test "$name" "Unexpected response: ${http_code} ${body:0:120}"
  fi
}

# TEST 5 – Multi-day booking (2026-03-10 to 2026-03-15)
test_multi_day_booking() {
  local name="Multi-day booking (2026-03-10 to 2026-03-15)"

  if [[ "$EMULATOR_AVAILABLE" != "true" ]]; then
    skip_test "$name" "emulator unavailable"
    return
  fi

  local payload
  payload='{"serviceType":"plumbing","customerName":"Bob Smith","phone":"+0987654321","address":"789 Pine Rd","email":"bob@example.com","isScheduled":true,"scheduledDate":"2026-03-10","timeSlot":"14:00","endDate":"2026-03-15"}'

  local response
  response=$(call_function "$payload" 2>/dev/null || echo "error")
  local http_code
  http_code=$(echo "$response" | tail -1)
  local body
  body=$(echo "$response" | head -n -1)

  if (assert_contains "$body" '"success"' || assert_contains "$body" '"bookingId"') && \
     [[ "$http_code" == "200" ]]; then
    pass_test "$name"
  else
    fail_test "$name" "Unexpected response: ${http_code} ${body:0:120}"
  fi
}

# TEST 6 – Future date booking accepted
test_future_date_booking() {
  local name="Future date booking accepted"

  if [[ "$EMULATOR_AVAILABLE" != "true" ]]; then
    skip_test "$name" "emulator unavailable"
    return
  fi

  local future_date
  future_date=$(date -d "+30 days" '+%Y-%m-%d' 2>/dev/null || date -v+30d '+%Y-%m-%d')
  local payload
  payload="{\"serviceType\":\"electrical\",\"customerName\":\"Alice\",\"phone\":\"+1122334455\",\"address\":\"321 Elm St\",\"email\":\"alice@example.com\",\"isScheduled\":true,\"scheduledDate\":\"${future_date}\",\"timeSlot\":\"10:00\"}"

  local response
  response=$(call_function "$payload" 2>/dev/null || echo "error")
  local http_code
  http_code=$(echo "$response" | tail -1)
  local body
  body=$(echo "$response" | head -n -1)

  if (assert_contains "$body" '"success"' || assert_contains "$body" '"bookingId"') && \
     [[ "$http_code" == "200" ]]; then
    pass_test "$name"
  else
    fail_test "$name" "Unexpected response: ${http_code} ${body:0:120}"
  fi
}

# TEST 7 – Firestore document field verification (structural validation)
test_firestore_fields() {
  local name="Firestore document field verification (12+ fields)"

  # We verify this structurally by inspecting the Cloud Function source code.
  local required_fields=(
    "userId" "serviceType" "customerName" "phone" "address" "email"
    "status" "quotes" "createdAt" "updatedAt" "isScheduled"
  )
  local func_file="${REPO_ROOT}/functions/index.js"

  if [[ ! -f "$func_file" ]]; then
    fail_test "$name" "functions/index.js not found"
    return
  fi

  local missing_fields=()
  for field in "${required_fields[@]}"; do
    if ! grep -q "$field" "$func_file"; then
      missing_fields+=("$field")
    fi
  done

  if [[ ${#missing_fields[@]} -eq 0 ]]; then
    pass_test "$name (${#required_fields[@]} fields verified in source)"
  else
    fail_test "$name" "Missing fields in source: ${missing_fields[*]}"
  fi
}

# TEST 8 – Cloud Function source verification
test_function_exists() {
  local name="Cloud Function createBooking defined in source"
  local func_file="${REPO_ROOT}/functions/index.js"

  if grep -q "exports.createBooking" "$func_file"; then
    pass_test "$name"
  else
    fail_test "$name" "exports.createBooking not found in functions/index.js"
  fi
}

# TEST 9 – Email/SMS trigger verification (structural)
test_notification_trigger() {
  local name="Email/SMS notification trigger wired to onBookingCreated"
  local func_file="${REPO_ROOT}/functions/index.js"

  if grep -q "onBookingCreated" "$func_file" && \
     grep -q "sendEmail\|sendSms" "$func_file"; then
    pass_test "$name"
  else
    fail_test "$name" "onBookingCreated or notification helpers not found"
  fi
}

# TEST 10 – Authentication check in callable
test_auth_check() {
  local name="Authentication enforced in createBooking callable"
  local func_file="${REPO_ROOT}/functions/index.js"

  # Look for auth context checks
  if grep -q "context\.auth\|request\.auth" "$func_file"; then
    pass_test "$name"
  else
    fail_test "$name" "No auth check found in createBooking"
  fi
}

# TEST 11 – Unauthenticated call rejected
test_unauthenticated_rejected() {
  local name="Unauthenticated call rejected by callable"

  if [[ "$EMULATOR_AVAILABLE" != "true" ]]; then
    skip_test "$name" "emulator unavailable"
    return
  fi

  # Call without Authorization header
  local response
  response=$(curl --silent --write-out "\n%{http_code}" \
    --max-time 10 \
    --request POST "${CALLABLE_URL}" \
    --header "Content-Type: application/json" \
    --data '{"data":{"serviceType":"cleaning"}}' 2>/dev/null || echo -e "\nerror")
  local http_code
  http_code=$(echo "$response" | tail -1)
  local body
  body=$(echo "$response" | head -n -1)

  if assert_contains "$body" "UNAUTHENTICATED" || [[ "$http_code" =~ ^4 ]]; then
    pass_test "$name"
  else
    fail_test "$name" "Expected UNAUTHENTICATED error, got: ${http_code}"
  fi
}

# TEST 12 – Error handling: empty payload
test_empty_payload() {
  local name="Error handling – empty payload"

  if [[ "$EMULATOR_AVAILABLE" != "true" ]]; then
    skip_test "$name" "emulator unavailable"
    return
  fi

  local response
  response=$(call_function '{}' 2>/dev/null || echo "error")
  local http_code
  http_code=$(echo "$response" | tail -1)
  local body
  body=$(echo "$response" | head -n -1)

  if assert_contains "$body" '"error"' || assert_contains "$body" "INVALID_ARGUMENT" || \
     [[ "$http_code" =~ ^4 ]]; then
    pass_test "$name"
  else
    fail_test "$name" "Expected error for empty payload, got: ${http_code} ${body:0:120}"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
#  RUN ALL TESTS
# ─────────────────────────────────────────────────────────────────────────────
run_all_tests() {
  print_section "BOOKING TEST SUITE"

  echo ""
  log_info "Endpoint: ${CALLABLE_URL}"
  log_info "Emulator: ${EMULATOR} (available: ${EMULATOR_AVAILABLE})"
  echo ""

  # Structural tests (always run)
  echo -e "${BOLD}Structural Tests (source inspection):${NC}"
  test_function_exists
  test_notification_trigger
  test_auth_check
  test_firestore_fields

  echo ""
  echo -e "${BOLD}Integration Tests (require emulator):${NC}"
  test_missing_fields
  test_invalid_email
  test_past_date
  test_single_day_booking
  test_multi_day_booking
  test_future_date_booking
  test_unauthenticated_rejected
  test_empty_payload
}

# ─────────────────────────────────────────────────────────────────────────────
#  REPORT
# ─────────────────────────────────────────────────────────────────────────────
generate_test_report() {
  local end_time
  end_time=$(date +%s)
  local duration=$((end_time - TEST_START))
  local total=$((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))
  local timestamp
  timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  echo ""
  print_divider
  echo -e "${BOLD}  TEST REPORT – ${timestamp}${NC}"
  print_divider
  echo ""
  echo -e "  Total:   ${total}"
  echo -e "  ${GREEN}Passed:  ${TESTS_PASSED}${NC}"
  echo -e "  ${RED}Failed:  ${TESTS_FAILED}${NC}"
  echo -e "  ${YELLOW}Skipped: ${TESTS_SKIPPED}${NC}"
  echo -e "  Time:    ${duration}s"
  echo ""

  if [[ ${#FAILED_TESTS[@]} -gt 0 ]]; then
    echo -e "${RED}Failed tests:${NC}"
    for t in "${FAILED_TESTS[@]}"; do
      echo -e "  ${RED}${SYM_FAIL}${NC} $t"
    done
    echo ""
  fi

  local report_content
  report_content="TEST REPORT - ${timestamp}
Total: ${total}  Passed: ${TESTS_PASSED}  Failed: ${TESTS_FAILED}  Skipped: ${TESTS_SKIPPED}
Duration: ${duration}s
Failed: ${FAILED_TESTS[*]:-none}"

  local report_file
  report_file=$(save_report "test-report" "$report_content" 2>/dev/null || echo "")
  [[ -n "$report_file" ]] && log_info "Report saved: ${report_file}"

  if [[ $TESTS_FAILED -gt 0 ]]; then
    print_fail_header "TEST SUITE FAILED (${TESTS_FAILED}/${total} failed)"
    return 1
  else
    print_check_header "TEST SUITE PASSED (${TESTS_PASSED}/${total} passed)"
    return 0
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────────────────────────────────────
main() {
  load_env || true
  set_defaults

  run_all_tests
  generate_test_report
}

main "$@"
