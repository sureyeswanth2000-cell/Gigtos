# 🔑 Gigto – Test Accounts

> **For development and manual QA only.**  
> These accounts exist in the development Firebase project (`gigto-c0c83`).  
> Never use or replicate these credentials in production.

---

## How to create (or recreate) the accounts

Run the seed script once with a service-account key that has **Firebase Admin** access:

```bash
# 1. Set up credentials (download from Firebase Console → Project Settings → Service accounts)
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"

# 2. Install the Admin SDK (only needed once)
npm install --save-dev firebase-admin

# 3. Run the seed script from the repo root
node scripts/seed-test-accounts.js
```

The script is **idempotent** – you can re-run it safely to reset all test accounts to a known state.

---

## 👤 User

| Field    | Value            |
|----------|-----------------|
| Login at | `/auth` → "Book Services as a User" |
| Phone    | `9999900001`    |
| Password | `TestUser@123`  |
| Dashboard| `/` (Home)      |

**What you can test:**  
Book services, view bookings, chat with mason, edit profile.

---

## 👷 Mason

| Field    | Value                    |
|----------|--------------------------|
| Login at | `/auth` → "Manage Services as Admin" |
| Email    | `testmason@gigto.dev`    |
| Password | `TestMason@123`          |
| Dashboard| `/admin/bookings`        |

**What you can test:**  
Quote bookings, accept/reject jobs, create workers, view reports.

---

## 🗺️ Region Lead

| Field    | Value                        |
|----------|------------------------------|
| Login at | `/auth` → "Manage Services as Admin" |
| Email    | `testregionlead@gigto.dev`   |
| Password | `TestRegLead@123`            |
| Dashboard| `/admin/region-lead`         |

**What you can test:**  
Approve pending workers, manage masons in region, view disputes, assign workers to masons.

---

## 🛡️ Super Admin

| Field    | Value                         |
|----------|-------------------------------|
| Login at | `/auth` → "Manage Services as Admin" |
| Email    | `testsuperadmin@gigto.dev`    |
| Password | `TestSuperAdmin@123`          |
| Dashboard| `/admin/super`                |

**What you can test:**  
Create admins (masons / region leads), manage regions, suspend regions, full platform visibility.

---

## 🔧 Worker

| Field    | Value                               |
|----------|-------------------------------------|
| Login at | `/auth` → "Register as Worker" → "Login (Phone + Password)" |
| Phone    | `9999900005`                        |
| Password | `TestWorker@123`                    |
| Dashboard| `/worker/dashboard`                 |
| Status   | Pre-approved (`approvalStatus: approved`, `status: active`) |

**What you can test:**  
View worker profile and dashboard. (Job assignment UI can be connected as the next feature step.)

> **Note:** If a worker is pending approval their login will be blocked with  
> _"Your worker account is pending approval."_  
> The seed script pre-approves the test worker so login works immediately.

---

## Pre-existing test accounts (already in Firebase)

These accounts were set up manually and are also usable:

| Role  | Login method | Credential |
|-------|-------------|-----------|
| User  | Phone `8374532598` | Password `user123` |
| Mason | Email `sri@gmail.com` | Password `Sri123` |

---

## Firestore collections used

| Role        | Auth document location  | Role-check collection |
|-------------|-------------------------|-----------------------|
| User        | `users/{uid}`           | `users_by_phone/{phone}` |
| Mason       | `admins/{uid}`          | role `mason` |
| Region Lead | `admins/{uid}`          | role `regionLead` |
| Super Admin | `admins/{uid}`          | role `superadmin` |
| Worker      | `gig_workers/{uid}`     | `worker_auth/{uid}`, `workers_by_phone/{phone}` |

---

*Last updated: March 2026*
