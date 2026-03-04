# Gigtos — Deployment Guide

This document covers every step needed to deploy the Gigtos Cloud Functions and verify the deployment using the automation scripts in the `scripts/` directory.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Script Overview](#script-overview)
4. [Quickstart](#quickstart)
5. [Detailed Script Reference](#detailed-script-reference)
6. [GitHub Actions CI/CD](#github-actions-cicd)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Git | any | https://git-scm.com |
| Node.js | ≥ 16 | https://nodejs.org |
| npm | bundled with Node | — |
| Firebase CLI | any | `npm install -g firebase-tools` |
| GitHub CLI | any | https://cli.github.com |
| curl | any | pre-installed on macOS/Linux |

---

## Environment Setup

1. **Copy the environment template**

   ```bash
   cp .env.example .env
   ```

2. **Fill in your values** — open `.env` in an editor and set at minimum:

   ```dotenv
   FIREBASE_PROJECT_ID=your-firebase-project-id
   GMAIL_USER=your-email@gmail.com
   GMAIL_PASS=your-gmail-app-password
   ```

3. **Authenticate with Firebase**

   ```bash
   firebase login
   ```

4. **Authenticate with GitHub CLI**

   ```bash
   gh auth login
   ```

---

## Script Overview

```
scripts/
├── deploy.sh            Main deployment script (merge PR + deploy functions)
├── test-booking.sh      Automated booking function tests
├── verify-deployment.sh Post-deployment health checks
├── setup-ci-cd.sh       Creates/updates GitHub Actions workflow files
├── config.sh            Shared configuration (sourced by other scripts)
├── colors.sh            Terminal color definitions
└── utils.sh             Shared helper functions
```

All scripts are executable and self-documenting. Run any script with no arguments to see usage.

---

## Quickstart

```bash
# 1. Clone and enter the repository
git clone https://github.com/sureyeswanth2000-cell/Gigtos.git
cd Gigtos

# 2. Set up environment
cp .env.example .env
# Edit .env with your Firebase project ID and credentials

# 3. Make scripts executable
chmod +x scripts/*.sh

# 4. Deploy (merges PR #14, installs deps, deploys Cloud Functions, runs tests)
./scripts/deploy.sh

# 5. Verify the deployment
./scripts/verify-deployment.sh
```

---

## Detailed Script Reference

### `scripts/deploy.sh` — Main Deployment

```
Usage: ./scripts/deploy.sh [--dry-run] [--skip-tests]

Flags:
  --dry-run      Print what would happen without making changes
  --skip-tests   Skip post-deploy test run

Steps performed:
  1. Check prerequisites (git, node, npm, firebase, gh)
  2. Validate environment (FIREBASE_PROJECT_ID, firebase auth)
  3. Fetch latest code from origin
  4. Merge PR #14 via GitHub CLI
  5. npm install in functions/
  6. firebase deploy --only functions
  7. Run test-booking.sh (unless --skip-tests)
  8. Save deployment report to logs/deploy-report-<timestamp>.txt
```

**Example**

```bash
# Full deployment
./scripts/deploy.sh

# Dry run (no changes)
./scripts/deploy.sh --dry-run

# Deploy without running tests
./scripts/deploy.sh --skip-tests
```

---

### `scripts/test-booking.sh` — Booking Function Tests

```
Usage: ./scripts/test-booking.sh [--verbose]

Flags:
  --verbose    Print full HTTP response bodies

Test suites:
  1. Input validation   (missing fields, bad email, past dates, etc.)
  2. Booking creation   (single-day, multi-day, future dates)
  3. Firestore access   (bookings collection readable)
  4. Function logs      (no errors in recent createBooking logs)

Report: logs/test-report-<timestamp>.txt
```

---

### `scripts/verify-deployment.sh` — Deployment Verification

```
Usage: ./scripts/verify-deployment.sh

Health checks performed:
  1. Environment       (FIREBASE_PROJECT_ID set)
  2. Required tools    (git, node, npm, firebase, gh)
  3. GitHub PR #14     (state = MERGED)
  4. Firebase auth     (project accessible)
  5. Cloud Functions   (createBooking deployed)
  6. HTTP health       (endpoint reachable, returns 400 on empty body)
  7. Firestore         (bookings collection accessible)
  8. Email / SMS       (env vars present)

Report: logs/verification-report-<timestamp>.txt
```

---

### `scripts/setup-ci-cd.sh` — GitHub Actions Setup

```
Usage: ./scripts/setup-ci-cd.sh

Creates workflow files:
  .github/workflows/auto-deploy.yml   Deploy on PR merge to main
  .github/workflows/test-on-push.yml  Build & test on every push
```

Run this once, then commit and push the generated workflow files.

---

## GitHub Actions CI/CD

### Secrets Required

Add these secrets in **GitHub → Settings → Secrets and variables → Actions**:

| Secret | How to get |
|--------|-----------|
| `FIREBASE_TOKEN` | `firebase login:ci` |
| `FIREBASE_PROJECT_ID` | Firebase Console URL |

### Workflows

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| `auto-deploy.yml` | PR merged to `main` | Deploys Cloud Functions |
| `test-on-push.yml` | Push to `main`, `feature/**`, `fix/**` | Installs deps, runs tests, builds React app |

---

## Troubleshooting

### `firebase: command not found`

```bash
npm install -g firebase-tools
firebase login
```

### `gh: command not found`

Install the GitHub CLI: https://cli.github.com/manual/installation

Then authenticate:

```bash
gh auth login
```

### `FIREBASE_PROJECT_ID is not set`

Make sure your `.env` file exists and contains `FIREBASE_PROJECT_ID`:

```bash
cat .env | grep FIREBASE_PROJECT_ID
```

Or export it directly:

```bash
export FIREBASE_PROJECT_ID=your-project-id
./scripts/deploy.sh
```

### Deployment fails with permission errors

```bash
# Re-authenticate Firebase
firebase login --reauth

# Or use a CI token
export FIREBASE_TOKEN=$(firebase login:ci)
```

### PR #14 already merged

The deploy script detects a merged PR and skips the merge step automatically. It continues with dependency installation and function deployment.

### Cloud Functions logs

```bash
firebase functions:log --project your-project-id
```

### View deployment reports

All reports are saved in `logs/`:

```bash
ls -lt logs/
cat logs/deploy-report-<timestamp>.txt
```
