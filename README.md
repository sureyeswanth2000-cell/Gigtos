# Gigto

This repository contains the Gigto home services application. It provides plumbing and electrical services in Kavali with a customer booking system and an admin panel for workers and bookings management.

---

## ✅ Currently Implemented Features

### 🔐 Authentication System

- User login via Phone + OTP
- Admin login via Email + Password
- Role-based redirection:
  - Admin → Admin Dashboard
  - User → User Dashboard
- Admin status validation (active/inactive)
- Firebase-based role storage (`admins` collection)

---

### 👤 User Features

- **Booking System**
  - Create booking
  - View Active Bookings
  - View Booking History
  - Cancel booking (only if pending)
  - Booking grouped into:
    - Active
    - Completed / Cancelled
  - Modal confirmation before cancel

---

### 🧑‍💼 Admin Features

- **Booking Lifecycle Management**
  - Status flow:
    - `pending`
    - `assigned`
    - `in_progress`
    - `awaiting_confirmation` (admin marks finished, user must confirm)
    - `completed`
    - `cancelled`
  - Admin actions:
    - Assign worker
    - Start work
    - Mark completed
    - Cancel booking
    - Automatically free worker on cancel
  - View worker availability (free/busy)

---

### 👷 Worker Management

- Create worker
- Disable / Enable worker
- Delete worker (superadmin only)
- Worker linked to `adminId`
- Worker availability calculated dynamically
- Search worker by name
- Filter worker:
  - All
  - Free
  - Busy

---

### 🎨 UX Improvements

- Booking card layout (mobile friendly)
- Worker table with availability filter
- Responsive design
- Header menu system for admin
- Clean admin navigation
- Availability counter display
- Timeline view on booking cards (created/updated times)
- More readable status labels and improved badge colors

---

### 🔒 Firestore Security Rules

- Role-based read/write access
- User can update only own bookings
- Admin can manage workflow
- Worker CRUD restricted by admin ownership
- Prevent booking deletion

---

## 🚧 In Progress / Partially Designed

### 🔁 Advanced Booking Workflow

The `awaiting_confirmation` status has been implemented:
when an admin marks a job finished it moves to this state, and the user
must manually confirm before the booking becomes `completed`.
Remaining workflow enhancements listed below are still in progress.

### 👥 Consumer Confirmation System

- Admin marks work as “Finished”
- Status → `awaiting_confirmation`
- User confirms → status becomes `completed`
- Admin cannot force complete to prevent fake completion

### 🔄 Admin Cancel → Reopen Logic

- If admin cancels after assignment:
  - status → `pending`
  - `assignedWorkerId` → null
  - `adminId` → null
- Booking visible to other admins until user cancels

### 📜 History Improvements

- Sort history by `updatedAt` (latest first) – now bookings are rendered newest first
- Separate lists for completed and cancelled bookings on user dashboard
- (Reopen from history is still on the roadmap)

### 🆕 New Feature: Multi-Day Work Support

- Track work start date
- Track daily updates
- Prevent immediate completion
- Require user confirmation

### 📸 Photo Progress System (Planned)

Before / After + Daily Progress Photos

Requirements:
- Worker uploads:
  - Before photo
  - Daily progress photos
  - After photo
- User can upload:
  - Complaint photo
  - Additional proof
- Admin can view full timeline

Firestore structure proposal:
```json
progressPhotos: [
  {
    date: timestamp,
    uploadedBy: "worker" | "user",
    type: "before" | "progress" | "after" | "complaint",
    imageUrl: "..."
  }
]
```

**Storage Plan**
- Phase 1: Firebase Storage (Free tier)
- Phase 2: Migrate to AWS S3
  - Add expiry logic
  - Add compression
  - Add watermark

### 📊 Admin System Improvements (Planned)

- **Real-time updates (`onSnapshot`)** – implemented across admin and user pages
- Admin statistics dashboard
  - Total bookings today
  - Completed today
  - Cancelled today
  - Active jobs
- Worker workload indicator (load %)

### 📅 Future Booking System


### 📞 Business Features (Planned)
 - Payment gateway integration (no UI yet)
 - WhatsApp automation
 - Multi-admin hierarchy
  *(these are on the roadmap but not implemented yet)*

### 🛡 System Control Features (Planned)

- Activity logs
---
11. Call masking (planned)
12. Aadhaar validation
13. Payments (deferred)
14. WhatsApp automation (deferred)

---

## 🚀 Development Priority Order

**Phase 1 – Stabilize Workflow**

---

## ⚙️ Cloud Functions & Notifications

To support SMS/email notifications and eventually server‑side payment logic,
a simple Cloud Functions project lives in `functions/`.
The provided `index.js` contains two triggers:

* `onBookingCreated` – fires when a booking document is added and notifies the
  user (and optionally a worker) via email/SMS.
* `onBookingStatusChange` – fires when a booking's `status` field changes and
  alerts the user of the update.

Configuration is managed with `firebase functions:config:set` as described in
the comments at the top of `functions/index.js`. You can use Gmail (via
Nodemailer), SendGrid, Twilio, or any other provider of your choice. When no
provider is configured the functions will simply log the message to the
console, so you can test without sending real notifications.

### Deploying functions

```bash
cd functions
npm install             # install dependencies
firebase deploy --only functions
```

> **Note:** deploying Cloud Functions requires your Firebase project to be
> on the Blaze (pay-as-you-go) plan. If you remain on the free Spark tier you
> will see an error about enabling `artifactregistry.googleapis.com`; upgrade
> in the Firebase console before attempting to deploy.

### Environment variables examples

```bash
firebase functions:config:set gmail.user="you@gmail.com" gmail.pass="app-password"
firebase functions:config:set twilio.sid="ACxxx" twilio.token="yyy" twilio.phone="+123456789"
```

### Upcoming additions

* Integrate a payment gateway via a function for secure order creation.
* Send notifications to workers or admins when assignments change.
* Add templating/localization for email bodies.
1. Consumer confirmation system
2. Awaiting confirmation state
3. Admin cancel → reopen logic
4. History sorting

**Phase 2 – Operational Stability**
5. Real-time updates
6. Admin stats dashboard
7. Multi-day job handling

**Phase 3 – Proof & Trust Layer**
8. Photo upload system
9. Timeline view
10. Dispute handling

**Phase 4 – Scale & Business**
11. Call masking
12. Aadhaar validation
13. Payments
14. WhatsApp automation

---

## 🧩 React Migration

A `react-app/` directory has been created as a starter project for migrating the
UI to React. It contains a minimal `package.json` and basic `App` component.
Developers should begin rewriting pages as React components in this folder.

Eventually the plain HTML/JS frontend will be deprecated in favor of this
React-based codebase; use it as the new repository when ready.

Current migration status:
- Core layout (Header, Footer) implemented in `react-app/src/components`
- Pages scaffolded: `Home`, `Service`, `MyBookings`, `Profile`, `Admin`, `Workers`
- `MyBookings` and `Workers` now use real-time Firestore listeners (emulator-ready)

How to run the React app locally:
1. `cd react-app`
2. `npm install`
3. `npm start`

Note: The React app is configured to connect to local Firebase emulators if the
host is `localhost` (see `react-app/src/firebase.js`).

## 🎯 Long-Term Vision

Andhra-wide service platform with:

- Gig workers
- Regional admin management
- Secure communication
- Verified workforce
- Controlled lifecycle tracking
- Data-driven operations


---

*This document serves as a project scope and feature checklist. Future planning will expand on these items.*
#   O l d _ g i g t o r e p o _ 1  
 