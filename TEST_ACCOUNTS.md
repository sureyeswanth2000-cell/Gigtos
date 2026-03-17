# 🔑 Gigto – Test Accounts

> **For development and manual QA only.**  
> Test accounts are created in the **local Firebase Emulator** — no cloud project access or service-account key required.

---

## ⚡ Quick Start (5 minutes)

### Step 1 – Install Firebase CLI (once)

```bash
npm install -g firebase-tools
```

### Step 2 – Install repo dependencies (once, from repo root)

```bash
# from repo root
npm install
```

### Step 3 – Start the emulators

```bash
# from repo root
npm run emulator
# OR: firebase emulators:start
```

Wait until you see **"All emulators ready!"**

> Emulator UI (browse data): http://localhost:4000

### Step 4 – Seed all test accounts

In a **new terminal** (keep the emulator running):

```bash
# from repo root
npm run seed:emulator
```

You should see **"✅ ALL TEST ACCOUNTS SEEDED"** with each role listed.

### Step 5 – Start the React app connected to the emulators

In another new terminal:

```bash
cd react-app
npm run start:emulator
# OR from root: npm run dev   (starts emulators + React app together)
```

App opens at **http://localhost:3000/Gigtos**  
Go to **/Gigtos/auth** to log in.

---

## 🔑 Test Credentials

### 👤 User

| Field | Value |
|---|---|
| Login path | Auth screen → **"Book Services as a User"** |
| Phone | `9999900001` |
| Password | `TestUser@123` |
| Dashboard | `/` (Home) |

**Test scope:** Book services, view bookings, chat, edit profile.

---

### 👷 Mason

| Field | Value |
|---|---|
| Login path | Auth screen → **"Manage Services as Admin"** |
| Email | `testmason@gigto.dev` |
| Password | `TestMason@123` |
| Dashboard | `/admin/bookings` |

**Test scope:** Quote bookings, accept/reject jobs, create workers, view reports.

---

### 🗺️ Region Lead (Region Admin)

| Field | Value |
|---|---|
| Login path | Auth screen → **"Manage Services as Admin"** |
| Email | `testregionlead@gigto.dev` |
| Password | `TestRegLead@123` |
| Dashboard | `/admin/region-lead` |

**Test scope:** Approve pending workers, manage masons, view disputes, assign workers.

---

### 🛡️ Super Admin

| Field | Value |
|---|---|
| Login path | Auth screen → **"Manage Services as Admin"** |
| Email | `testsuperadmin@gigto.dev` |
| Password | `TestSuperAdmin@123` |
| Dashboard | `/admin/super` |

**Test scope:** Create admins, manage regions, suspend regions, full platform visibility.

---

### 🔧 Worker

| Field | Value |
|---|---|
| Login path | Auth screen → **"Register as Worker"** → **"Login (Phone + Password)"** |
| Phone | `9999900005` |
| Password | `TestWorker@123` |
| Dashboard | `/worker/dashboard` |
| Pre-seeded status | `approvalStatus: approved` · `status: active` |

**Test scope:** View worker dashboard and profile.

> **Why pre-approved?**  
> Normally a Worker's account is blocked until a Region Lead approves them.  
> The seed script sets the test worker to `approved`/`active` so you can log in immediately.

---

## ℹ️ How emulator login differs from production

| | Local emulator | Production cloud |
|---|---|---|
| Auth port | `localhost:9099` | `gigto-c0c83.firebaseapp.com` |
| Firestore port | `localhost:8080` | Cloud Firestore |
| Credentials needed | **None** | Firebase service-account key |
| Data persisted | RAM only (reset on emulator restart) | Permanent |
| React start command | `npm run start:emulator` | `npm start` |

---

## Pre-existing legacy accounts (cloud project only)

These were created manually in the real Firebase project and are **not** available in the emulator:

| Role | Login | Credential |
|---|---|---|
| User | Phone `8374532598` | Password `user123` |
| Mason | Email `sri@gmail.com` | Password `Sri123` |

---

## Firestore structure (for reference)

| Role | Auth role-check collection | Firestore document |
|---|---|---|
| User | `users_by_phone/{phone}` → email lookup | `users/{uid}` |
| Mason | `admins/{uid}` (role `mason`) | same |
| Region Lead | `admins/{uid}` (role `regionLead`) | same |
| Super Admin | `admins/{uid}` (role `superadmin`) | same |
| Worker | `worker_auth/{uid}` + `workers_by_phone/{phone}` | `gig_workers/{uid}` |

---

*Last updated: March 2026*

