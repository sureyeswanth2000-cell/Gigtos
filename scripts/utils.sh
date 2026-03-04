#!/usr/bin/env bash
# =============================================================================
# utils.sh — Shared helper functions for Gigtos CI/CD scripts
# =============================================================================
# Depends on: colors.sh (must be sourced first)
# =============================================================================

# Guard against double-sourcing
[ "${_GIGTOS_UTILS_LOADED:-}" = "1" ] && return 0
_GIGTOS_UTILS_LOADED=1

# ── Logging helpers ───────────────────────────────────────────────────────────

log_success() {
  local msg="$*"
  printf "   ${SYMBOL_OK} %s\n" "${msg}"
  _append_log "SUCCESS" "${msg}"
}

log_error() {
  local msg="$*"
  printf "   ${SYMBOL_FAIL} ${COLOR_RED}%s${COLOR_RESET}\n" "${msg}" >&2
  _append_log "ERROR" "${msg}"
}

log_warning() {
  local msg="$*"
  printf "   ${SYMBOL_WARN} ${COLOR_YELLOW}%s${COLOR_RESET}\n" "${msg}"
  _append_log "WARNING" "${msg}"
}

log_info() {
  local msg="$*"
  printf "   ${SYMBOL_INFO} %s\n" "${msg}"
  _append_log "INFO" "${msg}"
}

log_step() {
  local msg="$*"
  printf "\n   ${SYMBOL_ARROW} ${COLOR_BOLD}%s${COLOR_RESET}\n" "${msg}"
  _append_log "STEP" "${msg}"
}

# Internal: append a structured entry to the active log file (if set)
_append_log() {
  local level="$1"
  shift
  local msg="$*"
  if [ -n "${LOG_FILE:-}" ]; then
    printf "[%s] [%-7s] %s\n" "$(date '+%Y-%m-%d %H:%M:%S')" "${level}" "${msg}" \
      >> "${LOG_FILE}" 2>/dev/null || true
  fi
}

# Open a log file and export LOG_FILE so all subsequent log_* calls write to it
init_log() {
  local log_path="$1"
  local log_dir
  log_dir="$(dirname "${log_path}")"
  mkdir -p "${log_dir}"
  LOG_FILE="${log_path}"
  export LOG_FILE
  printf "[%s] [INFO   ] Log started\n" "$(date '+%Y-%m-%d %H:%M:%S')" > "${LOG_FILE}"
}

# ── Command / dependency helpers ──────────────────────────────────────────────

# check_command_exists <cmd> [display_name]
# Returns 0 if found, 1 if not.  Prints status.
check_command_exists() {
  local cmd="$1"
  local display="${2:-${cmd}}"
  if command -v "${cmd}" >/dev/null 2>&1; then
    local ver
    ver="$(${cmd} --version 2>&1 | head -n1 | grep -oE '[0-9]+\.[0-9]+(\.[0-9]+)?' | head -n1 || true)"
    log_success "${display}${ver:+ v${ver}}"
    return 0
  else
    log_error "${display} not found (please install it)"
    return 1
  fi
}

# require_command <cmd> [display_name]
# Like check_command_exists but exits the script on failure.
require_command() {
  check_command_exists "$@" || exit 1
}

# ── Environment variable helpers ──────────────────────────────────────────────

# check_env_var <VAR_NAME> [description]
# Returns 0 if set and non-empty, 1 otherwise.
check_env_var() {
  local var_name="$1"
  local description="${2:-${var_name}}"
  local value
  value="${!var_name:-}"
  if [ -n "${value}" ]; then
    log_success "${description} is set"
    return 0
  else
    log_warning "${description} (${var_name}) is not set"
    return 1
  fi
}

# require_env_var <VAR_NAME> [description]
# Like check_env_var but exits on failure.
require_env_var() {
  check_env_var "$@" || {
    log_error "Required environment variable '${1}' is missing. Aborting."
    exit 1
  }
}

# ── Timing helpers ────────────────────────────────────────────────────────────

SCRIPT_START_TIME=""

start_timer() {
  SCRIPT_START_TIME="$(date +%s)"
}

# elapsed_time — prints human-readable elapsed time since start_timer
elapsed_time() {
  if [ -z "${SCRIPT_START_TIME}" ]; then
    echo "0s"
    return
  fi
  local now
  now="$(date +%s)"
  local secs=$(( now - SCRIPT_START_TIME ))
  local mins=$(( secs / 60 ))
  local rem=$(( secs % 60 ))
  if [ "${mins}" -gt 0 ]; then
    printf "%dm %ds" "${mins}" "${rem}"
  else
    printf "%ds" "${rem}"
  fi
}

# ── File / directory helpers ──────────────────────────────────────────────────

ensure_dir() {
  local dir="$1"
  mkdir -p "${dir}"
}

# ── HTTP / service helpers ─────────────────────────────────────────────────────

# wait_for_url <url> [max_attempts] [sleep_seconds]
# Polls <url> until it returns HTTP 2xx or 3xx, or gives up.
wait_for_url() {
  local url="$1"
  local max_attempts="${2:-30}"
  local sleep_secs="${3:-5}"
  local attempt=1

  while [ "${attempt}" -le "${max_attempts}" ]; do
    local http_code
    http_code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${url}" 2>/dev/null || true)"
    if [[ "${http_code}" =~ ^[23] ]]; then
      return 0
    fi
    printf "   ${SYMBOL_WARN} Waiting for %s (attempt %d/%d)…\n" "${url}" "${attempt}" "${max_attempts}"
    sleep "${sleep_secs}"
    attempt=$(( attempt + 1 ))
  done
  log_error "Timed out waiting for ${url}"
  return 1
}

# wait_for_deployment <function_name> [max_attempts]
# Polls Firebase Functions for an ACTIVE status.
wait_for_deployment() {
  local function_name="$1"
  local max_attempts="${2:-20}"
  local attempt=1

  while [ "${attempt}" -le "${max_attempts}" ]; do
    local status
    status="$(firebase functions:list 2>/dev/null \
      | grep "${function_name}" | grep -i 'active' || true)"
    if [ -n "${status}" ]; then
      log_success "${function_name} is ACTIVE"
      return 0
    fi
    printf "   ${SYMBOL_WARN} Waiting for function %s to become ACTIVE (attempt %d/%d)…\n" \
      "${function_name}" "${attempt}" "${max_attempts}"
    sleep 10
    attempt=$(( attempt + 1 ))
  done
  log_warning "Function ${function_name} did not become ACTIVE within the timeout"
  return 1
}

# ── Cleanup helpers ───────────────────────────────────────────────────────────

_CLEANUP_ITEMS=()

# register_cleanup <path_or_pid>
# Paths are deleted; PIDs are killed on exit.
register_cleanup() {
  _CLEANUP_ITEMS+=("$1")
}

cleanup_on_exit() {
  for item in "${_CLEANUP_ITEMS[@]:-}"; do
    [ -z "${item}" ] && continue
    if [ -e "${item}" ]; then
      rm -rf "${item}" 2>/dev/null || true
    elif kill -0 "${item}" 2>/dev/null; then
      kill "${item}" 2>/dev/null || true
    fi
  done
}

trap cleanup_on_exit EXIT

# ── Dry-run helper ────────────────────────────────────────────────────────────

# run_cmd [args…]
# In DRY_RUN mode, prints the command instead of executing it.
run_cmd() {
  if [ "${DRY_RUN:-false}" = "true" ]; then
    log_info "[DRY RUN] Would run: $*"
    return 0
  fi
  "$@"
}

# ── Summary helpers ───────────────────────────────────────────────────────────

SUMMARY_PASSED=0
SUMMARY_FAILED=0
SUMMARY_WARNED=0

record_pass()  { SUMMARY_PASSED=$(( SUMMARY_PASSED + 1 )); }
record_fail()  { SUMMARY_FAILED=$(( SUMMARY_FAILED + 1 )); }
record_warn()  { SUMMARY_WARNED=$(( SUMMARY_WARNED + 1 )); }

print_summary() {
  local label="${1:-Summary}"
  echo ""
  print_separator
  printf "${COLOR_BOLD}${COLOR_WHITE}📊 %s${COLOR_RESET}\n" "${label}"
  print_separator
  printf "   Passed  : ${COLOR_GREEN}%d${COLOR_RESET}\n" "${SUMMARY_PASSED}"
  printf "   Failed  : ${COLOR_RED}%d${COLOR_RESET}\n"   "${SUMMARY_FAILED}"
  printf "   Warnings: ${COLOR_YELLOW}%d${COLOR_RESET}\n" "${SUMMARY_WARNED}"
  printf "   Elapsed : %s\n" "$(elapsed_time)"
  if [ "${SUMMARY_FAILED}" -eq 0 ]; then
    printf "\n   ${SYMBOL_OK} ${COLOR_GREEN}${COLOR_BOLD}Overall: SUCCESS${COLOR_RESET}\n"
  else
    printf "\n   ${SYMBOL_FAIL} ${COLOR_RED}${COLOR_BOLD}Overall: FAILURE (${SUMMARY_FAILED} check(s) failed)${COLOR_RESET}\n"
  fi
  print_separator
  echo ""
}
