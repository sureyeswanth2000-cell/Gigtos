# Test Logins for Gigtos QA

Use this file as a checklist for which accounts must exist. Do not commit real emails, phone numbers, passwords, OTPs, production UIDs, API keys, or private tokens here.

## Required Launch QA Accounts

### Consumer
- Email/phone: store privately in password manager or local `.env.local`
- Role document: `users/{uid}`
- Required profile data: name, phone, city, area, state, postal code, optional profile photo
- Main routes: `/services`, `/service`, `/my-bookings`, `/profile`, `/chat`

### Approved Worker
- Email/phone: store privately in password manager or local `.env.local`
- Role documents: `worker_auth/{uid}` and/or `gig_workers/{uid}`
- Required status: `approvalStatus=approved`
- Required profile data: service type, area/city, starting price, profile photo, previous work proof
- Main routes: `/worker/dashboard`, `/worker/open-work`, `/worker/profile`, `/worker/history`, `/worker/support`

### Pending Worker
- Email/phone: store privately in password manager or local `.env.local`
- Required status: `approvalStatus=pending`
- Purpose: verify SuperAdmin/field-operator review, approval, rejection, and resubmission copy

### SuperAdmin
- Email/phone: store privately in password manager or local `.env.local`
- Role document: `admins/{uid}` with `role=superadmin`
- Required security: MFA enrolled before production-sensitive actions
- Main route: `/admin/super`

### Field Operator
- Email/phone: store privately in password manager or local `.env.local`
- Role document: `admins/{uid}` with `role=field_operator`
- Main route: `/operator`

## Optional Legacy Accounts

Mason and Region Lead routes still exist for compatibility, but they are not launch blockers unless the founder explicitly enables those roles for the launch city.

### Mason
- Route: `/mason/dashboard`
- Use only if mason workflow is launch-enabled.

### Region Lead
- Route: `/admin/region-lead`
- Use only if region-lead workflow is launch-enabled.

## QA Rule

Run automated checks first:

```bash
cd react-app
$env:GIGTOS_SMOKE_URL='https://gigto.in'
npm run smoke:heart
```

Then run the manual checklist in `docs/LAUNCH_MANUAL_QA_RUNBOOK.md` with real Firebase test accounts.
