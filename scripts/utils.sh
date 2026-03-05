#!/usr/bin/env bash
# scripts/utils.sh
# Shared helper functions: logging, command execution, polling, and cleanup.
# Source this file in other scripts: source "$(dirname "$0")/utils.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/colors.sh
source "${SCRIPT_DIR}/colors.sh"

# ── Global state ──────────────────────────────────────────────────────────────
LOG_FILE=""        # Set by init_logging()
START_TIME=""      # Set by init_logging()
ERRORS=()          # Accumulated error messages

# ── Logging initialisation ────────────────────────────────────────────────────
init_logging() {
  local tag="${1:-deploy}"
  local log_dir="${LOG_DIR:-reports}"
  mkdir -p "$log_dir"
  LOG_FILE="${log_dir}/${tag}-$(date '+%Y-%m-%d-%H%M%S').log"
  START_TIME=$(date +%s)
  exec > >(tee -a "$LOG_FILE") 2>&1
  log_info "Log file: ${LOG_FILE}"
}

# ── Logging helpers ───────────────────────────────────────────────────────────
log_info()    { echo -e "${CYAN}[INFO]${NC}  $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   {
  echo -e "${RED}[ERROR]${NC} $*" >&2
  ERRORS+=("$*")
}
log_debug()   {
  [[ "${VERBOSE:-false}" == "true" ]] || return 0
  echo -e "${DIM}[DEBUG] $*${NC}"
}

# ── Command existence check ───────────────────────────────────────────────────
# Returns 0 if the command is found, 1 otherwise.
check_command() {
  local cmd="$1"
  if command -v "$cmd" &>/dev/null; then
    local version
    version=$("$cmd" --version 2>/dev/null | head -1 || echo "found")
    print_ok "${cmd} – ${version}"
    return 0
  else
    print_fail "${cmd} – NOT FOUND"
    log_error "Required command not found: ${cmd}"
    return 1
  fi
}

# ── Run a command with optional dry-run support ───────────────────────────────
# Usage: run_command "Description" cmd arg1 arg2 ...
run_command() {
  local desc="$1"; shift
  log_debug "Running: $*"

  if [[ "${DRY_RUN:-false}" == "true" ]]; then
    print_warn "[DRY-RUN] Would run: $*"
    return 0
  fi

  local output
  if output=$("$@" 2>&1); then
    log_debug "$output"
    return 0
  else
    local exit_code=$?
    log_error "${desc} failed (exit ${exit_code}): $output"
    return "$exit_code"
  fi
}

# ── Run a command and show output regardless of VERBOSE ───────────────────────
run_visible() {
  local desc="$1"; shift
  log_info "Running: $*"
  if [[ "${DRY_RUN:-false}" == "true" ]]; then
    print_warn "[DRY-RUN] Would run: $*"
    return 0
  fi
  "$@"
}

# ── Poll until a Firebase Cloud Function reaches ACTIVE status ────────────────
# Usage: poll_deployment <function_name> <project_id> <region> [max_attempts]
poll_deployment() {
  local func_name="$1"
  local project="$2"
  local region="${3:-us-central1}"
  local max="${4:-30}"
  local attempt=0

  log_info "Polling deployment status of ${func_name}…"
  while [[ $attempt -lt $max ]]; do
    local status
    status=$(firebase functions:list --project "$project" 2>/dev/null \
      | grep -i "$func_name" | grep -oiE 'ACTIVE|FAILED|DEPLOYING' | head -1 || true)

    case "${status^^}" in
      ACTIVE)
        print_ok "${func_name} is ACTIVE"
        return 0
        ;;
      FAILED)
        log_error "${func_name} deployment FAILED"
        return 1
        ;;
      *)
        attempt=$((attempt + 1))
        printf "\r   ${CYAN}⠋${NC} Waiting for %s… (%d/%d)" "$func_name" "$attempt" "$max"
        sleep 5
        ;;
    esac
  done

  log_error "Timed out waiting for ${func_name} to become ACTIVE"
  return 1
}

# ── Save a timestamped report ─────────────────────────────────────────────────
# Usage: save_report <tag> <content_string>
save_report() {
  local tag="$1"
  local content="$2"
  local dir="${LOG_DIR:-reports}"
  mkdir -p "$dir"
  local report_file="${dir}/${tag}-$(date '+%Y-%m-%d-%H%M%S').txt"
  echo -e "$content" > "$report_file"
  log_success "Report saved: ${report_file}"
  echo "$report_file"
}

# ── Elapsed time ──────────────────────────────────────────────────────────────
elapsed_time() {
  local end_time
  end_time=$(date +%s)
  local secs=$(( end_time - ${START_TIME:-end_time} ))
  printf '%dm %ds' $((secs / 60)) $((secs % 60))
}

# ── Cleanup temporary files ───────────────────────────────────────────────────
cleanup() {
  local exit_code=${1:-0}
  log_debug "Cleaning up temporary files…"
  rm -f /tmp/gigtos_deploy_*.tmp 2>/dev/null || true

  if [[ $exit_code -ne 0 && ${#ERRORS[@]} -gt 0 ]]; then
    echo ""
    echo -e "${RED}${BOLD}Errors encountered:${NC}"
    for err in "${ERRORS[@]}"; do
      echo -e "  ${RED}${SYM_FAIL}${NC} $err"
    done
  fi
}

# ── Register cleanup on exit ──────────────────────────────────────────────────
trap_cleanup() {
  local exit_code=$?
  cleanup "$exit_code"
  exit "$exit_code"
}
