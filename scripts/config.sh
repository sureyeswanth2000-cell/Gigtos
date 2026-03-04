#!/usr/bin/env bash
# =============================================================================
# config.sh — Centralized configuration for Gigtos CI/CD scripts
# =============================================================================
# Usage: source scripts/config.sh
#
# This script:
#   1. Loads variables from a .env file (if present)
#   2. Sets sensible default values
#   3. Validates required variables (call validate_config to trigger this)
#   4. Exports everything so child processes inherit the values
# =============================================================================

# Guard against double-sourcing
[ "${_GIGTOS_CONFIG_LOADED:-}" = "1" ] && return 0
_GIGTOS_CONFIG_LOADED=1

# ── Locate repository root ────────────────────────────────────────────────────
# REPO_ROOT is the directory containing this config; scripts sit in scripts/
SCRIPT_DIR_CONFIG="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR_CONFIG}/.." && pwd)"
export REPO_ROOT

# ── Load .env file ────────────────────────────────────────────────────────────
_ENV_FILE="${REPO_ROOT}/.env"
if [ -f "${_ENV_FILE}" ]; then
  # Only export KEY=VALUE lines; skip comments and blank lines
  set -o allexport
  # shellcheck source=/dev/null
  source "${_ENV_FILE}"
  set +o allexport
fi

# ── Firebase / GCP ───────────────────────────────────────────────────────────
: "${FIREBASE_PROJECT_ID:=gigtos-default}"
: "${FIREBASE_REGION:=us-central1}"
: "${FUNCTIONS_DIR:=${REPO_ROOT}/functions}"
export FIREBASE_PROJECT_ID FIREBASE_REGION FUNCTIONS_DIR

# ── GitHub ────────────────────────────────────────────────────────────────────
: "${GITHUB_REPO:=sureyeswanth2000-cell/Gigtos}"
: "${PR_NUMBER:=14}"
: "${TARGET_BRANCH:=main}"
export GITHUB_REPO PR_NUMBER TARGET_BRANCH
# GITHUB_TOKEN — must come from the environment / .env; no default

# ── Email (Gmail / Nodemailer) ────────────────────────────────────────────────
# GMAIL_USER and GMAIL_PASS — must come from the environment / .env
export GMAIL_USER GMAIL_PASS

# ── SMS (Twilio) ──────────────────────────────────────────────────────────────
# TWILIO_SID, TWILIO_TOKEN, TWILIO_PHONE — must come from the environment / .env
export TWILIO_SID TWILIO_TOKEN TWILIO_PHONE

# ── Slack (optional) ──────────────────────────────────────────────────────────
# SLACK_WEBHOOK_URL — optional; leave unset to skip Slack notifications
export SLACK_WEBHOOK_URL

# ── Test credentials ──────────────────────────────────────────────────────────
: "${TEST_USER_EMAIL:=test-user@gigtos.example}"
: "${TEST_USER_PHONE:=+15005550006}"     # Twilio magic test number
: "${TEST_ADMIN_EMAIL:=test-admin@gigtos.example}"
export TEST_USER_EMAIL TEST_USER_PHONE TEST_ADMIN_EMAIL

# ── Reports / logs ────────────────────────────────────────────────────────────
: "${REPORTS_DIR:=${REPO_ROOT}/reports}"
export REPORTS_DIR

# ── Runtime flags (can be overridden by scripts via CLI args) ─────────────────
: "${DRY_RUN:=false}"
: "${SKIP_TESTS:=false}"
: "${VERBOSE:=false}"
export DRY_RUN SKIP_TESTS VERBOSE

# ── Validate required configuration ──────────────────────────────────────────
# Call this function from scripts that need the full config to be present.
validate_config() {
  local errors=0

  _check_cfg() {
    local var="$1"
    local description="${2:-${var}}"
    if [ -z "${!var:-}" ]; then
      printf "   ✗ %s (%s) is not set\n" "${description}" "${var}" >&2
      errors=$(( errors + 1 ))
    else
      printf "   ✓ %s is set\n" "${description}"
    fi
  }

  _check_cfg FIREBASE_PROJECT_ID "Firebase Project ID"
  _check_cfg GITHUB_TOKEN        "GitHub Token"
  _check_cfg GMAIL_USER          "Gmail user"
  _check_cfg GMAIL_PASS          "Gmail app-password"
  _check_cfg TWILIO_SID          "Twilio Account SID"
  _check_cfg TWILIO_TOKEN        "Twilio Auth Token"
  _check_cfg TWILIO_PHONE        "Twilio phone number"

  if [ "${errors}" -gt 0 ]; then
    printf "\n   %d required variable(s) missing. Copy .env.example → .env and fill in values.\n" \
      "${errors}" >&2
    return 1
  fi
  return 0
}
