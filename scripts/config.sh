#!/bin/bash
# config.sh - Shared configuration for Gigtos deployment scripts

# Load colors if not already loaded
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=colors.sh
source "${SCRIPT_DIR}/colors.sh"

# ─── Project Settings ────────────────────────────────────────────────────────
REPO_OWNER="sureyeswanth2000-cell"
REPO_NAME="Gigtos"
PR_NUMBER="14"
DEFAULT_BRANCH="main"

# ─── Directory Paths ─────────────────────────────────────────────────────────
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
FUNCTIONS_DIR="${PROJECT_ROOT}/functions"
REACT_APP_DIR="${PROJECT_ROOT}/react-app"
LOGS_DIR="${PROJECT_ROOT}/logs"

# ─── Firebase Settings ────────────────────────────────────────────────────────
FIREBASE_PROJECT_ID="${FIREBASE_PROJECT_ID:-}"
FIREBASE_REGION="${FIREBASE_REGION:-us-central1}"

# ─── Node Version Requirements ────────────────────────────────────────────────
MIN_NODE_MAJOR=16

# ─── Deployment Timeouts (seconds) ────────────────────────────────────────────
DEPLOY_TIMEOUT=300
TEST_TIMEOUT=120

# ─── Report File Naming ───────────────────────────────────────────────────────
TIMESTAMP="$(date +%Y-%m-%d-%H%M%S)"
DEPLOY_REPORT="${LOGS_DIR}/deploy-report-${TIMESTAMP}.txt"
TEST_REPORT="${LOGS_DIR}/test-report-${TIMESTAMP}.txt"
VERIFY_REPORT="${LOGS_DIR}/verification-report-${TIMESTAMP}.txt"

# ─── Load .env if present ────────────────────────────────────────────────────
ENV_FILE="${PROJECT_ROOT}/.env"
if [ -f "${ENV_FILE}" ]; then
    # shellcheck disable=SC1090
    set -a
    source "${ENV_FILE}"
    set +a
fi

# ─── Ensure logs directory exists ─────────────────────────────────────────────
mkdir -p "${LOGS_DIR}"

# ─── Validate required env vars (call from scripts that need them) ────────────
validate_env() {
    local missing=0

    if [ -z "${FIREBASE_PROJECT_ID}" ]; then
        print_error "FIREBASE_PROJECT_ID is not set. Export it or add it to .env"
        missing=1
    fi

    if [ "$missing" -eq 1 ]; then
        print_info "Copy .env.example to .env and fill in your values:"
        print_info "  cp .env.example .env"
        return 1
    fi

    print_success "FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}"
    return 0
}

# ─── Tool version checks ──────────────────────────────────────────────────────
check_git() {
    if ! command -v git &>/dev/null; then
        print_error "git is not installed. Install from https://git-scm.com"
        return 1
    fi
    local ver
    ver=$(git --version | awk '{print $3}')
    print_success "Git v${ver}"
    return 0
}

check_node() {
    if ! command -v node &>/dev/null; then
        print_error "Node.js is not installed. Install v${MIN_NODE_MAJOR}+ from https://nodejs.org"
        return 1
    fi
    local ver major
    ver=$(node --version | tr -d 'v')
    major=$(echo "$ver" | cut -d. -f1)
    if [ "$major" -lt "${MIN_NODE_MAJOR}" ]; then
        print_error "Node.js v${ver} is too old. Requires v${MIN_NODE_MAJOR}+."
        return 1
    fi
    print_success "Node.js v${ver}"
    return 0
}

check_npm() {
    if ! command -v npm &>/dev/null; then
        print_error "npm is not installed."
        return 1
    fi
    local ver
    ver=$(npm --version)
    print_success "npm v${ver}"
    return 0
}

check_firebase_cli() {
    if ! command -v firebase &>/dev/null; then
        print_error "Firebase CLI is not installed. Run: npm install -g firebase-tools"
        return 1
    fi
    local ver
    ver=$(firebase --version 2>/dev/null | head -n1)
    print_success "Firebase CLI v${ver}"
    return 0
}

check_gh_cli() {
    if ! command -v gh &>/dev/null; then
        print_error "GitHub CLI is not installed. Install from https://cli.github.com"
        return 1
    fi
    local ver
    ver=$(gh --version 2>/dev/null | head -n1 | awk '{print $3}')
    print_success "GitHub CLI v${ver}"
    return 0
}

check_all_prerequisites() {
    print_subsection "Checking Prerequisites"
    local failed=0
    check_git    || failed=1
    check_node   || failed=1
    check_npm    || failed=1
    check_firebase_cli || failed=1
    check_gh_cli || failed=1
    return $failed
}
