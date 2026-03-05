#!/usr/bin/env bash
# scripts/config.sh
# Configuration management: loads .env, sets defaults, validates required vars.
# Source this file in other scripts: source "$(dirname "$0")/config.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── Load .env file if present ─────────────────────────────────────────────────
load_env() {
  local env_file="${REPO_ROOT}/.env"
  if [[ -f "$env_file" ]]; then
    # Export non-comment, non-empty lines
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
    return 0
  fi
  return 1
}

# ── Default values for optional variables ─────────────────────────────────────
set_defaults() {
  : "${FIREBASE_REGION:=us-central1}"
  : "${DRY_RUN:=false}"
  : "${VERBOSE:=false}"
  : "${SKIP_TESTS:=false}"
  : "${LOG_DIR:=${REPO_ROOT}/reports}"
  : "${FUNCTIONS_DIR:=${REPO_ROOT}/functions}"
  : "${PR_NUMBER:=14}"
  : "${BASE_BRANCH:=main}"

  export FIREBASE_REGION DRY_RUN VERBOSE SKIP_TESTS LOG_DIR FUNCTIONS_DIR PR_NUMBER BASE_BRANCH
}

# ── Required variables ────────────────────────────────────────────────────────
REQUIRED_VARS=(
  "FIREBASE_PROJECT_ID"
  "GITHUB_TOKEN"
)

OPTIONAL_VARS=(
  "FIREBASE_REGION"
  "GMAIL_USER"
  "GMAIL_PASS"
  "TWILIO_SID"
  "TWILIO_TOKEN"
  "TWILIO_PHONE"
)

# ── Validate required variables ───────────────────────────────────────────────
validate_config() {
  local missing=()
  for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var:-}" ]]; then
      missing+=("$var")
    fi
  done

  if [[ ${#missing[@]} -gt 0 ]]; then
    echo "ERROR: Missing required environment variables:" >&2
    for var in "${missing[@]}"; do
      echo "  - $var" >&2
    done
    echo "" >&2
    echo "Copy .env.example to .env and fill in the values:" >&2
    echo "  cp .env.example .env && nano .env" >&2
    return 1
  fi

  return 0
}

# ── Export config summary ─────────────────────────────────────────────────────
print_config() {
  echo "  FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}"
  echo "  FIREBASE_REGION=${FIREBASE_REGION}"
  echo "  DRY_RUN=${DRY_RUN}"
  echo "  SKIP_TESTS=${SKIP_TESTS}"
  echo "  VERBOSE=${VERBOSE}"
  for var in "${OPTIONAL_VARS[@]}"; do
    if [[ -n "${!var:-}" ]]; then
      echo "  ${var}=<configured>"
    else
      echo "  ${var}=<not set>"
    fi
  done
}

# ── Initialise (load + defaults + validate) ───────────────────────────────────
init_config() {
  load_env || true
  set_defaults
  validate_config
}
