# Gigtos — Business Model & Technical Architecture
**Version:** 1.0 | **Date:** 2026-03-04 | **Status:** Living Document

> This document is the single source of truth for the Gigtos platform.  
> It covers the complete business model, all role-based user journeys, technical architecture decisions, implementation roadmap, security framework, and future scalability plan.

---

## Table of Contents

1. [Platform Overview & Business Model](#1-platform-overview--business-model)
2. [Roles & Actor Definitions](#2-roles--actor-definitions)
3. [Authentication Flows](#3-authentication-flows)
4. [Worker Registration & Approval](#4-worker-registration--approval)
5. [Booking & Competitive Pricing Flow](#5-booking--competitive-pricing-flow)
6. [Multi-Day Jobs & Future-Date Bookings](#6-multi-day-jobs--future-date-bookings)
7. [Dashboards & Portals](#7-dashboards--portals)
8. [Payment, Escrow & Commission](#8-payment-escrow--commission)
9. [Security & Compliance](#9-security--compliance)
10. [Implementation Roadmap](#10-implementation-roadmap)
11. [Future Scalability Plan](#11-future-scalability-plan)
12. [Data Model Reference](#12-data-model-reference)

---

## 1. Platform Overview & Business Model

### What is Gigtos?

Gigtos is a **regional home-services marketplace** for Andhra Pradesh, connecting:

| Party | Role |
|---|---|
| **Users (Consumers)** | Book services (plumbing, electrical, carpentry, painting, etc.) |
| **Mason Admins** | Regional service providers who quote, assign workers, and deliver jobs |
| **Gig Workers** | On-ground workers who execute the physical service |
| **Region Leads** | Senior admins who govern a geographic region, approve workers, resolve disputes |
| **Superadmin** | Platform owner with global oversight |

### Revenue Streams

| Stream | Description |
|---|---|
| **Platform Commission** | Gigtos retains a configurable % of every accepted quote |
| **Mason Commission** | Mason Admin receives their quoted price minus platform commission |
| **Worker Payout** | Fixed or variable payout from Mason Admin's share |
| **Cashback Loop** | ₹9 consumer cashback per completed booking (retention incentive; 15-day expiry) |

### Core Value Propositions

- **Competitive quotes** — users see bids from multiple Mason Admins and choose by price/rating/trust
- **Verified workforce** — all workers are Region Lead–approved before becoming visible
- **Transparent lifecycle** — every booking state change is timestamped and auditable
- **Escrow protection** — payment held until user confirms job completion
- **Region governance** — Region Leads maintain quality through dispute resolution and worker oversight

---

## 2. Roles & Actor Definitions

```
Superadmin
    └── Region Lead (regionLead)
            └── Mason Admin (admin)
                    └── Gig Worker (worker)
User (consumer)
```

### 2.1 User (Consumer)

- Registers with **phone number only** (no mandatory email)
- Books services, views competing quotes, selects a preferred quote
- Confirms completion, rates workers, raises disputes
- Eligible for cashback on completed bookings

### 2.2 Gig Worker

- Self-registers via a public registration form
- Submits: name, phone, service type, skills, documents (Aadhaar, photo)
- Default status: `pending_approval`
- Becomes `active` only after Region Lead approval
- Assigned jobs from Mason Admin's pool; only sees jobs matching their approved service type
- Tracks daily progress and uploads photo evidence

### 2.3 Mason Admin (admin)

- Manages a team of approved gig workers within their territory
- Submits competitive price quotes for user booking requests
- Drives the booking lifecycle: quote → accept → assign worker → start → finish
- Earns the quoted price minus platform commission
- Supports **per-job** and **per-day** pricing modes

### 2.4 Region Lead (regionLead)

- Approves or rejects pending worker registrations
- Resolves disputes escalated within their region
- Monitors performance KPIs for their region
- Can place Mason Admins on probation
- Auto-escalates unresolved disputes to Superadmin after 24 hours

### 2.5 Superadmin

- Global platform administrator
- Manages Region Leads (create, disable, probation)
- Views cross-region analytics
- Final authority on escalated disputes and fraud cases

---

## 3. Authentication Flows

### 3.1 User Authentication

Users authenticate using **phone number** as the primary identifier.  
Email is **optional** (stored for Firebase Auth compatibility but not required from the user).

```
User enters phone number
        │
        ▼
[Option A] OTP Flow         [Option B] Password Flow
OTP sent to phone           Password entered directly
OTP verified (101010 in     signInWithEmailAndPassword
dev; real Twilio in prod)   using stored internal email
        │                           │
        └─────────────┬─────────────┘
                      ▼
              Redirect → Home / MyBookings
```

**Signup flow:**
1. User enters phone + password (+ optional email)
2. System generates internal Firebase email (`<phone>@gigtos.internal`) if no email provided
3. `users_by_phone/{phone}` record stores uid/email mapping for login lookups
4. `users/{uid}` record stores profile data
5. Redirect to `CompleteProfilePhone` to capture name/address

**Key rules:**
- Email is NOT shown to the user during phone-based signup
- Both OTP and password fallback are supported at login
- Firebase Phone Auth (real SMS) is the production path; password fallback is an interim mechanism

### 3.2 Admin Authentication

Admins authenticate using **email + OTP**.

```
Admin enters email
        │
        ▼
OTP sent to admin's email (Nodemailer / Twilio email OTP)
Admin enters OTP
        │
        ▼
Verify OTP → signInWithEmailAndPassword
        │
        ▼
Check `admins/{uid}` exists & status == 'active'
        │
        ▼
Redirect → Admin Dashboard (role-based: admin / regionLead / superadmin)
```

**Key rules:**
- Password-only admin login is disabled (OTP required as second factor)
- Inactive admin accounts are blocked even if credentials are correct
- Admin accounts are provisioned by Superadmin only

### 3.3 Role-Based Routing

| Role value in `admins` collection | Redirect target |
|---|---|
| `admin` | `/admin/bookings` |
| `regionLead` | `/region/dashboard` |
| `superadmin` | `/superadmin` |
| *(not found in admins)* | `/` (user home) |

---

## 4. Worker Registration & Approval

### 4.1 Worker Self-Registration

Workers fill out a public registration form (no login required):

```
Worker Registration Form
────────────────────────
Full Name *
Phone Number *
Service Type * (Plumber / Electrician / Carpenter / Painter / Other)
Skills (multi-select tags)
Years of Experience
Aadhaar Number *
Photo Upload *
Document Upload (any govt. ID)
Preferred Region *
```

On submit:
```
gig_workers/{workerId} = {
  name, phone, serviceType, skills,
  aadhaarNumber, photoUrl, documentUrl,
  preferredRegion, regionLeadId,
  status: "pending_approval",
  isAvailable: false,
  adminId: null,           ← assigned by Region Lead on approval
  createdAt: serverTimestamp()
}
```

### 4.2 Region Lead Approval Flow

```
Region Lead Dashboard → "Pending Approvals" tab
        │
        ▼
Region Lead reviews worker profile & documents
        │
   ┌────┴────┐
Approve    Reject
   │           │
   ▼           ▼
status =    status = "rejected"
"active"    rejectionReason saved
adminId     Notification → worker
assigned
isAvailable = true
Worker now visible for job assignment
```

**Rules:**
- Only a Region Lead (or Superadmin) can change `status` from `pending_approval` → `active`
- Approved workers are linked to a specific Mason Admin (`adminId`)
- Workers only appear in assignment lists for jobs matching their `serviceType`

### 4.3 Worker Verification Checklist

| Check | Method |
|---|---|
| Phone uniqueness | Firestore unique constraint on `gig_workers` phone field |
| Aadhaar format | Client-side 12-digit validation; backend Aadhaar API (Phase 4) |
| Photo liveness | Manual review by Region Lead (Phase 1); AI liveness check (Phase 4) |
| Document validity | Manual review (Phase 1); DigiLocker integration (Phase 4) |

---

## 5. Booking & Competitive Pricing Flow

### 5.1 Booking Creation (User)

```
User selects service type on Home screen
        │
        ▼
User fills booking form:
  - Service description
  - Address
  - Phone
  - Preferred date / start date (future dates supported)
  - Pricing mode: per-job | per-day
  - Estimated days (for per-day bookings)
        │
        ▼
bookings/{bookingId} created:
  status: "pending"
  userId, phone, serviceType,
  pricingMode: "per_job" | "per_day"
  estimatedDays (if per_day)
  scheduledDate (optional future date)
  createdAt, updatedAt
```

### 5.2 Competitive Quote Flow

```
Booking status: "pending"
        │
        ▼ (Mason Admins in matching region see it)
Each Mason Admin submits their quote:
  submitQuote({ bookingId, price, pricingMode, estimatedDays })
        │
        ▼
bookings/{bookingId}.quotes = [
  { adminId, adminName, price, pricingMode, submittedAt, rating },
  { adminId, adminName, price, pricingMode, submittedAt, rating },
  ...
]
status → "quoted"
        │
        ▼
User sees all quotes on MyBookings screen
(sorted by price, then by admin rating)
        │
        ▼
User taps "Accept Quote" for preferred admin
acceptQuote({ bookingId, adminId })
        │
        ▼
bookings/{bookingId}:
  status → "accepted"
  adminId = selected admin
  acceptedPrice = selected quote price
  pricingMode = selected quote pricingMode
  lockedAt = serverTimestamp()
```

**Pricing Modes:**

| Mode | Description | Display |
|---|---|---|
| `per_job` | Fixed price for the entire job | "₹X for the job" |
| `per_day` | Daily rate × estimated days | "₹X/day × N days = ₹Y est." |

### 5.3 Booking Lifecycle State Machine

```
pending
  │
  ├── [Admin submits quote] → quoted
  │         │
  │         └── [User accepts quote] → accepted
  │                   │
  │                   └── [Admin assigns worker] → assigned
  │                               │
  │                               └── [Admin starts work] → in_progress
  │                                           │
  │                                           └── [Admin marks finished] → awaiting_confirmation
  │                                                       │
  │                                           ┌───────────┴───────────┐
  │                                      [User confirms]        [Dispute raised]
  │                                           │                       │
  │                                       completed              disputed
  │                                                                   │
  │                                                        [Region Lead resolves]
  │                                                                   │
  │                                                               completed
  │                                                             (or reopened)
  │
  └── [Admin/User cancels] → cancelled
  └── [User reopens cancelled] → pending (new booking)
```

### 5.4 Quote Acceptance Rules

- A booking can only be accepted by its **owner user**
- Only quotes in `pending` or `quoted` status can be accepted
- Once accepted, the booking is locked to the selected admin's price
- Other admins' quotes are retained for audit purposes but become inactive

---

## 6. Multi-Day Jobs & Future-Date Bookings

### 6.1 Future-Date Booking

Users can select a future start date when creating a booking:

```
bookings/{bookingId}:
  scheduledDate: "2026-03-15"   ← ISO date string, user-selected
  status: "scheduled"           ← if future date, else "pending"
```

**Rules:**
- Bookings with `scheduledDate` in the future start with status `scheduled`
- Admins can quote on `scheduled` bookings the same as `pending`
- System auto-transitions `scheduled` → `pending` at midnight on `scheduledDate` (Cloud Function cron)
- Users can edit address/phone on `scheduled` bookings before the start date

### 6.2 Multi-Day Job Tracking

For `pricingMode: "per_day"` bookings:

```
bookings/{bookingId}:
  pricingMode: "per_day"
  estimatedDays: 3
  dailyProgress: [
    {
      day: 1,
      date: "2026-03-10",
      workerId: "xyz",
      summary: "Foundation work completed",
      photos: [ { label: "end-of-day", url: "...", uploadedAt: "..." } ],
      userConfirmedDay: true,
      confirmedAt: "2026-03-10T18:30:00Z"
    },
    ...
  ]
  completedDays: 2          ← incremented each confirmed day
  totalCharge: 0            ← accumulated as days are confirmed
```

**Daily Flow:**
```
Worker completes day's work
        │
        ▼
Admin/Worker uploads day-end photo evidence
        │
        ▼
Admin marks day complete: updateDailyProgress({ day, summary, photoUrl })
        │
        ▼
User receives notification: "Day 2 of your job is complete. Please confirm."
        │
        ▼
User confirms day (or raises concern)
        │
        ▼
dailyProgress[day].userConfirmedDay = true
completedDays += 1
totalCharge += dailyRate
        │
        ▼ (after all estimatedDays confirmed)
Admin marks job finished → awaiting_confirmation
User does final confirmation → completed
```

### 6.3 Photo Evidence System

Every booking supports photo uploads at any stage:

```
bookings/{bookingId}.photos = [
  { label: "before", url: "...", uploadedBy: "adminId", uploadedAt: "..." },
  { label: "day-1-end", url: "...", uploadedBy: "workerId", uploadedAt: "..." },
  { label: "after", url: "...", uploadedBy: "adminId", uploadedAt: "..." },
  { label: "complaint", url: "...", uploadedBy: "userId", uploadedAt: "..." }
]
```

**Storage:** Firebase Storage (Phase 1) → AWS S3 with compression + expiry watermark (Phase 3)  
**Access:** Photos are accessible to booking owner, assigned admin, region lead, superadmin  
**Retention:** 90 days post-completion (configurable)

---

## 7. Dashboards & Portals

### 7.1 User Dashboard (`/my-bookings`)

| Section | Content |
|---|---|
| **Active Bookings** | Cards showing status, assigned admin, worker name, next action |
| **Quote Inbox** | Pending bookings with competing quotes; "Accept" button per quote |
| **History** | Completed and cancelled bookings, sorted by `updatedAt` desc |
| **Ratings Given** | Worker ratings submitted by user |
| **Cashback Wallet** | Available cashback balance with expiry dates |
| **Quick Rebook** | One-tap re-booking from completed history |

**Key metrics displayed:**
- Total bookings count
- Average savings vs. first quote received
- Favourite admin (most bookings with)

### 7.2 Mason Admin Dashboard (`/admin`)

| Tab | Content |
|---|---|
| **Overview** | Total workers, free workers, open bookings, completed today, earnings this month |
| **Pending to Quote** | Booking requests awaiting a quote from this admin |
| **My Bookings** | All bookings accepted by this admin, by lifecycle stage |
| **Workers** | Assigned worker roster with availability status |
| **Earnings** | Quote totals, commission deductions, net earnings, per-day vs per-job breakdown |
| **Disputes** | Active disputes assigned to this admin |

**Stats counters (real-time via `onSnapshot`):**
```
totalWorkers | freeWorkers | openBookings | completedToday | earnings
```

### 7.3 Region Lead Dashboard (`/region/dashboard`)

| Tab | Content |
|---|---|
| **Worker Approvals** | Queue of `pending_approval` workers; review & approve/reject |
| **Region KPIs** | Performance score, dispute rate, avg. resolution time, fraud cases |
| **Admin Performance** | Per-admin: bookings, completion rate, dispute rate, earnings |
| **Disputes** | All open disputes in region; escalation controls |
| **Probation** | Admins on probation; history of actions taken |
| **Map View** | Geographic distribution of workers, bookings, hotspots (Phase 3) |

**Performance Score Logic (0–100):**
```
score = 100
score -= 10 × fraudCount
score -= 5 × max(0, avgResolutionHours - 24)
score -= 1 × max(0, totalDisputes - 5)

Triggers:
  score < 60 → regionStatus = "warning"
  score < 40 → regionStatus = "probation"
  disputeRate >= 15% → probation auto-triggered
```

### 7.4 Superadmin Dashboard (`/superadmin`)

| Tab | Content |
|---|---|
| **All Regions** | Region-by-region performance overview; score, disputes, bookings |
| **Region Leads** | Region lead roster; probation status, score trend |
| **Audit Log** | Full cross-platform activity log; filterable by actor/region/date |
| **Platform Revenue** | Total GMV, commission collected, cashback issued |
| **Worker Registry** | All workers across all regions; filter by status/region/serviceType |
| **Escalations** | Disputes auto-escalated from regions after 24h |

---

## 8. Payment, Escrow & Commission

### 8.1 Payment Architecture

Payment is **loosely coupled** — the core booking lifecycle does not depend on payment gateway availability.

```
Booking Accepted
       │
       ▼
[Hold] Escrow created for accepted quote amount
       │
  ┌────┴────┐
  │ per_job │ → amount = acceptedPrice
  │ per_day │ → amount = dailyRate × estimatedDays
  └────────┘
       │
       ▼
Status: awaiting_confirmation
       │
       ▼
[Release] User confirms completion
  → Escrow released
  → Commission deducted
  → Net amount transferred to Mason Admin wallet
  → Worker payout calculated
  → Cashback credited to user (₹9)
       │
  [Dispute] User raises dispute
  → Escrow frozen (no release)
  → Region Lead reviews
  → Escrow released or partially refunded
```

### 8.2 Firestore Escrow Schema

```
escrows/{escrowId} = {
  bookingId,
  userId,
  adminId,
  amount,              ← total held amount
  pricingMode,
  status: "held" | "released" | "refunded" | "disputed",
  heldAt: serverTimestamp(),
  releasedAt,
  releaseType: "auto" | "manual"
}
```

### 8.3 Commission Split

```
Accepted Price (₹X)
        │
        ├── Platform Commission: X × platformRate%   → Gigtos revenue
        ├── Mason Admin Share:   X × (1 - platformRate%) → Admin wallet
        │          │
        │          ├── Worker Payout: adminShare × workerRate%
        │          └── Admin Profit:  adminShare × (1 - workerRate%)
        │
        └── Cashback: ₹9 (flat, funded from platform)
```

**Config (Firestore `platform_config/commission`):**
```
platformRate: 0.10   ← 10% to Gigtos
workerRate: 0.60     ← 60% of admin share to worker
cashbackAmount: 9    ← ₹9 flat per completed booking
cashbackExpiryDays: 15
```

### 8.4 Razorpay Integration (Phase 4, Loose-Coupled)

```
POST /api/payment/create-order
  body: { bookingId, amount, currency: "INR" }
  → Creates Razorpay order
  → Returns { orderId, key }

POST /api/payment/verify
  body: { orderId, paymentId, signature }
  → Verifies Razorpay signature
  → Triggers escrow hold in Firestore via Cloud Function

Webhook: /api/payment/webhook
  → Razorpay webhook for payment status updates
  → Updates escrow status
```

**Design principles:**
- All payment state changes go through Cloud Functions (not direct Firestore writes)
- Every payment event is logged in `activity_logs`
- Platform config is stored in Firestore (not hardcoded) for runtime changes

---

## 9. Security & Compliance

### 9.1 Authentication Security

| Measure | Implementation |
|---|---|
| Phone + OTP login | Firebase Auth + Twilio (prod) / test OTP (dev) |
| Admin OTP (email) | Nodemailer OTP with 10-minute expiry |
| Admin status check | `status == 'active'` validated on every login |
| Session management | Firebase Auth tokens (short-lived, auto-refreshed) |
| Firebase App Check | Phase 3 — prevents unauthorized API access |

### 9.2 Firestore Security Rules Summary

| Collection | Read | Write |
|---|---|---|
| `users/{uid}` | Own record + Superadmin | Own record only |
| `users_by_phone/{phone}` | Public (needed for login lookup) | Auth'd user matching phone |
| `bookings/{id}` | Owner + assigned admin + hierarchy | Cloud Functions only (state changes) |
| `admins/{uid}` | Self + parent + Superadmin | Self (profile) + Superadmin (create/delete) |
| `gig_workers/{id}` | Managing admin + hierarchy | Managing admin + hierarchy |
| `activity_logs/{id}` | Admin + booking owner | Cloud Functions only |
| `cashbacks/{id}` | Owner + admin | Cloud Functions only |
| `escrows/{id}` | Booking parties + admin | Cloud Functions only |

### 9.3 Data Security

- **No sensitive data in client code** — all payment & commission logic runs in Cloud Functions
- **Passwords not stored in plaintext** — Firebase Auth handles credentials; `users_by_phone` stores hashed reference only
- **Document uploads** — stored in Firebase Storage with signed URLs; direct public URLs disabled
- **Aadhaar numbers** — encrypted at rest (AES-256); never logged in plaintext
- **Rate limiting** — Cloud Functions enforce per-user booking rate limits (max 5 active bookings)

### 9.4 Compliance Checklist

| Item | Status |
|---|---|
| Data localisation (India) | Firebase `asia-south1` region |
| User consent on signup | Terms of Service + Privacy Policy checkbox |
| DPDP Act readiness | Data deletion endpoint (Phase 3) |
| Worker Aadhaar verification | Manual (Phase 1) → API (Phase 4) |
| Audit trail | `activity_logs` collection with immutable writes |
| Dispute records | Retained for 2 years (configurable) |

---

## 10. Implementation Roadmap

### Phase 1 — Core Platform (Current / Complete)
✅ User authentication (Phone + OTP)  
✅ Admin authentication (Email + Password)  
✅ Booking creation and lifecycle management  
✅ Competitive quoting (multi-admin bids)  
✅ Quote acceptance and booking lock  
✅ Worker management (create, enable/disable)  
✅ Consumer confirmation system  
✅ Cancel + reopen logic  
✅ Activity logging  
✅ Region performance scoring  
✅ Escrow hold/release framework  
✅ Worker badge system (top listing after 3 jobs)  
✅ Cashback system (₹9, 15-day expiry)  
✅ Basic admin dashboard stats  
✅ Firestore security rules  

### Phase 2 — Worker & Booking Enhancements (Next Sprint)
- [ ] Worker self-registration form (public)
- [ ] Region Lead approval workflow UI
- [ ] Future-date booking (scheduledDate + scheduled status)
- [ ] Multi-day job tracking (dailyProgress array)
- [ ] Per-day pricing mode (UI + backend)
- [ ] Daily confirmation flow (user confirms each day)
- [ ] Photo upload UI (before/day/after/complaint)
- [ ] Admin: OTP-based login (replace password-only)
- [ ] Remove email requirement from user signup UI

### Phase 3 — Dashboards & Governance (Q2 2026)
- [ ] User Dashboard: quote inbox, cashback wallet, rebook
- [ ] Mason Dashboard: earnings tab, disputes panel
- [ ] Region Lead Dashboard: worker approvals, KPI view, probation controls
- [ ] Superadmin Dashboard: cross-region analytics, audit log
- [ ] Real-time booking timeline visualization
- [ ] Dispute resolution panel (Region Lead)
- [ ] Firebase App Check integration
- [ ] Photo storage migration to AWS S3
- [ ] Booking history reopen from completed

### Phase 4 — Integrations & Scale (Q3 2026)
- [ ] Razorpay payment gateway integration
- [ ] Real Firebase Phone Auth (replace test OTP)
- [ ] Aadhaar validation API (DigiLocker / UIDAI)
- [ ] WhatsApp Business API automation
- [ ] Call masking (Exotel / Telnyx)
- [ ] Firebase App Check enforcement
- [ ] Commission automation (auto-split on completion)
- [ ] Worker payout ledger
- [ ] DPDP Act compliance (data deletion endpoint)

---

## 11. Future Scalability Plan

### Architecture Evolution

```
Phase 1-2 (Current):           Phase 3-4 (Scale):
Firebase (single region)   →   Firebase + CDN + Razorpay
React SPA                  →   React + PWA + Push Notifications
Manual review workflows    →   Automated + AI-assisted
```

### Multi-Region Expansion

```
Region structure in Firestore:
regions/{regionId} = {
  name: "Kavali",
  state: "Andhra Pradesh",
  regionLeadId: "...",
  activeAdmins: 5,
  activeWorkers: 32,
  performanceScore: 87
}
```

Each Region Lead manages admins/workers within their `regionId`. Cross-region bookings are handled by Superadmin assignment.

### Performance Targets (Phase 4)

| Metric | Target |
|---|---|
| Booking-to-quote time | < 15 min (peak hours) |
| Quote acceptance rate | > 60% |
| Worker assignment time | < 10 min post-acceptance |
| Dispute resolution time | < 24 hours (Region Lead), < 48h (Superadmin) |
| System uptime | 99.5% monthly |
| Concurrent users | 5,000 (Firebase auto-scales) |

### Technology Stack (Current & Planned)

| Layer | Current | Phase 4 |
|---|---|---|
| Frontend | React 18 (SPA) | React 18 + PWA + Push |
| Auth | Firebase Auth (email+phone) | Firebase Auth + Phone OTP (prod) |
| Database | Cloud Firestore | Cloud Firestore + Redis cache |
| Storage | Firebase Storage | Firebase Storage + AWS S3 |
| Functions | Firebase Functions (Node.js) | Firebase Functions + Cloud Run |
| Notifications | Nodemailer + Twilio SMS | Twilio + WhatsApp Business |
| Payments | (none) | Razorpay |
| Hosting | Firebase Hosting | Firebase Hosting + Cloudflare CDN |
| Monitoring | Console logs | Firebase Performance + Sentry |

---

## 12. Data Model Reference

### `bookings` Collection

```
bookings/{bookingId} {
  userId: string
  customerName: string
  phone: string
  serviceType: "plumber" | "electrician" | "carpenter" | "painter"
  description: string
  address: string
  pricingMode: "per_job" | "per_day"
  estimatedDays: number          // per_day only
  scheduledDate: string          // ISO date, optional
  status: "pending" | "scheduled" | "quoted" | "accepted" | "assigned"
        | "in_progress" | "awaiting_confirmation" | "completed"
        | "cancelled" | "disputed"
  adminId: string                // locked admin after quote acceptance
  acceptedPrice: number
  assignedWorkerId: string
  workerName: string
  workerPhone: string
  quotes: [                      // all submitted quotes
    { adminId, adminName, price, pricingMode, submittedAt, adminRating }
  ]
  dailyProgress: [               // per_day jobs
    { day, date, summary, photos[], userConfirmedDay, confirmedAt }
  ]
  completedDays: number
  totalCharge: number
  photos: [
    { label, url, uploadedBy, uploadedAt }
  ]
  dailyNotes: [
    { date, note, addedBy }
  ]
  dispute: {
    raisedAt, reason, resolvedAt, resolution, visitTime
  }
  rating: number                 // 1-5, set by user on completion
  workerRating: number
  createdAt: Timestamp
  updatedAt: Timestamp
  completedAt: Timestamp
  lockedAt: Timestamp
  startedAt: Timestamp
}
```

### `gig_workers` Collection

```
gig_workers/{workerId} {
  name: string
  phone: string
  serviceType: string
  skills: string[]
  aadhaarNumber: string          // encrypted
  photoUrl: string
  documentUrl: string
  preferredRegion: string
  regionLeadId: string
  adminId: string                // assigned on approval
  status: "pending_approval" | "active" | "rejected" | "suspended"
  isAvailable: boolean
  totalJobsCompleted: number
  isBadged: boolean              // true after 3 completed jobs
  fraudFlag: boolean
  createdAt: Timestamp
  approvedAt: Timestamp
  approvedBy: string             // regionLead UID
}
```

### `admins` Collection

```
admins/{adminId} {
  name: string
  email: string
  phone: string
  role: "admin" | "regionLead" | "superadmin"
  status: "active" | "inactive" | "probation"
  parentAdminId: string          // regionLeadId for admins
  regionId: string
  performanceScore: number       // 0-100
  fraudCount: number
  disputeCount: number
  avgResolutionHours: number
  regionStatus: "ok" | "warning" | "probation"
  probationReason: string
  createdAt: Timestamp
}
```

### `escrows` Collection

```
escrows/{escrowId} {
  bookingId: string
  userId: string
  adminId: string
  amount: number
  pricingMode: string
  status: "held" | "released" | "refunded" | "disputed" | "partial_refund"
  heldAt: Timestamp
  releasedAt: Timestamp
  releaseType: "auto" | "manual"
  platformCommission: number
  adminPayout: number
  workerPayout: number
}
```

### `activity_logs` Collection

```
activity_logs/{logId} {
  bookingId: string
  actorId: string
  actorRole: string
  action: string                 // see allowed actions list
  timestamp: Timestamp
  // + action-specific fields (price, note, url, etc.)
}
```

**Allowed actions:**
`booking_created` · `admin_submitted_quote` · `user_accepted_quote` · `admin_assigned_worker` · `admin_started_work` · `admin_marked_finished` · `user_confirmed_completion` · `user_raised_dispute` · `region_call_logged` · `region_visit_logged` · `admin_resolved_dispute` · `admin_added_note` · `admin_uploaded_photo` · `escrow_held` · `escrow_released` · `cashback_credited` · `worker_approved` · `worker_rejected` · `worker_suspended`

---

*Document maintained by: Gigtos Engineering Team*  
*Last updated: 2026-03-04*  
*Next review: 2026-06-01*
