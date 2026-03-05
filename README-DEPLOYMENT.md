# Gigtos – Deployment Guide

Complete guide for deploying PR #14 (createBooking Cloud Function) using the
automation scripts and CI/CD workflows in this repository.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Configuration Setup](#configuration-setup)
4. [Script Reference](#script-reference)
5. [GitHub Actions Workflows](#github-actions-workflows)
6. [Usage Examples](#usage-examples)
7. [Expected Output](#expected-output)
8. [Troubleshooting](#troubleshooting)
9. [Success Criteria Checklist](#success-criteria-checklist)

---

## Quick Start

```bash
# 1. Clone the repository (if not already done)
git clone https://github.com/sureyeswanth2000-cell/Gigtos.git
cd Gigtos

# 2. Configure environment
cp .env.example .env
nano .env        # fill in FIREBASE_PROJECT_ID, GITHUB_TOKEN, etc.

# 3. Make scripts executable
chmod +x scripts/*.sh

# 4. Run a dry-run first (safe – no side effects)
./scripts/deploy.sh --dry-run

# 5. Full deployment
./scripts/deploy.sh

# 6. Verify the deployment
./scripts/verify-deployment.sh
```

---

## Prerequisites

| Tool | Minimum Version | Install |
|------|----------------|---------|
| Git | 2.x | https://git-scm.com |
| Node.js | 18.x | https://nodejs.org |
| Firebase CLI | 12.x | `npm install -g firebase-tools` |
| GitHub CLI | 2.x | https://cli.github.com |
| curl | any | usually pre-installed |

Authenticate the CLIs before running the scripts:

```bash
firebase login
gh auth login
```

---

## Configuration Setup

1. **Copy the template:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env`** with your values:

   | Variable | Required | Description |
   |----------|----------|-------------|
   | `FIREBASE_PROJECT_ID` | ✅ | Your Firebase project ID (e.g. `gigtos-prod`) |
   | `GITHUB_TOKEN` | ✅ | Personal Access Token with `repo` + `workflow` scopes |
   | `FIREBASE_REGION` | Optional | Default: `us-central1` |
   | `GMAIL_USER` | Optional | Gmail address for email notifications |
   | `GMAIL_PASS` | Optional | Gmail App Password (not your account password) |
   | `TWILIO_SID` | Optional | Twilio Account SID for SMS |
   | `TWILIO_TOKEN` | Optional | Twilio Auth Token |
   | `TWILIO_PHONE` | Optional | Twilio phone number (E.164 format) |
   | `DRY_RUN` | Optional | `true` to print commands without executing |
   | `VERBOSE` | Optional | `true` for debug output |
   | `SKIP_TESTS` | Optional | `true` to skip test suite |

3. **For Firebase notifications**, set the config via CLI:
   ```bash
   firebase functions:config:set \
     gmail.user="your@gmail.com" \
     gmail.pass="your-app-password" \
     twilio.sid="ACxxxx" \
     twilio.token="your-token" \
     twilio.phone="+1234567890"
   ```

---

## Script Reference

All scripts live in the `scripts/` directory. Make them executable with:
```bash
chmod +x scripts/*.sh
```

---

### `scripts/deploy.sh` — Main Orchestrator

Handles the complete end-to-end deployment pipeline.

**Usage:**
```bash
./scripts/deploy.sh [--dry-run] [--skip-tests] [--verbose]
```

**Flags:**

| Flag | Description |
|------|-------------|
| `--dry-run` | Print all commands without executing them |
| `--skip-tests` | Skip the automated test suite |
| `--verbose` | Enable debug-level output |
| `--help` | Show usage information |

**Steps performed:**
1. Validates prerequisites (git, node, firebase, gh)
2. Validates environment variables
3. Merges PR #14 into main via GitHub CLI
4. Installs npm dependencies in `functions/`
5. Deploys Cloud Functions to Firebase
6. Runs the automated test suite
7. Generates a timestamped deployment report
8. Rolls back on failure

**Output:** `reports/deploy-report-YYYY-MM-DD-HHMMSS.txt`

---

### `scripts/test-booking.sh` — Test Suite

Runs 12 automated tests covering the `createBooking` Cloud Function.

**Usage:**
```bash
./scripts/test-booking.sh [--verbose]

# Test against live Firebase (not emulator)
FIREBASE_EMULATOR=false ./scripts/test-booking.sh
```

**Tests included:**

| # | Test | Type |
|---|------|------|
| 1 | `createBooking` export defined | Structural |
| 2 | Email/SMS trigger wired | Structural |
| 3 | Authentication enforced | Structural |
| 4 | Firestore fields verified (12+) | Structural |
| 5 | Missing required fields rejected | Integration |
| 6 | Invalid email format rejected | Integration |
| 7 | Past scheduled date rejected | Integration |
| 8 | Single-day booking creation | Integration |
| 9 | Multi-day booking (2026-03-10 → 2026-03-15) | Integration |
| 10 | Future date booking accepted | Integration |
| 11 | Unauthenticated call rejected | Integration |
| 12 | Empty payload rejected | Integration |

Integration tests require the Firebase Emulator. Start it with:
```bash
firebase emulators:start
```

**Output:** `reports/test-report-YYYY-MM-DD-HHMMSS.txt`

---

### `scripts/verify-deployment.sh` — Health Check

Post-deployment verification and health dashboard.

**Usage:**
```bash
./scripts/verify-deployment.sh [--verbose]
```

**Checks performed:**
- PR #14 merged into main
- `createBooking` Cloud Function is ACTIVE
- `onBookingCreated` trigger present
- Firestore rules file present
- Firebase config references rules
- `bookings` collection referenced
- Gmail and Twilio credentials configured
- Security rules don't allow open access
- No hardcoded API keys in source

**Output:** `reports/verification-report-YYYY-MM-DD-HHMMSS.txt`

---

### `scripts/setup-ci-cd.sh` — CI/CD Setup

Creates `.github/workflows` directory and validates GitHub Actions configuration.

**Usage:**
```bash
./scripts/setup-ci-cd.sh [--verbose]
```

---

### `scripts/colors.sh` — Terminal Formatting

Provides color constants and formatting helpers used by all other scripts.

**Not intended to be run directly.** Source it in your scripts:
```bash
source "$(dirname "$0")/colors.sh"
```

---

### `scripts/config.sh` — Configuration Management

Loads `.env`, sets defaults, and validates required variables.

**Not intended to be run directly.** Source it in your scripts:
```bash
source "$(dirname "$0")/config.sh"
init_config
```

---

### `scripts/utils.sh` — Shared Helpers

Provides logging, command execution, polling, and reporting functions.

**Not intended to be run directly.** Source it in your scripts:
```bash
source "$(dirname "$0")/utils.sh"
```

**Key functions:**

| Function | Description |
|----------|-------------|
| `log_info` | Blue `[INFO]` message |
| `log_success` | Green `[OK]` message |
| `log_error` | Red `[ERROR]` to stderr |
| `log_warn` | Yellow `[WARN]` message |
| `log_debug` | Debug (only when `VERBOSE=true`) |
| `check_command` | Verify a CLI tool is installed |
| `run_command` | Execute with dry-run support |
| `poll_deployment` | Wait for Cloud Function to become ACTIVE |
| `save_report` | Write timestamped report file |
| `elapsed_time` | Return human-readable duration |
| `spinner` | Animated loading spinner |
| `cleanup` | Remove temp files on exit |

---

## GitHub Actions Workflows

### `.github/workflows/auto-deploy.yml`

**Triggers:**
- Every push to `main` (i.e., when PR #14 is merged)
- Manual trigger via `workflow_dispatch`

**Jobs:**
1. **Install** – `npm ci` in `functions/`
2. **Deploy** – `firebase deploy --only functions`
3. **Test** – structural + integration tests
4. **Report** – generate deployment summary + upload artifacts
5. **Rollback** – automatically reverts on failure

**Required Secrets** (set in GitHub → Settings → Secrets and variables → Actions):

| Secret | Required | Description |
|--------|----------|-------------|
| `FIREBASE_PROJECT_ID` | ✅ | Firebase project ID |
| `FIREBASE_SERVICE_ACCOUNT` | ✅ | Service account JSON key |
| `FIREBASE_REGION` | Optional | Default: `us-central1` |
| `GMAIL_USER` | Optional | Gmail address |
| `GMAIL_PASS` | Optional | Gmail App Password |
| `TWILIO_SID` | Optional | Twilio Account SID |
| `TWILIO_TOKEN` | Optional | Twilio Auth Token |
| `TWILIO_PHONE` | Optional | Twilio phone number |

---

### `.github/workflows/test-on-push.yml`

**Triggers:**
- Every push to any branch
- Every pull request (opened, updated, reopened)

**Jobs:**
1. **Syntax** – validates shell script and YAML syntax
2. **Unit Tests** – structural tests (no emulator needed)
3. **Security** – scans for hardcoded secrets, open Firestore rules
4. **PR Comment** – posts a status table as a PR comment

---

## Usage Examples

### Standard deployment
```bash
./scripts/deploy.sh
```

### Dry run (inspect without executing)
```bash
./scripts/deploy.sh --dry-run
```

### Deploy without tests
```bash
./scripts/deploy.sh --skip-tests
```

### Verbose deployment
```bash
./scripts/deploy.sh --verbose
```

### Run tests against the emulator
```bash
firebase emulators:start &
sleep 5
./scripts/test-booking.sh
```

### Run tests against live Firebase
```bash
FIREBASE_EMULATOR=false ./scripts/test-booking.sh
```

### Verify after manual deployment
```bash
./scripts/verify-deployment.sh
```

### Set up CI/CD
```bash
./scripts/setup-ci-cd.sh
# Then add secrets in GitHub Settings
```

---

## Expected Output

```
═══════════════════════════════════════════════════════════════
  DEPLOYMENT REPORT - 2026-03-04 15:32:45
═══════════════════════════════════════════════════════════════

✅ PREREQUISITES CHECK
   ✓ git – git version 2.40.0
   ✓ node – v18.14.0
   ✓ firebase – 12.0.0
   ✓ gh – gh version 2.31.0

✅ ENVIRONMENT VALIDATION
   ✓ FIREBASE_PROJECT_ID=gigtos-prod
   ✓ 3 optional notification variables configured
   ✓ All required variables present

✅ PR #14 MERGE
   ✓ Fetched latest changes
   ✓ Merged PR #14 (commit: abc123def456)

✅ DEPENDENCY INSTALLATION
   ✓ Installed 42 npm dependencies

✅ CLOUD FUNCTIONS DEPLOYMENT
   ✓ Cloud Functions deployed
   ✓ Deployment Time: 45s
   ✓ createBooking is ACTIVE

✅ RUNNING TEST SUITE
   ✓ createBooking export defined
   ✓ Email/SMS trigger wired
   ✓ Authentication enforced
   ✓ Firestore fields verified (12+ fields verified in source)

📊 SUMMARY
   Status: ✅ SUCCESS
   Total Execution Time: 3m 24s
═══════════════════════════════════════════════════════════════
```

---

## Troubleshooting

### `Missing or insufficient permissions` on Firestore
**Cause:** Client-side writes to `bookings` are blocked by security rules.  
**Fix:** PR #14 routes writes through the `createBooking` Cloud Function. Ensure it is deployed.

### `exports.createBooking not found in functions/index.js`
**Cause:** PR #14 has not been merged.  
**Fix:** Run `./scripts/deploy.sh` or merge the PR manually.

### `Firebase CLI not found`
```bash
npm install -g firebase-tools
firebase login
```

### `gh: command not found`
```bash
# macOS
brew install gh
# Linux
sudo apt install gh
# Or download from https://cli.github.com
gh auth login
```

### Emulator tests skipped
Integration tests require the Firebase Emulator to be running:
```bash
firebase emulators:start
```
Structural tests (source inspection) run without the emulator.

### `FIREBASE_PROJECT_ID` not set
```bash
cp .env.example .env
nano .env   # set FIREBASE_PROJECT_ID=your-project-id
```

### Deploy fails mid-way
The script automatically attempts a rollback. Check the deployment report in
`reports/` for details and verify the function status in the Firebase Console:
https://console.firebase.google.com

### GitHub Actions workflow not triggering
1. Ensure the workflow files are pushed to the `main` branch.
2. Check that required secrets are configured in GitHub Settings.
3. Verify the `FIREBASE_SERVICE_ACCOUNT` secret contains a valid JSON service
   account key.

---

## Success Criteria Checklist

- [ ] All scripts are executable (`chmod +x scripts/*.sh`)
- [ ] Dry-run completes without side effects
- [ ] Full deployment completes successfully
- [ ] All structural tests pass
- [ ] Integration tests pass (requires emulator or live project)
- [ ] Verification confirms `createBooking` is ACTIVE
- [ ] GitHub Actions workflows execute on push and PR
- [ ] Reports are generated in `reports/`
- [ ] Error handling triggers rollback on failure
- [ ] Color output displays correctly in terminal
- [ ] `.env` is not committed to git
- [ ] No hardcoded secrets in source files
