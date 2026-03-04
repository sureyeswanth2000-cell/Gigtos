# Gigtos — Deployment & CI/CD Guide

> **PR #14** introduces the automated deployment pipeline for Gigtos Cloud Functions.
> This guide explains how to use the scripts to deploy, test, and verify the system.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Directory Structure](#directory-structure)
3. [Configuration Setup](#configuration-setup)
4. [Script Overview](#script-overview)
5. [Usage Examples](#usage-examples)
6. [GitHub Actions Workflows](#github-actions-workflows)
7. [Report Format](#report-format)
8. [Troubleshooting](#troubleshooting)
9. [FAQ](#faq)

---

## Quick Start

```bash
# 1. Clone the repository (if you haven't already)
git clone https://github.com/sureyeswanth2000-cell/Gigtos.git
cd Gigtos

# 2. Copy and fill in the environment template
cp .env.example .env
# Edit .env with your Firebase, GitHub, Gmail, and Twilio credentials

# 3. Make scripts executable
chmod +x scripts/*.sh

# 4. Full automated deployment (merges PR #14, deploys, runs tests)
./scripts/deploy.sh

# 5. View the generated report
ls reports/
```

---

## Directory Structure

```
Gigtos/
├── scripts/
│   ├── deploy.sh              # Main deployment orchestrator
│   ├── test-booking.sh        # Booking test suite
│   ├── verify-deployment.sh   # Post-deployment verification
│   ├── setup-ci-cd.sh         # GitHub Actions & secrets setup
│   ├── config.sh              # Centralized configuration loader
│   ├── colors.sh              # Terminal color / formatting helpers
│   └── utils.sh               # Shared log / timing / spinner helpers
├── .github/
│   └── workflows/
│       ├── auto-deploy.yml    # Auto-deploy when PR #14 is merged
│       └── test-on-push.yml   # Run tests on every commit / PR
├── reports/                   # Generated at runtime (gitignored)
│   ├── deploy-report-*.txt
│   ├── test-report-*.txt
│   └── verification-report-*.txt
├── functions/
│   └── index.js               # Firebase Cloud Functions
├── .env.example               # Environment variable template
├── .env                       # Your local secrets (gitignored!)
└── README-DEPLOYMENT.md       # This file
```

---

## Configuration Setup

### 1. Copy the template

```bash
cp .env.example .env
```

### 2. Fill in required values

| Variable | Description | Where to find it |
|---|---|---|
| `FIREBASE_PROJECT_ID` | Firebase project ID | Firebase console → Project settings |
| `FIREBASE_REGION` | Cloud Functions region | Default: `us-central1` |
| `GITHUB_TOKEN` | GitHub PAT (repo + workflow scopes) | [github.com/settings/tokens](https://github.com/settings/tokens) |
| `GMAIL_USER` | Gmail address for notifications | Your Gmail account |
| `GMAIL_PASS` | Gmail app password | [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) |
| `TWILIO_SID` | Twilio Account SID | [console.twilio.com](https://console.twilio.com) |
| `TWILIO_TOKEN` | Twilio Auth Token | Twilio console |
| `TWILIO_PHONE` | Twilio phone number (E.164) | Twilio console |

### 3. Configure Firebase Functions runtime variables

```bash
# Email
firebase functions:config:set gmail.user="you@gmail.com" gmail.pass="app-password"

# SMS
firebase functions:config:set twilio.sid="ACxxx" twilio.token="yyy" twilio.phone="+123456789"

# OTP security
firebase functions:config:set otp.secret="$(openssl rand -hex 32)"
```

---

## Script Overview

### `scripts/deploy.sh` — Main deployment orchestrator

Orchestrates the full deployment pipeline end-to-end.

**What it does:**
1. Validates prerequisites (git, node, firebase CLI, gh CLI)
2. Validates required environment variables
3. Merges PR #14 via GitHub CLI
4. Installs Cloud Functions dependencies
5. Deploys Cloud Functions to Firebase
6. Runs the booking test suite
7. Generates a timestamped deployment report
8. Rolls back on failure

**Flags:**
| Flag | Description |
|---|---|
| `--dry-run` | Preview actions without executing |
| `--skip-tests` | Skip the test suite |
| `--verbose` | Enable verbose output |
| `--help` | Show usage |

---

### `scripts/test-booking.sh` — Booking test suite

Runs 9 automated tests against the `createBooking` Cloud Function.

**Tests included:**
1. Missing `serviceType` → expects HTTP 4xx
2. Missing `date` → expects HTTP 4xx
3. Invalid date format → expects HTTP 4xx
4. Past date → expects HTTP 4xx
5. Valid single-day booking → expects HTTP 2xx
6. Valid multi-day booking (2026-03-10 → 2026-03-15) → expects HTTP 2xx
7. Firestore document persisted after creation
8. `createBooking` Cloud Function is ACTIVE
9. Gmail configuration is present

**Flags:** `--dry-run`, `--verbose`, `--help`

---

### `scripts/verify-deployment.sh` — Post-deployment verification

Checks the health of the entire deployment.

**Sections:**
- **GitHub** — PR #14 merged, main branch updated
- **Cloud Functions** — `createBooking`, `onBookingCreated`, `onBookingStatusChange` active
- **Firestore** — read/write works, security rules present
- **Email/SMS** — Gmail and Twilio configured in Firebase Functions config
- **Security** — `.env` not committed, `.gitignore` correct

**Flags:** `--dry-run`, `--verbose`, `--help`

---

### `scripts/setup-ci-cd.sh` — GitHub Actions setup

Configures the repository for CI/CD:

1. Verifies GitHub CLI authentication
2. Enables GitHub Actions
3. Sets all required repository secrets from your `.env`
4. Applies branch protection rules to `main`
5. Verifies workflow files are present

**Flags:** `--dry-run`, `--verbose`, `--help`

---

### `scripts/config.sh` — Configuration loader

Sources this file to load environment variables, set defaults, and export values. Call `validate_config` to verify required variables are set.

### `scripts/colors.sh` — Terminal formatting

Provides color constants, status symbols (✓ ✗ ⚠ ℹ), spinner functions, and header/separator formatting used by all other scripts.

### `scripts/utils.sh` — Shared helpers

Provides: `log_success`, `log_error`, `log_warning`, `log_info`, `log_step`, `check_command_exists`, `start_spinner` / `stop_spinner`, `wait_for_deployment`, `elapsed_time`, `print_summary`, `cleanup_on_exit`.

---

## Usage Examples

### 1. Full automated deployment

```bash
./scripts/deploy.sh
```

### 2. Dry run — preview without making changes

```bash
./scripts/deploy.sh --dry-run
```

### 3. Deploy without running tests

```bash
./scripts/deploy.sh --skip-tests
```

### 4. Verify an existing deployment

```bash
./scripts/verify-deployment.sh
```

### 5. Run the test suite only

```bash
./scripts/test-booking.sh
```

### 6. Set up CI/CD secrets and branch protection (dry-run preview)

```bash
./scripts/setup-ci-cd.sh --dry-run
./scripts/setup-ci-cd.sh            # apply for real
```

### 7. Common scenarios

**Developer — validate a new feature before pushing:**
```bash
./scripts/test-booking.sh --dry-run
```

**DevOps — deploy after merging:**
```bash
./scripts/deploy.sh --skip-tests   # fast deploy
./scripts/verify-deployment.sh     # then verify
```

**First-time setup:**
```bash
cp .env.example .env
# fill in .env
chmod +x scripts/*.sh
./scripts/setup-ci-cd.sh           # configure GitHub
./scripts/deploy.sh                # deploy everything
```

---

## GitHub Actions Workflows

### `auto-deploy.yml`

Triggers automatically when a pull request is **merged** into `main`.

| Step | Description |
|---|---|
| Checkout | Checks out the merged code |
| Setup Node | Installs Node.js 18 |
| Install deps | Runs `npm ci` in `functions/` |
| Deploy | Runs `firebase deploy --only functions` |
| Test | Runs `test-booking.sh --dry-run` |
| Verify | Runs `verify-deployment.sh --dry-run` |
| Upload reports | Saves reports as workflow artifacts (14 days) |
| PR comment | Posts deployment summary to the PR |
| Slack (optional) | Sends notification if `SLACK_WEBHOOK_URL` is set |

### `test-on-push.yml`

Triggers on every push and pull request.

| Job | Description |
|---|---|
| Syntax validation | Checks shell scripts with `bash -n`, validates JSON |
| Security checks | Ensures `.env` is not committed, scans for secrets |
| Unit tests | Runs `npm test` (if configured), runs scripts in dry-run |
| Report to PR | Posts CI results as a PR comment |

---

## Report Format

### Deployment report (`reports/deploy-report-*.txt`)

```
DEPLOYMENT REPORT — 2026-03-04 15:32:45
═════════════════════════════════════════════════════════════════

Project    : my-firebase-project
PR         : #14
Branch     : main
Dry-run    : false
Skip tests : false

Checks passed  : 8
Checks failed  : 0
Warnings       : 0
Elapsed time   : 3m 24s

Status: SUCCESS
```

### Test report (`reports/test-report-*.txt`)

```
BOOKING TEST REPORT — 2026-03-04 16:15:22
═════════════════════════════════════════════════════════════════

Total     : 9
Passed    : 9
Failed    : 0
Elapsed   : 12.5s

Status: PASS
```

### Verification report (`reports/verification-report-*.txt`)

```
DEPLOYMENT VERIFICATION REPORT — 2026-03-04 16:45:10
═════════════════════════════════════════════════════════════════

Project  : my-firebase-project
PR       : #14

Passed   : 10
Failed   : 0
Warnings : 1
Elapsed  : 8s

Overall: PASS
```

---

## Troubleshooting

### `firebase: command not found`

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
# Authenticate
gh auth login
```

### `Permission denied` on scripts

```bash
chmod +x scripts/*.sh
```

### Firebase deploy fails with "billing required"

Cloud Functions require the Firebase **Blaze (pay-as-you-go) plan**.
Upgrade at: https://console.firebase.google.com → your project → Upgrade

### Tests fail with `HTTP 000`

The Cloud Functions endpoint is unreachable. Check:
1. Deployment succeeded: `firebase functions:list --project YOUR_PROJECT_ID`
2. `FIREBASE_PROJECT_ID` and `FIREBASE_REGION` match your deployed project
3. Firebase project is on the Blaze plan

### `gh pr merge` fails

- Make sure `GITHUB_TOKEN` is set in your `.env`
- The token needs `repo` and `workflow` scopes
- You must be a collaborator on the repository

---

## FAQ

**Q: Can I run these scripts in CI without a `.env` file?**
A: Yes — set environment variables directly as CI secrets (GitHub Actions Secrets). The scripts read from the environment, not just from `.env`.

**Q: Will `deploy.sh` overwrite existing Cloud Functions?**
A: Yes — it runs `firebase deploy --only functions --force`. Existing functions are replaced atomically.

**Q: What happens if the deployment fails?**
A: `deploy.sh` attempts a rollback by re-deploying the previous Firebase build. Check the report in `reports/` for details.

**Q: Is the `.env` file safe to commit?**
A: **No!** It contains secrets. It is listed in `.gitignore`. The `verify-deployment.sh` script checks for this mistake.

**Q: How do I add a new Cloud Function and have it tested?**
A: Add it to `functions/index.js`, then add a corresponding check in `scripts/test-booking.sh` and `scripts/verify-deployment.sh`.

**Q: What Node.js version is required?**
A: Node.js 18 LTS (matching the Firebase Functions runtime). The GitHub Actions workflows pin to Node 18.
