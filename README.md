# Gigto

Home services app (Plumbing, Electrical, etc.) for Kavali — with customer booking, admin management, and a React front-end.

---

## ✅ Fully Implemented

### 🔐 Authentication
- ✅ User login via Phone + OTP (React: `Auth.js`, HTML: `auth.html`)
- ✅ Admin login via Email + Password
- ✅ Role-based redirection (Admin → Admin Dashboard, User → Home/Bookings)
- ✅ Admin status validation (active / inactive)
- ✅ Firebase-based role storage (`admins` collection)
- ✅ Complete profile phone flow (`CompleteProfilePhone.js`)

---

### 👤 User Features
- ✅ Create booking (React: `Service.js`)
- ✅ View active bookings (React: `MyBookings.js`, HTML: `my-bookings.html`)
- ✅ View completed & cancelled booking history
- ✅ Cancel booking (only if `pending` status) — with modal confirmation
- ✅ Bookings grouped into: Active / Completed / Cancelled
- ✅ Consumer confirmation — user clicks "Confirm Completion" when status is `awaiting_confirmation`
- ✅ Real-time booking updates via `onSnapshot`
- ✅ Bookings sorted by `updatedAt` descending (latest first)
- ✅ Timeline view on each booking card (created / last updated)

---

### 🧑‍💼 Admin Features
- ✅ Booking lifecycle management via `managebookings.html` and `AdminBookings.js`
  - Status flow: `pending` → `assigned` → `in_progress` → `awaiting_confirmation` → `completed` / `cancelled`
- ✅ Assign worker
- ✅ Start work (`in_progress`)
- ✅ Mark Finished → moves to `awaiting_confirmation` (user must confirm)
- ✅ Cancel booking:
  - If `assigned`/`in_progress`/`awaiting_confirmation` → reverts to `pending`, clears `assignedWorkerId` & `adminId` (reopen logic ✅)
  - If `pending` → directly cancelled
- ✅ Real-time updates via `onSnapshot` on bookings + workers

---

### 📊 Admin Dashboard (`dashboard.html`)
- ✅ Total Workers counter
- ✅ Available (Free) Workers counter
- ✅ Open Bookings counter
- ✅ Completed Today counter
- ✅ Real-time data refresh via `onSnapshot`

---

### 👷 Worker Management (`viewgigs.html`, `Workers.js`)
- ✅ Create worker (name, phone, type)
- ✅ Disable / Enable worker
- ✅ Delete worker (superadmin only)
- ✅ Worker linked to `adminId`
- ✅ Dynamic availability (free/busy based on active bookings)
- ✅ Search worker by name
- ✅ Filter worker: All / Free / Busy

---

### ⚙️ Cloud Functions (`functions/index.js`)
- ✅ `onBookingCreated` — triggers email + SMS notification on new booking
- ✅ `onBookingStatusChange` — triggers email + SMS on status change
- ✅ `getServiceInsights` — returns live worker availability + quote trends for the home page
- ✅ `aiBookingAssistant` — Gemini 1.5 Flash powered consumer booking assistant with safe fallback mode
- ✅ Twilio SMS integration (configured via env vars)
- ✅ Nodemailer/Gmail email integration

### Deploy functions:
```bash
cd functions
npm install
firebase deploy --only functions
```

### Configure env vars:
```bash
firebase functions:config:set gmail.user="you@gmail.com" gmail.pass="app-password"
firebase functions:config:set twilio.sid="ACxxx" twilio.token="yyy" twilio.phone="+123456789"
firebase functions:config:set gemini.key="YOUR_GEMINI_1_5_FLASH_API_KEY"
```

### Gemini AI assistant setup:
```bash
cd functions
npm install
firebase deploy --only functions:getServiceInsights,functions:aiBookingAssistant
```

> **Note:** Cloud Functions require the Firebase **Blaze** plan.

---

### 🔒 Firestore Security Rules (`firebase.rules`)
- ✅ Role-based read/write access
- ✅ Users can only update their own bookings
- ✅ Admin manages booking workflow
- ✅ Worker CRUD restricted by admin ownership
- ✅ Booking deletion prevented

---

### 🎨 React App (`react-app/`)
- ✅ React Router with protected routes
- ✅ Pages: `Home`, `Auth`, `Service`, `MyBookings`, `Profile`, `Admin`, `Workers`, `AdminBookings`, `Chat`
- ✅ `Header` + `Footer` components
- ✅ Home page with 4 service types: Plumber, Electrician, Carpenter, Painter
- ✅ Real-time Firestore listeners in `MyBookings` and `Workers`
- ✅ Connected to local Firebase emulators on `localhost`

#### Run React App:
```bash
cd react-app
npm install
npm start
```

---

## 🚧 In Progress / Partially Designed

### ✅ Consumer Confirmation System
- ✅ Admin marks "Finished" → `awaiting_confirmation`
- ✅ User confirms → `completed`
- ✅ Admin cannot force-complete

### ✅ Admin Cancel → Reopen Logic
- ✅ If admin cancels after assignment: revert to `pending`, clear worker & admin IDs

### ✅ History Sort
- ✅ Sorted by `updatedAt` (latest first)
- ✅ Separate Completed / Cancelled lists on user dashboard
- 📋 **TODO:** Allow reopening a booking from history

### 📋 Multi-Day Work Support
- 📋 Track work start date
- 📋 Track daily progress updates
- 📋 Prevent immediate completion
- 📋 Require user confirmation per day

### 📋 Photo Progress System
- 📋 Worker uploads: before / daily / after photos
- 📋 User uploads: complaint / additional proof
- 📋 Admin views full timeline
- 📋 Firebase Storage (Phase 1) → AWS S3 with expiry/compression/watermark (Phase 2)
- 📋 Proposed Firestore field: `progressPhotos[]`

### 📋 Rating System
- 📋 Worker performance metrics
- 📋 User rating after completion

### 📋 Dispute Handling
- 📋 Dispute state + escalation workflow
- 📋 Booking timeline visualization

---

## 📋 TODO — Future Phases

### Phase 1 – Stabilize Workflow
1. ✅ Consumer confirmation system
2. ✅ Awaiting confirmation state
3. ✅ Admin cancel → reopen logic
4. ✅ History sorting
5. ✅ Real-time updates

### Phase 2 – Operational Stability
6. ✅ Admin stats dashboard (basic)
7. 📋 Admin stats dashboard (advanced — cancelled today, worker load %)
8. ✅ Multi-day job handling (basic day-count lifecycle)
9. 📋 Future/scheduled booking system (calendar-based)
10. ✅ Search/filter improvements for Mason/RegionLead/User (basic)
11. ✅ Quote presets + editable addons (basic)
12. ✅ Auto-pick worker with manual override before start
13. ✅ 24h delay tracking + region lead alerts (basic)

### Phase 3 – Proof & Trust Layer
14. 📋 Photo upload system (before/after/complaint photos)
15. 📋 Booking timeline visualization (full history)
16. 📋 Dispute handling & escalation (advanced)
17. 📋 Rating system (worker performance metrics)

### Phase 4 – Scale & Business *(Last Phase)*
18. 📋 **WhatsApp link / automation** ← *LAST PHASE*
19. 📋 **Call masking** ← *LAST PHASE*
20. 📋 **Payment gateway integration** ← *LAST PHASE*
21. 📋 Aadhaar validation
22. 📋 Commission tracking
23. 📋 Multi-admin hierarchy
24. 📋 Region-based admin control
25. 📋 Activity logs

---

## 🎯 Long-Term Vision

Andhra-wide service platform with:
- Gig workers & verified workforce
- Regional admin management
- Secure communication (call masking, WhatsApp)
- Controlled lifecycle tracking
- Data-driven operations

---

*📌 WhatsApp link, Call Masking, and Payment are planned for the **last phase** of development.*