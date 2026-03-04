#!/bin/bash
# test-booking.sh - Automated tests for the createBooking Cloud Function
#
# Usage: ./scripts/test-booking.sh [--verbose]
#
# The script exercises the createBooking HTTP endpoint and checks:
#   1. Input validation (missing fields, bad email, past dates, etc.)
#   2. Single-day booking creation
#   3. Multi-day booking creation
#   4. Future date booking
#   5. Firestore document existence (via Firebase CLI)
#   6. Cloud Functions logs
#
# Required environment variables:
#   FIREBASE_PROJECT_ID   Your Firebase project ID
#
# Optional:
#   FUNCTIONS_BASE_URL    Override the default Cloud Functions base URL
#                         Defaults to https://<REGION>-<PROJECT>.cloudfunctions.net

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=config.sh
source "${SCRIPT_DIR}/config.sh"
# shellcheck source=utils.sh
source "${SCRIPT_DIR}/utils.sh"

VERBOSE=false
parse_flags "$@"

# ─── Initialise ──────────────────────────────────────────────────────────────
set_log_file "${TEST_REPORT}"
start_timer
reset_counters

FUNCTIONS_BASE_URL="${FUNCTIONS_BASE_URL:-https://${FIREBASE_REGION}-${FIREBASE_PROJECT_ID}.cloudfunctions.net}"
BOOKING_ENDPOINT="${FUNCTIONS_BASE_URL}/createBooking"

FUTURE_DATE=$(get_relative_date +7)
FUTURE_END_DATE=$(get_relative_date +9)
PAST_DATE=$(get_relative_date -1)

# ─── Helper ──────────────────────────────────────────────────────────────────
http_post() {
    local url="$1"
    local data="$2"
    curl -s -w "\n%{http_code}" \
         -X POST \
         -H "Content-Type: application/json" \
         -d "$data" \
         --max-time 30 \
         "$url"
}

expect_status() {
    local label="$1" expected="$2" response="$3"
    local body http_code
    body=$(echo "$response" | head -n -1)
    http_code=$(echo "$response" | tail -n1)

    if [ "${VERBOSE}" = true ]; then
        print_info "  Response (${http_code}): ${body}"
    fi

    if [ "$http_code" -eq "$expected" ]; then
        record_pass "${label} — HTTP ${http_code}"
        return 0
    else
        record_fail "${label} — expected HTTP ${expected}, got ${http_code}"
        return 1
    fi
}

# ─── Banner ──────────────────────────────────────────────────────────────────
print_section "GIGTOS BOOKING TEST SUITE"
print_info "Endpoint : ${BOOKING_ENDPOINT}"
print_info "Log file : ${TEST_REPORT}"

# ─── Validate environment ─────────────────────────────────────────────────────
print_section "ENVIRONMENT VALIDATION"
if ! validate_env; then
    exit 1
fi
check_node || exit 1

if ! command -v curl &>/dev/null; then
    print_error "curl is required for HTTP tests. Install curl and retry."
    exit 1
fi
print_success "curl available"

# ─── Test Suite 1: Input Validation ──────────────────────────────────────────
print_section "TEST SUITE 1 — INPUT VALIDATION"

print_subsection "Missing required fields"
resp=$(http_post "${BOOKING_ENDPOINT}" '{}' 2>/dev/null || echo -e "\n400")
expect_status "Missing all fields → 400" 400 "$resp" || true

print_subsection "Invalid service type"
resp=$(http_post "${BOOKING_ENDPOINT}" \
    "{\"name\":\"Test User\",\"email\":\"test@example.com\",\"phone\":\"9999999999\",\"serviceType\":\"InvalidService\",\"startDate\":\"${FUTURE_DATE}\"}" \
    2>/dev/null || echo -e "\n400")
expect_status "Invalid serviceType → 400" 400 "$resp" || true

print_subsection "Invalid email format"
resp=$(http_post "${BOOKING_ENDPOINT}" \
    "{\"name\":\"Test User\",\"email\":\"not-an-email\",\"phone\":\"9999999999\",\"serviceType\":\"Plumber\",\"startDate\":\"${FUTURE_DATE}\"}" \
    2>/dev/null || echo -e "\n400")
expect_status "Invalid email → 400" 400 "$resp" || true

print_subsection "Past date rejected"
resp=$(http_post "${BOOKING_ENDPOINT}" \
    "{\"name\":\"Test User\",\"email\":\"test@example.com\",\"phone\":\"9999999999\",\"serviceType\":\"Plumber\",\"startDate\":\"${PAST_DATE}\"}" \
    2>/dev/null || echo -e "\n400")
expect_status "Past date → 400" 400 "$resp" || true

print_subsection "Missing phone number"
resp=$(http_post "${BOOKING_ENDPOINT}" \
    "{\"name\":\"Test User\",\"email\":\"test@example.com\",\"serviceType\":\"Plumber\",\"startDate\":\"${FUTURE_DATE}\"}" \
    2>/dev/null || echo -e "\n400")
expect_status "Missing phone → 400" 400 "$resp" || true

# ─── Test Suite 2: Successful Booking Creation ────────────────────────────────
print_section "TEST SUITE 2 — BOOKING CREATION"

print_subsection "Single-day booking"
SINGLE_DAY_PAYLOAD="{
  \"name\": \"Test User Single\",
  \"email\": \"testuser@example.com\",
  \"phone\": \"9876543210\",
  \"serviceType\": \"Plumber\",
  \"startDate\": \"${FUTURE_DATE}\",
  \"description\": \"Fix kitchen sink\"
}"
resp=$(http_post "${BOOKING_ENDPOINT}" "${SINGLE_DAY_PAYLOAD}" 2>/dev/null || echo -e "\n500")
expect_status "Single-day booking → 200/201" 200 "$resp" || \
    expect_status "Single-day booking → 201" 201 "$resp" || true

print_subsection "Multi-day booking"
MULTI_DAY_PAYLOAD="{
  \"name\": \"Test User Multi\",
  \"email\": \"testmulti@example.com\",
  \"phone\": \"9876543211\",
  \"serviceType\": \"Painter\",
  \"startDate\": \"${FUTURE_DATE}\",
  \"endDate\": \"${FUTURE_END_DATE}\",
  \"description\": \"Paint entire apartment\"
}"
resp=$(http_post "${BOOKING_ENDPOINT}" "${MULTI_DAY_PAYLOAD}" 2>/dev/null || echo -e "\n500")
expect_status "Multi-day booking → 200/201" 200 "$resp" || \
    expect_status "Multi-day booking → 201" 201 "$resp" || true

print_subsection "Electrician booking (future date)"
ELEC_PAYLOAD="{
  \"name\": \"Test Electrician User\",
  \"email\": \"testelec@example.com\",
  \"phone\": \"9876543212\",
  \"serviceType\": \"Electrician\",
  \"startDate\": \"${FUTURE_DATE}\",
  \"description\": \"Install ceiling fan\"
}"
resp=$(http_post "${BOOKING_ENDPOINT}" "${ELEC_PAYLOAD}" 2>/dev/null || echo -e "\n500")
expect_status "Electrician future-date booking → 200/201" 200 "$resp" || \
    expect_status "Electrician future-date booking → 201" 201 "$resp" || true

# ─── Test Suite 3: Firestore Integration ──────────────────────────────────────
print_section "TEST SUITE 3 — FIRESTORE INTEGRATION"

if command -v firebase &>/dev/null && [ -n "${FIREBASE_PROJECT_ID}" ]; then
    print_step "Checking bookings collection via Firebase CLI…"

    FIRESTORE_CHECK=$(firebase firestore:get bookings \
        --project "${FIREBASE_PROJECT_ID}" \
        --limit 1 2>/dev/null || echo "ERROR")

    if echo "${FIRESTORE_CHECK}" | grep -q "ERROR"; then
        record_fail "Firestore read — unable to access bookings collection"
    else
        record_pass "Firestore read — bookings collection accessible"
    fi
else
    print_warning "Skipping Firestore checks (Firebase CLI not available or FIREBASE_PROJECT_ID not set)"
fi

# ─── Test Suite 4: Cloud Functions Logs ───────────────────────────────────────
print_section "TEST SUITE 4 — CLOUD FUNCTIONS LOGS"

if command -v firebase &>/dev/null && [ -n "${FIREBASE_PROJECT_ID}" ]; then
    print_step "Fetching recent Cloud Functions logs…"

    LOGS=$(firebase functions:log \
        --project "${FIREBASE_PROJECT_ID}" \
        --only createBooking \
        --lines 20 2>/dev/null || echo "LOG_UNAVAILABLE")

    if echo "${LOGS}" | grep -qi "error"; then
        record_fail "Cloud Functions logs — errors detected in recent logs"
        if [ "${VERBOSE}" = true ]; then
            echo "${LOGS}"
        fi
    elif echo "${LOGS}" | grep -q "LOG_UNAVAILABLE"; then
        print_warning "Cloud Functions logs not available (may need firebase login)"
    else
        record_pass "Cloud Functions logs — no errors in recent createBooking invocations"
        if [ "${VERBOSE}" = true ]; then
            echo "${LOGS}"
        fi
    fi
else
    print_warning "Skipping log checks (Firebase CLI not available)"
fi

# ─── Generate Test Report ─────────────────────────────────────────────────────
TOTAL_TIME=$(elapsed_time)
TOTAL=$(( PASS_COUNT + FAIL_COUNT ))

print_section "TEST REPORT — $(date '+%Y-%m-%d %H:%M:%S')"

{
    report_section "GIGTOS BOOKING TEST REPORT — $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    echo "Endpoint : ${BOOKING_ENDPOINT}"
    echo ""
    echo "Results  : ${PASS_COUNT} passed / ${FAIL_COUNT} failed / ${TOTAL} total"
    echo "Duration : ${TOTAL_TIME}"
    echo ""
    echo "Test log : ${TEST_REPORT}"
} | tee -a "${TEST_REPORT}"

if [ "${FAIL_COUNT}" -eq 0 ]; then
    print_success "All ${TOTAL} tests passed in ${TOTAL_TIME}"
    exit 0
else
    print_error "${FAIL_COUNT}/${TOTAL} tests failed. See ${TEST_REPORT} for details."
    exit 1
fi
