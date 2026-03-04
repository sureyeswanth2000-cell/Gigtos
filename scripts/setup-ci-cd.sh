#!/bin/bash
# setup-ci-cd.sh - GitHub Actions CI/CD setup for Gigtos
#
# Usage: ./scripts/setup-ci-cd.sh
#
# Creates (or overwrites) GitHub Actions workflow files:
#   .github/workflows/auto-deploy.yml   — deploy on PR merge to main
#   .github/workflows/test-on-push.yml  — run tests on every push
#
# No external services are called; this script only writes local files.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=config.sh
source "${SCRIPT_DIR}/config.sh"
# shellcheck source=utils.sh
source "${SCRIPT_DIR}/utils.sh"

WORKFLOWS_DIR="${PROJECT_ROOT}/.github/workflows"

# ─── Banner ──────────────────────────────────────────────────────────────────
print_section "GIGTOS CI/CD SETUP"
print_info "Workflows directory: ${WORKFLOWS_DIR}"

# ─── Ensure directory exists ──────────────────────────────────────────────────
mkdir -p "${WORKFLOWS_DIR}"
print_success "Workflow directory ready"

# ─── Write auto-deploy.yml ────────────────────────────────────────────────────
print_step "Writing auto-deploy.yml…"
cat > "${WORKFLOWS_DIR}/auto-deploy.yml" << 'YAML'
name: Auto Deploy on PR Merge

on:
  pull_request:
    types: [closed]
    branches:
      - main

jobs:
  deploy:
    if: github.event.pull_request.merged == true
    name: Deploy Cloud Functions
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: functions/package-lock.json

      - name: Install Firebase CLI
        run: npm install -g firebase-tools

      - name: Install Cloud Functions dependencies
        run: npm ci
        working-directory: functions

      - name: Deploy Cloud Functions
        run: firebase deploy --only functions --project ${{ secrets.FIREBASE_PROJECT_ID }} --non-interactive
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
          FIREBASE_PROJECT_ID: ${{ secrets.FIREBASE_PROJECT_ID }}

      - name: Post deployment summary
        if: always()
        run: |
          echo "## 🚀 Deployment Summary" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "| Item | Value |" >> $GITHUB_STEP_SUMMARY
          echo "|------|-------|" >> $GITHUB_STEP_SUMMARY
          echo "| PR | #${{ github.event.pull_request.number }} — ${{ github.event.pull_request.title }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Commit | \`${{ github.sha }}\` |" >> $GITHUB_STEP_SUMMARY
          echo "| Project | \`${{ secrets.FIREBASE_PROJECT_ID }}\` |" >> $GITHUB_STEP_SUMMARY
          echo "| Time | $(date '+%Y-%m-%d %H:%M:%S UTC') |" >> $GITHUB_STEP_SUMMARY
YAML
print_success "auto-deploy.yml created"

# ─── Write test-on-push.yml ───────────────────────────────────────────────────
print_step "Writing test-on-push.yml…"
cat > "${WORKFLOWS_DIR}/test-on-push.yml" << 'YAML'
name: Test on Push

on:
  push:
    branches:
      - main
      - 'feature/**'
      - 'fix/**'
  pull_request:
    branches:
      - main

jobs:
  lint-and-test:
    name: Lint & Test Cloud Functions
    runs-on: ubuntu-latest
    permissions:
      contents: read

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
          cache-dependency-path: functions/package-lock.json

      - name: Install Cloud Functions dependencies
        run: npm ci
        working-directory: functions

      - name: Run Cloud Functions tests
        run: npm test --if-present
        working-directory: functions

      - name: Install React app dependencies
        run: npm ci
        working-directory: react-app

      - name: Build React app
        run: npm run build
        working-directory: react-app
        env:
          CI: false

      - name: Post test summary
        if: always()
        run: |
          echo "## 🧪 Test Summary" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "| Item | Value |" >> $GITHUB_STEP_SUMMARY
          echo "|------|-------|" >> $GITHUB_STEP_SUMMARY
          echo "| Branch | \`${{ github.ref_name }}\` |" >> $GITHUB_STEP_SUMMARY
          echo "| Commit | \`${{ github.sha }}\` |" >> $GITHUB_STEP_SUMMARY
          echo "| Triggered by | ${{ github.event_name }} |" >> $GITHUB_STEP_SUMMARY
          echo "| Time | $(date '+%Y-%m-%d %H:%M:%S UTC') |" >> $GITHUB_STEP_SUMMARY
YAML
print_success "test-on-push.yml created"

# ─── Summary ─────────────────────────────────────────────────────────────────
print_section "CI/CD SETUP COMPLETE"
echo ""
print_success "Created: .github/workflows/auto-deploy.yml"
print_success "Created: .github/workflows/test-on-push.yml"
echo ""
print_info "Next steps:"
print_info "  1. Add repository secrets in GitHub:"
print_info "       FIREBASE_TOKEN   — run: firebase login:ci"
print_info "       FIREBASE_PROJECT_ID — your project ID"
print_info "  2. Push these workflow files to GitHub:"
print_info "       git add .github/workflows/ && git commit -m 'ci: add GitHub Actions workflows'"
print_info "  3. Workflows will activate automatically on the next push/PR"
