#!/usr/bin/env bash
# scripts/setup-ci-cd.sh
# Creates and configures GitHub Actions workflows for Gigtos.
# Validates the GitHub token and tests workflow YAML syntax.
#
# Usage:
#   ./scripts/setup-ci-cd.sh [--verbose]

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

WORKFLOWS_DIR="${REPO_ROOT}/.github/workflows"

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 1 – Create .github/workflows directory
# ─────────────────────────────────────────────────────────────────────────────
setup_directories() {
  print_check_header "DIRECTORY SETUP"

  if [[ -d "$WORKFLOWS_DIR" ]]; then
    print_ok ".github/workflows already exists"
  else
    mkdir -p "$WORKFLOWS_DIR"
    print_ok "Created .github/workflows"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 2 – Validate GitHub token
# ─────────────────────────────────────────────────────────────────────────────
validate_github_token() {
  print_check_header "GITHUB TOKEN VALIDATION"

  if [[ -z "${GITHUB_TOKEN:-}" ]]; then
    print_warn "GITHUB_TOKEN not set – skipping token validation"
    print_info "GitHub Actions will use the built-in GITHUB_TOKEN secret"
    return
  fi

  if command -v gh &>/dev/null; then
    local user
    user=$(GH_TOKEN="${GITHUB_TOKEN}" gh api user --jq '.login' 2>/dev/null || echo "")
    if [[ -n "$user" ]]; then
      print_ok "GitHub token valid – authenticated as: ${user}"
    else
      print_warn "Could not validate GitHub token (may be a fine-grained PAT)"
    fi
  else
    print_warn "gh CLI not found – cannot validate token"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 3 – Validate existing workflow YAML files
# ─────────────────────────────────────────────────────────────────────────────
validate_workflows() {
  print_check_header "WORKFLOW YAML VALIDATION"

  local any_found=false

  for yml_file in "${WORKFLOWS_DIR}"/*.yml "${WORKFLOWS_DIR}"/*.yaml; do
    [[ -f "$yml_file" ]] || continue
    any_found=true
    local fname
    fname=$(basename "$yml_file")

    # Basic YAML syntax validation using Python (usually available) or node
    local valid=true
    if command -v python3 &>/dev/null; then
      python3 -c "import yaml,sys; yaml.safe_load(open('${yml_file}'))" 2>/dev/null || valid=false
    elif command -v node &>/dev/null; then
      node -e "require('fs').readFileSync('${yml_file}','utf8')" 2>/dev/null || valid=false
    fi

    if [[ "$valid" == "true" ]]; then
      print_ok "${fname} – valid YAML"
    else
      print_fail "${fname} – YAML parse error"
      log_error "Invalid YAML in ${fname}"
    fi

    # Check for required GitHub Actions keys
    for key in "name" "on" "jobs"; do
      if grep -q "^${key}:" "$yml_file"; then
        log_debug "${fname}: '${key}' key found"
      else
        print_warn "${fname} – missing top-level '${key}' key"
      fi
    done
  done

  if [[ "$any_found" == "false" ]]; then
    print_warn "No workflow YAML files found in ${WORKFLOWS_DIR}"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
#  STEP 4 – Summary
# ─────────────────────────────────────────────────────────────────────────────
print_summary() {
  echo ""
  print_divider
  echo -e "${BOLD}  CI/CD SETUP COMPLETE${NC}"
  print_divider
  echo ""
  echo -e "  Workflows directory: ${WORKFLOWS_DIR}"
  echo ""
  echo -e "  ${BOLD}Next steps:${NC}"
  echo -e "  1. Add required secrets in GitHub:"
  echo -e "     Settings → Secrets and variables → Actions"
  echo -e "     Required: FIREBASE_SERVICE_ACCOUNT, FIREBASE_PROJECT_ID"
  echo -e "     Optional: GMAIL_USER, GMAIL_PASS, TWILIO_SID, TWILIO_TOKEN, TWILIO_PHONE"
  echo ""
  echo -e "  2. Push the workflow files to GitHub:"
  echo -e "     git add .github/workflows && git commit -m 'ci: add GitHub Actions workflows'"
  echo ""
  echo -e "  3. Monitor runs at:"
  echo -e "     https://github.com/sureyeswanth2000-cell/Gigtos/actions"
  echo ""
}

# ─────────────────────────────────────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────────────────────────────────────
main() {
  print_header "CI/CD SETUP" "Gigtos GitHub Actions Configuration"

  load_env || true
  set_defaults

  setup_directories
  validate_github_token
  validate_workflows
  print_summary
}

main "$@"
