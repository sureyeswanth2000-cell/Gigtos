# Gigtos — Full Codebase Diagnosis Report

Updated: 2026-03-04 (v5 — Full Bug Audit)

---

## Directory Structure
```
Gigtos/
├── firebase.js                  # Firebase SDK init (Auth + Firestore)
├── firebase.json                # Firebase hosting config
├── firebase.rules               # Firestore security rules
├── FEATURES_TODO.md             # Feature tracking and planning
├── diagnosis_report.md          # This diagnosis report
├── functions/
│   └── index.js                 # Cloud Functions (email/SMS/activity/commissions)
└── react-app/
    └── src/
        ├── App.js               
        ├── firebase.js          
        ├── components/
        │   ├── Header.js        # Mobile-responsive navigation header
        │   └── Footer.js        
        └── pages/
            ├── Auth.js          
            ├── Home.js          # Service selection & quote-based models
            ├── Service.js       
            ├── MyBookings.js    # User bookings & quote acceptance
            ├── Admin.js         
            ├── AdminBookings.js # Admin booking management & quoting
            ├── Workers.js       
            ├── SuperAdmin.js    
            ├── Chat.js          
            ├── Profile.js       
            └── CompleteProfilePhone.js
```

---

## ✅ Implemented Features (Working)

1. **Authentication & Roles**
   - User login via Phone + OTP.
   - Admin login via Email + Password.
   - Role-based routing (Admin, SuperAdmin, User).
   
2. **User Portal (`MyBookings.js`)**
   - Real-time fetching of active, completed, and cancelled bookings.
   - **Bidding System:** Users can receive price quotes from multiple admins and accept their preferred quote.
   - Cancel option in user portal is working seamlessly.
   - Users can confirm completion, rate workers, and raise disputes.
   - 1-tap rebooking implemented.
   
3. **Admin Portal (`AdminBookings.js` & `Admin.js`)**
   - Dashboard statistics calculating total workers, active/completed bookings, and earnings.
   - **Quote Submission:** Admins can submit bids/quotes for user service requests.
   - Full booking lifecycle management (Pending → Quoted → Accepted → Assigned → Start → Finish → Cancel/Reopen).
   - Real-time updates and activity log generation.
   - Dispute resolution panel with escalation logic.
   
4. **Gig Worker Management (`Workers.js`)**
   - Creating, enabling/disabling gig workers.
   - Dynamic real-time sync with database.

5. **Security Rules (`firebase.rules`)**
   - Robust rules implemented to prevent unauthorized access.

6. **UI & UX Enhancements**
   - Clean, mobile-friendly `<Header />` with a hamburger menu for mobile devices.
   - Transparent pricing displays ("Quote Based" service cards).

---

## 🐞 Bug Audit — All Bugs Found & Status

### ✅ Fixed Bugs (this PR)

| # | File | Bug | Fix Applied |
|---|------|-----|-------------|
| 1 | `Header.js` | **Mobile overlay renders on desktop** — when clicking the user dropdown on desktop, the full-screen mobile overlay (`mobile-menu-overlay`) also appeared because it shared the same `menuOpen` state with no CSS rule to hide it on desktop. | Added `@media (min-width: 769px) { .mobile-menu-overlay { display: none !important; } }` |
| 2 | `firebase.js` | **Debug `console.log` in production** — two `console.log` statements leaked the Firebase project ID to the browser console. | Removed both `console.log` calls. |
| 3 | `firebase.js` | **BOM (Byte Order Mark)** — file started with UTF-8 BOM (`\xEF\xBB\xBF`) which can cause module parse issues. | Stripped BOM from file. |
| 4 | `Profile.js` | **BOM (Byte Order Mark)** — file started with UTF-8 BOM which can cause module parse issues. | Stripped BOM from file. |
| 5 | `Service.js` | **Non-reactive `auth.currentUser` in `useEffect` dependency array** — `auth.currentUser` is a plain object property, not React state; changes to it do not trigger re-renders or effect re-runs. | Replaced with `[location.state]` (component is inside `ProtectedRoute`, so user is always authenticated). |
| 6 | `Workers.js` | **All workers from all admins shown** — the Firestore query fetched the entire `gig_workers` collection with no filter; every admin could see every other admin's workers. | Added `where('adminId', '==', user.uid)` filter and made the effect depend on `user`. |
| 7 | `Workers.js` | **Workers listener not scoped to authenticated user** — the worker subscription started regardless of whether `user` was loaded, potentially running with `null` user. | Moved listener inside `useEffect` that depends on `[user]` with an early return guard. |
| 8 | `MyBookings.js` | **Stale closure in `workerDetails` check** — the booking listener used `workerDetails` from the outer scope to decide whether to fetch worker info, but `workerDetails` was not in the dependency array, creating a stale closure. | Replaced `workerDetails` reference with a `useRef(new Set())` to track already-fetched worker IDs without causing effect re-runs. |
| 9 | `Auth.js` | **Test credentials displayed in the UI** — a visible `<div>` in the login form showed real phone numbers, email addresses, and passwords to any visitor. | Removed the credentials display block entirely. |
| 10 | `Auth.js` | **OTP error message leaks the secret OTP** — the error on wrong OTP read `"Invalid OTP. Test OTP: 101010"`, publicly revealing the bypass code. | Changed error to `"Invalid OTP. Please check and try again."` |
| 11 | `AdminBookings.js` | **Wrong field name when assigning worker phone** — `assignWorker` passed `worker?.phone` to the backend, but workers are stored with field `contact` (not `phone`), so the phone number was always `undefined`. | Changed to `worker?.contact`. |

---

### ⚠️ Known Issues (Not Fixed — Require Architectural Changes)

| # | File | Issue | Notes |
|---|------|-------|-------|
| A | `Auth.js` | **Plain-text password stored in Firestore** — during phone sign-up, the user's plaintext password is written to `users_by_phone` document. This is a critical security vulnerability; if the Firestore collection is ever exposed, all user passwords are compromised. | Requires replacing the custom phone-OTP flow with Firebase Phone Auth (SMS OTP) or a proper server-side hash. |
| B | `Auth.js` | **Hardcoded test OTP (`101010`)** — a bypass OTP is baked into the login logic. Any user who knows this can authenticate as any phone-registered user. | Should be removed and replaced with real Firebase Phone Auth OTP. |
| C | `AdminBookings.js` | **Activity log Firestore listener leaks** — `openActivityLog()` creates an `onSnapshot` listener per booking and returns the `unsub` function, but the caller never uses the return value to clean up; the listener runs indefinitely. | Requires tracking multiple `unsub` references and cleaning them up in a `useEffect` return. |
| D | `AdminBookings.js` | **Activity log fetches all logs and filters client-side** — the query fetches the entire `activity_logs` collection and then filters by `bookingId` in JavaScript, which is inefficient and costly as data grows. | Should add `where('bookingId', '==', bookingId)` to the query (requires a Firestore composite index). |
| E | `functions/index.js` | **Cloud Functions deployment requires Blaze plan** — all backend logic (emails, SMS, commission calculation, governance scoring) is in Cloud Functions which cannot be deployed on the free Spark plan. Currently untested in production. | Upgrade Firebase project to Blaze (pay-as-you-go) plan to deploy. |
| F | All | **No Firebase App Check** — the app makes direct Firestore/Functions calls with no App Check, allowing unauthorized scripts to call the same APIs. | Implement Firebase App Check with reCAPTCHA v3. |

---

## 📋 Navigation / Redirect Link Audit

All internal navigation links were checked:

| Route | Direction | Status |
|-------|-----------|--------|
| `/` | Home page | ✅ Correct |
| `/auth` | Login/signup page | ✅ Correct |
| `/auth?mode=user` | User login mode | ✅ Correct |
| `/service?type=<service>` | Service booking form | ✅ Correct |
| `/my-bookings` | User bookings list | ✅ Correct |
| `/profile` | User profile editor | ✅ Correct |
| `/chat?bookingId=<id>` | Booking chat | ✅ Correct |
| `/complete-profile-phone` | Post-signup profile completion | ✅ Correct |
| `/admin` | Admin dashboard | ✅ Correct |
| `/admin/bookings` | Admin booking management | ✅ Correct |
| `/admin/workers` | Admin worker management | ✅ Correct |
| `/admin/super` | SuperAdmin control center | ✅ Correct |
| `path: '#'` in Admin.js cards | My Earnings / Worker Payouts / Gigto Share | ⚠️ Placeholder (`'#'`) — intentional no-op; pages not yet implemented |
| Google Maps links | Address clickable links open `https://www.google.com/maps/search/...` | ✅ Correct (external link with `rel="noreferrer"`) |

---

## 🔍 Unwanted Scripts Check

| File | Issue | Status |
|------|-------|--------|
| `firebase.js` | `console.log('✅ Firebase initialized successfully!')` and `console.log('📁 Project ID:', ...)` | ✅ **Removed** |
| `Auth.js` | Test credentials block rendered in DOM | ✅ **Removed** |
| No third-party tracking scripts, analytics, or ad scripts detected in `public/index.html` | — | ✅ Clean |

---

## 📋 Future Work (Phase 5+)

1. **Platform & Payment Integrations:**
   - **Payment Gateway:** Razorpay integration for milestone payments.
   - **Call Masking:** Implement a service to mask phone numbers between users and gig workers.
   - **Aadhaar Validation:** Flow for authenticating gig workers' identity securely.
   - **WhatsApp Automation:** Auto-messaging users/workers on status updates.

2. **Security Enhancements:**
   - Implement **Firebase App Check** to prevent unauthorized direct API access.
   - Replace hardcoded OTP with real Firebase Phone Auth (SMS OTP).
   - Use server-side password hashing (bcrypt) or remove plaintext password storage entirely.
   - Add rate limiting logic to Cloud Functions to prevent spamming bookings.
