#!/bin/bash
# utils.sh - Helper utility functions for Gigtos deployment scripts

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=colors.sh
source "${SCRIPT_DIR}/colors.sh"

# ─── Logging ─────────────────────────────────────────────────────────────────
LOG_FILE=""

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
    echo "$msg"
    if [ -n "${LOG_FILE}" ]; then
        echo "$msg" >> "${LOG_FILE}"
    fi
}

log_only() {
    if [ -n "${LOG_FILE}" ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "${LOG_FILE}"
    fi
}

set_log_file() {
    LOG_FILE="$1"
    mkdir -p "$(dirname "${LOG_FILE}")"
    : > "${LOG_FILE}"
    log "Log file initialised: ${LOG_FILE}"
}

# ─── Timing ──────────────────────────────────────────────────────────────────
START_TIME=""

start_timer() {
    START_TIME=$(date +%s)
}

elapsed_time() {
    local end
    end=$(date +%s)
    local secs=$(( end - START_TIME ))
    if [ "$secs" -ge 60 ]; then
        echo "$((secs / 60))m $((secs % 60))s"
    else
        echo "${secs}s"
    fi
}

# ─── Date helpers ─────────────────────────────────────────────────────────────
# get_relative_date <offset_days>
# Returns YYYY-MM-DD for today + offset_days (negative offset goes into the past).
# Works on both macOS (BSD date) and Linux (GNU date).
get_relative_date() {
    local days="$1"
    # macOS / BSD date: -v accepts +Nd or -Nd
    date -v"${days}d" '+%Y-%m-%d' 2>/dev/null && return
    # Linux / GNU date: "N days" or "-N days"
    local human_offset
    if [[ "$days" == -* ]]; then
        human_offset="${days#-} days ago"
    else
        human_offset="${days} days"
    fi
    date -d "${human_offset}" '+%Y-%m-%d' 2>/dev/null && return
    echo "ERROR: could not compute relative date (offset=${days})" >&2
    return 1
}

# ─── Git helpers ─────────────────────────────────────────────────────────────
is_git_repo() {
    git -C "${1:-.}" rev-parse --git-dir &>/dev/null
}

get_current_branch() {
    git rev-parse --abbrev-ref HEAD 2>/dev/null
}

is_working_tree_clean() {
    [ -z "$(git status --porcelain 2>/dev/null)" ]
}

stash_changes() {
    if ! is_working_tree_clean; then
        print_warning "Working tree is dirty — stashing changes."
        git stash push -m "auto-stash before deploy $(date +%s)" && return 0
        return 1
    fi
    return 0
}

# ─── Retry helper ─────────────────────────────────────────────────────────────
# Usage: retry <attempts> <delay_secs> <command> [args...]
retry() {
    local attempts=$1 delay=$2
    shift 2
    local count=0
    until "$@"; do
        count=$(( count + 1 ))
        if [ "$count" -ge "$attempts" ]; then
            print_error "Command failed after ${attempts} attempts: $*"
            return 1
        fi
        print_warning "Attempt ${count} failed. Retrying in ${delay}s…"
        sleep "$delay"
    done
}

# ─── Confirmation prompt ──────────────────────────────────────────────────────
confirm() {
    local prompt="${1:-Are you sure?} [y/N] "
    local answer
    read -r -p "$prompt" answer
    [[ "$answer" =~ ^[Yy]$ ]]
}

# ─── Section banner for report files ─────────────────────────────────────────
report_section() {
    local title="$1"
    local border
    border=$(printf '═%.0s' {1..63})
    echo ""
    echo "${border}"
    echo "  ${title}"
    echo "${border}"
}

# ─── Pass/fail counters ───────────────────────────────────────────────────────
PASS_COUNT=0
FAIL_COUNT=0

record_pass() {
    PASS_COUNT=$(( PASS_COUNT + 1 ))
    print_result "pass" "$1"
    log_only "PASS: $1"
}

record_fail() {
    FAIL_COUNT=$(( FAIL_COUNT + 1 ))
    print_result "fail" "$1"
    log_only "FAIL: $1"
}

reset_counters() {
    PASS_COUNT=0
    FAIL_COUNT=0
}

summary_counts() {
    echo "Passed: ${PASS_COUNT} | Failed: ${FAIL_COUNT} | Total: $(( PASS_COUNT + FAIL_COUNT ))"
}

# ─── Dry-run guard ────────────────────────────────────────────────────────────
DRY_RUN=false

run_cmd() {
    if [ "${DRY_RUN}" = true ]; then
        print_info "[DRY-RUN] Would run: $*"
        return 0
    fi
    "$@"
}

parse_flags() {
    for arg in "$@"; do
        case "$arg" in
            --dry-run) DRY_RUN=true ;;
            --skip-tests) SKIP_TESTS=true ;;
            --verbose) VERBOSE=true ;;
        esac
    done
}

# ─── Node / npm helpers ───────────────────────────────────────────────────────
npm_install() {
    local dir="${1:-.}"
    print_step "Installing npm dependencies in ${dir}…"
    run_cmd npm install --prefix "${dir}" --silent
}

# ─── Firebase helpers ─────────────────────────────────────────────────────────
firebase_deploy_functions() {
    local project="${1:-${FIREBASE_PROJECT_ID}}"
    print_step "Deploying Cloud Functions to project '${project}'…"
    run_cmd firebase deploy --only functions --project "${project}" --non-interactive
}

firebase_check_auth() {
    if firebase projects:list &>/dev/null; then
        print_success "Firebase authenticated"
        return 0
    fi
    print_error "Not authenticated with Firebase. Run: firebase login"
    return 1
}

# ─── GitHub CLI helpers ───────────────────────────────────────────────────────
gh_pr_merge() {
    local pr_number="$1"
    print_step "Merging PR #${pr_number} via GitHub CLI…"
    run_cmd gh pr merge "${pr_number}" --merge --auto
}

gh_pr_state() {
    local pr_number="$1"
    # Use gh's built-in --jq to reliably extract the state field
    gh pr view "${pr_number}" --json state --jq '.state' 2>/dev/null || echo "unknown"
}

gh_pr_title() {
    local pr_number="$1"
    gh pr view "${pr_number}" --json title --jq '.title' 2>/dev/null || echo "unknown"
}
