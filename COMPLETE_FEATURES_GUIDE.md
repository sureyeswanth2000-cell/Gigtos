# GIGTO - COMPLETE FEATURES & OPTIONS GUIDE
**Last Updated:** March 8, 2026 | **Build Status:** Production Ready ✅

---

## TABLE OF CONTENTS
1. [Authentication System](#authentication-system)
2. [User Features](#user-features)
3. [Admin Features](#admin-features)
4. [Region Lead Features](#region-lead-features)
5. [SuperAdmin Features](#superadmin-features)
6. [Cloud Functions API](#cloud-functions-api)
7. [Data Models & Collections](#data-models--collections)
8. [Booking Status Workflows](#booking-status-workflows)
9. [Real-Time Features](#real-time-features)
10. [Security & Permissions](#security--permissions)
11. [Tech Stack](#tech-stack)

---

## AUTHENTICATION SYSTEM

### **User (Consumer) Login**
- **Location:** [Auth.js](react-app/src/pages/Auth.js)
- **Method:** Phone + Password
- **Flow:**
  1. User enters phone number
  2. System verifies phone exists in `users_by_phone` collection
  3. User enters password (stored in Firebase Auth)
  4. Login redirects to `/` (Home page)
- **Features:**
  - Password validation (min 6 chars)
  - Error messages for unregistered phones
  - Real-time Firebase Auth integration

### **User (Consumer) Signup**
- **Location:** [Auth.js](react-app/src/pages/Auth.js)
- **Method:** Phone/Email + Password
- **Flow:**
  1. User fills: phone, email, password, confirm password
  2. Firebase Auth creates email account
  3. Creates `users_by_phone` record with email (no plaintext password)
  4. Creates `users` document with profile fields
  5. Redirects to `/complete-profile-phone` for full profile setup
- **Profile Completion Fields:**
  - Name, address, postal code, city, state
  - Photo upload
  - Work category preferences

### **Admin (Service Provider) Login**
- **Location:** [Auth.js](react-app/src/pages/Auth.js)
- **Method:** Email + Password
- **Flow:**
  1. Admin enters email and password
  2. Firebase Auth validates credentials
  3. System checks `admins` collection for admin document
  4. **Role Detection:**
     - `role: 'superadmin'` → redirects to `/admin/super`
    - `role: 'regionLead'` → redirects to `/admin/region-lead`
     - `role: 'admin'` → redirects to `/admin/bookings`
    - `role: 'mason'` → redirects to `/admin/bookings`
  5. Checks `regionStatus`:
     - If 'suspended' → error "Region has been suspended"
- **Error Handling:**
  - ❌ "Account not registered as admin"
  - ❌ "This region has been suspended"
  - ❌ "Invalid credentials"

### **Worker Registration**
- **Location:** [Auth.js](react-app/src/pages/Auth.js)
- **Method:** Email + Password
- **Flow:**
  1. Worker fills: name, phone, email, password, gig type, area
  2. Firebase Auth creates email account
  3. Creates `gig_workers` document with:
     - `approvalStatus: 'pending'` (awaiting region lead approval)
     - `adminId: ''` (will be assigned on approval)
     - Contact & service type info
  4. Account created but inactive until region lead approves
- **Gig Types Available:**
  - Plumber, Electrician, Carpenter, Painter, Cleaner, etc.

---

## USER FEATURES

### **Home Page** (`/`)
- **Component:** [Home.js](react-app/src/pages/Home.js)
- **Features:**
  - Browse service categories (Plumbing, Electrical, etc.)
  - Quick access buttons to book services
  - Recent bookings summary
  - Profile shortcuts

### **Book Service** (`/service`)
- **Component:** [Service.js](react-app/src/pages/Service.js)
- **Booking Creation Form:**
  - Service category (required)
  - Location/address
  - Contact phone
  - Description
  - Preferred date/time (optional)
  - Budget (optional)
- **On Submit:**
  - Creates `bookings` document with `status: 'pending'`
  - Notification sent to regional service admin
  - User redirected to booking details

### **My Bookings** (`/my-bookings`)
- **Component:** [MyBookings.js](react-app/src/pages/MyBookings.js)
- **Features:**
  
#### **View All Bookings**
  - Filters: Active, Completed, Cancelled
  - Status display with color coding:
    - 🟡 Pending (gray orange)
    - 💰 Quoted (indigo)
    - 🤝 Accepted (pink)
    - 👷 Assigned (blue)
    - 🔧 In Progress (purple)
    - ✅ Awaiting Confirmation (red)
    - ✓ Completed (green)
    - ✕ Cancelled (gray)
  - Real-time updates via `onSnapshot`

#### **Edit Booking Details**
  - Available for `status: 'pending'` only
  - Editable fields: address, phone
  - Save/Cancel buttons

#### **Cancel Booking**
  - **NEW: Can cancel 'pending', 'quoted', AND 'accepted'** ✅
  - Only cancelled if worker not yet assigned
  - Cannot cancel if `status: 'assigned'` or later
  - Updates status to `'cancelled'`
  - Clears assigned worker

#### **View Incoming Quotes**
  - Shows when `status: 'pending'` OR `'quoted'`
  - Displays admin name, price, timestamp
  - Shows bid count
  - **Accept Quote Button:**
    - Confirms with user
    - Transitions to `status: 'accepted'`
    - Locks booking to selected admin
    - Sets `adminId` and `acceptedQuote` fields

#### **Confirm Completion**
  - Shows when `status: 'awaiting_confirmation'`
  - Displayed after worker marks job done
  - On confirm:
    - Transitions to `status: 'completed'`
    - Triggers cashback/payout logic
    - Enables rating option

#### **Rate & Review**
  - Available for `status: 'completed'`
  - 1-5 star rating
  - Optional review text
  - **1-star auto-triggers dispute** (backend logic)
  - Cannot rate if already rated

#### **Raise Dispute**
  - Available for `status: 'completed'`
  - Cannot have existing open dispute
  - Types: Quality, Pricing, Not Arrived, Other
  - Dispute description required
  - Escalates to admin if 24h unresolved

#### **Rebook Service**
  - Shows after cancellation
  - Pre-fills previous booking details
  - Redirects to Service page

#### **Chat with Support**
  - Available for active bookings
  - Button navigates to `/chat?bookingId={id}`

### **Profile Page** (`/profile`)
- **Component:** [Admin.js](react-app/src/pages/Profile.js)
- **Features:**
  - View profile info (name, phone, address)
  - Edit profile (name, address, postal code, city, state)
  - Upload/change profile photo
  - Preferences (service categories, availability)
  - View booking history summary
  - Logout button

### **Chat** (`/chat`)
- **Component:** [Chat.js](react-app/src/pages/Chat.js)
- **Features:**
  - Real-time messaging with admin
  - Booking-tied conversations
  - Message history
  - Notification integration

---

## ADMIN FEATURES

### **Admin Dashboard** (`/admin`)
- **Component:** [Admin.js](react-app/src/pages/Admin.js)
- **Stats Cards:**
  - 👨‍🔧 **Workers:** Total active workers
  - ⭐ **Top Listed:** Workers marked as premium
  - ⏳ **Active Jobs:** Open bookings in progress
  - 💰 **My Earnings:** Accumulated commission
  - 💸 **Worker Payouts:** Paid to workers this month
  - 📊 **Region Performance:** Metrics for region leads

#### **Quick Action Buttons**
  - 📋 View All Bookings → `/admin/bookings`
  - 👨‍🔧 Manage Workers → `/admin/workers`
  - 💬 Chat & Disputes → `/admin/bookings` (disputes tab)

#### **Region Performance (Region Leads Only)**
  - Region Score (0-100)
  - Total Disputes
  - Fraud Cases
  - Avg Resolution Time
  - Probation Status
  - Region Status (active/suspended)

### **Booking Management** (`/admin/bookings`)
- **Component:** [AdminBookings.js](react-app/src/pages/AdminBookings.js)

#### **Filter Options**
  - **Active:** All open bookings (pending, quoted, assigned, in_progress, awaiting_confirmation)
  - **Quoted:** Bookings with price quotes sent
  - **Completed:** Finished bookings
  - **Cancelled:** Cancelled bookings
  - **Disputes:** Open disputes only
  - **Escalated:** 24h+ unresolved disputes

#### **For Region Leads**
  - **Special Dashboard:** Blue info bar shows "🌐 Region Lead Dashboard | Masons: X | Bookings: Y"
  - Only sees bookings from **mason accounts** (not own bookings)
  - Cannot directly manage bookings - supervises masons
  - Access all region-wide bookings in real-time

#### **Booking Card Actions**

##### **Submit Quote (Admin)**
  - Available: `status: 'pending'` or `'scheduled'`
  - Input: Amount in ₹
  - Cannot quote twice on same booking
  - Updates booking: `status: 'quoted'` + `escrowStatus: 'pending_acceptance'`
  - Notifies user of new bid

##### **Assign Worker**
  - Available: `status: 'pending'` or `'quoted'`
  - Dropdown shows admin's available workers
  - On assign: `status: 'assigned'`, sets `assignedWorkerId` + `workerName`
  - Worker marked as busy (`isAvailable: false`)

##### **Start Work**
  - Available: `status: 'assigned'`
  - Changes to `status: 'in_progress'`
  - Sets `startedAt` timestamp
  - Worker now on-site

##### **Mark Finished**
  - Available: `status: 'in_progress'`
  - Changes to `status: 'awaiting_confirmation'`
  - Sets `finishedAt` timestamp
  - Waiting for user confirmation

##### **Cancel/Reopen Booking**
  - **If assigned/in_progress/awaiting:** Reverts to `status: 'pending'`, clears worker
  - **If pending:** Directly cancels
  - Frees worker for other jobs
  - Clears adminId if in early stages

##### **View Activity Log**
  - Expandable log of all booking actions
  - Shows: who, what, when
  - Actions logged: quote submission, assignment, dispute flags, admin calls

##### **Log Customer Call**
  - For disputes requiring verification
  - Records call notes
  - Timestamp attached
  - Required for 1-star dispute resolution

##### **Record Site Visit**
  - Upload photos from service location
  - Add visit notes
  - Timestamp recorded

#### **Dispute Management**
  - View open/resolved disputes
  - Decision options: Support User, Support Admin, Refund + Re-service
  - Track resolution time
  - 24-hour escalation timer for unresolved

#### **Real-Time Features**
  - ✅ Auto-refresh all bookings
  - ✅ Auto-refresh worker list
  - ✅ Mason bookings auto-load (region leads)
  - ✅ Activity logs real-time updates

### **Worker Management** (`/admin/workers`)
- **Component:** [Workers.js](react-app/src/pages/Workers.js)

#### **For Regular Admins**
  
##### **Create New Worker**
  - Name (required)
  - 10-digit phone (required)
  - Service type dropdown
  - Status: Active (default)
  - On create: Set `status: 'active'`, `approvalStatus: 'approved'`, `adminId: [current admin]`
  - **Validation:** `role: 'admin'` and `role: 'mason'` can create workers (not region leads) ✅

##### **Toggle Worker Status**
  - **Active** → Inactive (unavailable for jobs)
  - **Inactive** → Active (available for jobs)
  - **Ownership check:** Can only toggle own workers (unless superadmin) ✅
  - Updates `isAvailable` field

##### **Auto-Migration**
  - Runs on component mount
  - Sets `adminId` on workers created before adminId field existed
  - Preserves old workers for backward compatibility ✅
  - Logs: "✅ Migrated X workers"

#### **For Region Leads**
  
##### **Approve Pending Workers**
  - Shows workers with `approvalStatus: 'pending'`
  - Dropdown to select mason
  - On approve: Sets `approvalStatus: 'approved'`, assigns `adminId`, sets `status: 'active'`
  - Logs: `approvedByRegionLeadId: [region lead uid]`

##### **View Mason Workers**
  - Filters workers by mason ownership
  - Shows count per mason
  - Real-time filtering

##### **Create Mason**
  - Form: name, email, password
  - Creates admin document with `role: 'mason'`, `parentAdminId: [region lead]`
  - Masons can then manage their workers

##### **Search Workers**
  - By name or phone
  - Real-time filtering

---

## REGION LEAD FEATURES

### **What is a Region Lead?**
- Admin with `role: 'regionLead'`
- Manages multiple masons
- Supervises all bookings in their region
- Approves workers
- Cannot directly create/manage workers or bookings

### **Region Lead Dashboard** (`/admin/region-lead`)
- **Special UI:** Blue info bar shows mason count and booking count
- **Booking View:** Shows all bookings from all masons
- **Real-Time Sync:** Auto-loads new mason bookings
- **Console Logs:** Shows role detection, mason loading, per-mason booking counts

### **Region Lead Capabilities**
1. ✅ Login with email/password
2. ✅ View all bookings (via masons)
3. ✅ View all workers (assigned to masons)
4. ✅ Approve pending workers
5. ✅ Assign workers to masons
6. ✅ Create new masons
7. ✅ Unassign admins from other regions (via SuperAdmin interface)

### **Data Visibility**
- Can read all admin documents (including region leads) - Firestore rule updated
- Can read bookings where mason is assigned
- Can read workers owned by masons
- Mason hierarchy via `parentAdminId` field

### **Required Setup (SuperAdmin)**
- Must assign masons to region lead via SuperAdmin interface
- Without masons: Shows "Masons: 0" and no bookings visible
- Once assigned: Real-time data flows automatically

---

## SUPERADMIN FEATURES

### **SuperAdmin Control Center** (`/admin/super`)
- **Component:** [SuperAdmin.js](react-app/src/pages/SuperAdmin.js)
- **Access:** Only users with `role: 'superadmin'` in admins collection
- **Purpose:** Platform governance, escalation management, admin assignment

### **Tab 1: 🚨 Escalations**
- View all escalated disputes (24h+ unresolved)
- Shows: Booking ID, Admin, Region Lead, Worker, User, Status
- Resolve buttons with decision options
- Tracks escalation timestamps

### **Tab 2: ⚠️ Disputes**
- All open/resolved disputes
- Filter by status
- See resolution details
- Decision tracking

### **Tab 3: 📋 Work Status**
- All bookings by status
- Status breakdown
- View booking details
- Track progress

### **Tab 4: 👥 Admin & Workers (NEW)**
- **Unassigned Admins Section:**
  - Shows all admins with `role: 'admin'` and no `parentAdminId`
  - Dropdown to select region lead
  - **Assign Button:** Links admin to region lead via `parentAdminId` field
  - Success alert: "✅ Admin assigned to region lead"
  
- **Assigned Admins Grid:**
  - Shows admins grouped by region lead
  - Lists all child admins per region lead
  - **Unassign Button:** Removes admin from region lead (sets `parentAdminId: null`)
  - Real-time refresh

- **All Workers Table:**
  - Shows all workers platform-wide
  - Worker name, admin, status
  - Approval status indicator

### **Tab 5: ➕ Create Region Admin**
- Form to create new region leads
- Input: Name, Email, Password, Confirm Password, Area Name
- On submit:
  - Creates Firebase Auth user
  - Creates admin document with `role: 'regionLead'`
  - Sets `areaName` for region identification
  - Success: "✅ Region Admin created successfully!"

### **Tab 6: 🌐 Region Performance**
- All regions with metrics
- Region score trend
- Dispute count per region
- Fraud indicator
- Probation warning
- Probation lift actions

### **SuperAdmin Data Access**
- Sees ALL admins (superadmin, region leads, regular admins)
- Sees ALL bookings
- Sees ALL disputes
- Sees ALL workers
- Sees ALL users
- Can filter and search

### **SuperAdmin Actions**
1. ✅ Create region leads
2. ✅ Assign/unassign admins to region leads
3. ✅ Resolve escalated disputes
4. ✅ Monitor platform metrics
5. ✅ Track region performance
6. ✅ Place regions on probation
7. ✅ Suspend regions

---

## CLOUD FUNCTIONS API

### **Available Callable Functions** (`functions/index.js`)

#### **submitQuote**
```javascript
await callBackend('submitQuote', { 
  bookingId: string, 
  price: number 
})
```
- Admin submits price quote for booking
- **Updates:**
  - `booking.status = 'quoted'`
  - `booking.escrowStatus = 'pending_acceptance'` ✅
  - Appends quote to `booking.quotes` array
  - Logs activity
- **Returns:** `{ success: true }`
- **Errors:** Already quoted, booking not found, invalid price

#### **acceptQuote**
```javascript
await callBackend('acceptQuote', { 
  bookingId: string, 
  adminId: string 
})
```
- User accepts specific admin's quote
- **Updates:**
  - `booking.status = 'accepted'`
  - `booking.adminId = [selected admin]`
  - `booking.acceptedQuote = [quote object]`
  - Logs activity
- **Returns:** `{ success: true }`
- **Errors:** Not owner, quote not found, invalid state

#### **updateBookingStatus**
```javascript
await callBackend('updateBookingStatus', { 
  bookingId: string,
  action: string,
  extraArgs: object (optional)
})
```
**Actions:**
- `'admin_assign_worker'` → `status: 'assigned'`
- `'admin_start_work'` → `status: 'in_progress'`
- `'admin_mark_finished'` → `status: 'awaiting_confirmation'`
- `'user_confirm_completion'` → `status: 'completed'`
- `'user_cancelled'` → `status: 'cancelled'` (pending/quoted/accepted only) ✅
- `'admin_cancelled'` → `status: 'cancelled'`
- `'admin_reopen_booking'` → `status: 'pending'`
- `'user_rate'` → Adds rating
- `'admin_log_call'` → Records support call
- `'admin_resolve_dispute'` → Closes dispute with decision
- **Returns:** `{ success: true }`
- **All actions fully logged with timestamps**

---

## DATA MODELS & COLLECTIONS

### **admins**
```javascript
{
  name: string,
  email: string,
  role: 'superadmin' | 'regionLead' | 'admin',
  parentAdminId?: string,           // For child admins
  areaName?: string,                // Region name for region leads
  regionStatus?: 'active' | 'suspended',
  regionScore?: number,             // Performance metric
  totalDisputes?: number,
  fraudCount?: number,
  avgResolutionTime?: number,
  probationStatus?: boolean,
  createdAt: timestamp
}
```

### **bookings**
```javascript
{
  userId: string,                   // Customer ID
  adminId?: string,                 // Assigned admin
  assignedWorkerId?: string,        // Assigned worker
  status: string,                   // See status flow below
  service: string,
  address: string,
  phone: string,
  description: string,
  budget?: number,
  quotes?: [ { adminId, adminName, price, createdAt } ],
  acceptedQuote?: { adminId, adminName, price },
  escrowStatus?: 'pending_acceptance' | 'held' | 'refunded', // ✅ NEW
  workerName?: string,
  workerPhone?: string,
  rating?: number,
  review?: string,
  dispute?: {
    status: 'open' | 'resolved',
    reason: string,
    createdAt: timestamp,
    resolvedAt?: timestamp,
    decision?: string,
    escalationStatus?: boolean
  },
  createdAt: timestamp,
  updatedAt: timestamp,
  startedAt?: timestamp,
  finishedAt?: timestamp
}
```

### **gig_workers**
```javascript
{
  name: string,
  contact: string,                  // Phone
  email?: string,
  gigType: string,                  // 'Plumber', 'Electrician', etc.
  area?: string,
  adminId: string,                  // ✅ Now required, set by migration
  status: 'active' | 'inactive',
  approvalStatus: 'pending' | 'approved',
  isAvailable?: boolean,            // Currently free for jobs
  rating?: number,
  completedJobs?: number,
  createdAt: timestamp,
  approvedAt?: timestamp,
  approvedByRegionLeadId?: string,
  migratedAt?: timestamp            // Set by migration function
}
```

### **users**
```javascript
{
  phone: string,
  email: string,
  name?: string,
  address?: string,
  postalCode?: string,
  city?: string,
  state?: string,
  photoUrl?: string,
  createdAt: timestamp,
  completedProfile: boolean
}
```

### **users_by_phone**
```javascript
{
  uid: string,
  email: string,
  // ✅ password field REMOVED (Firebase Auth handles)
  phone: string,
  createdAt: timestamp
}
```

### **activity_logs**
```javascript
{
  bookingId: string,
  actorId: string,
  action: string,                   // admin_assigned_worker, user_confirmed, etc.
  details?: string,
  timestamp: timestamp
}
```

### **disputes**
```javascript
{
  bookingId: string,
  userId: string,
  adminId: string,
  status: 'open' | 'resolved',
  reason: string,
  raisedAt: timestamp,
  resolvedAt?: timestamp,
  resolutionBy?: string,
  decision?: string,
  escalationStatus: boolean,
  escalatedAt?: timestamp
}
```

### **cashbacks**
```javascript
{
  userId: string,
  amount: number,
  cashbackStatus: 'active' | 'used' | 'expired',
  validUntil: timestamp,
  usedAt?: timestamp,
  usedInBookingId?: string,
  createdAt: timestamp
}
```

---

## BOOKING STATUS WORKFLOWS

### **Complete Status Flow**
```
pending → quoted → accepted → assigned → in_progress → awaiting_confirmation → completed
                    ↓                        ↓                      ↓
                  cancelled              cancelled             (cannot cancel)
```

### **Status Transitions & Rules**

| From Status | To Status | Triggered By | Role | Notes |
|---|---|---|---|---|
| pending | quoted | Submit Quote | Admin | Multiple quotes allowed |
| pending | assigned | Assign Worker | Admin | Must have worker |
| pending | cancelled | User/Admin Cancel | User/Admin | Anytime |
| quoted | accepted | Accept Quote | User | Selects one admin's quote |
| quoted | cancelled | User Cancel | User | ✅ NEW: Can cancel quoted |
| accepted | assigned | Assign Worker | Admin | Next step after quote |
| accepted | cancelled | User Cancel | User | ✅ NEW: Can cancel accepted |
| assigned | in_progress | Start Work | Admin | Worker on-site |
| assigned | cancelled | Admin Cancel | Admin | Reverts to pending |
| in_progress | awaiting_confirmation | Mark Finished | Admin | Worker done, wait user |
| awaiting_confirmation | completed | Confirm Completion | User | User approves work |
| awaiting_confirmation | cancelled | Admin Cancel | Admin | Reverts to pending |
| completed | (dispute) | Raise Dispute | User | Optional, auto at 1-star |

### **Status Visual Indicators**
- 🟡 Pending: Waiting for admin quote
- 💰 Quoted: Admin sent price
- 🤝 Accepted: User chose admin
- 👷 Assigned: Worker assigned
- 🔧 In Progress: Work happening now
- ✅ Awaiting Confirmation: User must confirm
- ✓ Completed: Done (can rate/dispute)
- ✕ Cancelled: Job cancelled

---

## REAL-TIME FEATURES

### **onSnapshot Listeners**

#### **Bookings Listener** (Admins only)
```javascript
query(collection(db, 'bookings'), where('adminId', '==', uid))
```
- Auto-updates when booking status changes
- Shows new incoming bookings
- Real-time quote submissions
- Cleanup: `unsub()` on unmount

#### **Workers Listener** (Admin only)
```javascript
query(collection(db, 'gig_workers'))
```
- Auto-filters by role:
  - SuperAdmin: sees all workers
  - Admin: sees own workers (via adminId)
  - Region Lead: sees child admin workers
- Real-time worker status changes
- Cleanup: `unsub()` on unmount

#### **Child Admins Listener** (Region Leads)
```javascript
query(collection(db, 'admins'), where('parentAdminId', '==', uid))
```
- Auto-loads list of child admins
- Real-time when admins assigned/unassigned
- Updates count displayed in dashboard

#### **Disputes Listener**
```javascript
query(collection(db, 'disputes'), where('adminId', '==', uid))
```
- Shows open disputes for admin
- Auto-escalation after 24h
- Real-time resolution updates

#### **Activity Logs Listener**
```javascript
query(
  collection(db, 'activity_logs'),
  where('bookingId', '==', bookingId),
  orderBy('timestamp', 'desc')
)
```
- ✅ OPTIMIZED: Uses where clause instead of loading all + filtering
- Shows action history for specific booking
- Real-time updates as actions occur

#### **Cashback Listener**
```javascript
query(collection(db, 'cashbacks'), where('userId', '==', uid), where('cashbackStatus', '==', 'active'))
```
- Shows user's active cashback
- Auto-deducts on new booking (backend)
- Shows expiry date

---

## SECURITY & PERMISSIONS

### **Authentication**
- ✅ Firebase Authentication (email/password for admins, users)
- ✅ Phone verification via password (no OTP hardcoding) ✅ FIXED
- ✅ Plaintext password removed from Firestore ✅ FIXED
- ✅ Worker ownership validation ✅ FIXED
- ✅ Admin role verification on login

### **Firestore Security Rules** (`firebase.rules`)

#### **admins Collection**
- Anyone authenticated can read (region leads visible for assignment)
- SuperAdmin can read/write all
- Region leads can read own + children
- Admins can read own only

#### **bookings Collection**
- User can read own bookings
- Admin can read assigned bookings + child admin bookings
- SuperAdmin can read all
- Write controls per status (Spark fallback available)

#### **gig_workers Collection**
- Admin can read own workers + child admin workers
- SuperAdmin can read all
- Users cannot read workers
- Spark fallback available for creation

#### **Custom Functions**
- `isAdmin()`: Checks if uid exists in admins collection
- `isSuperAdmin()`: Checks role = 'superadmin'
- `isParentOf(parentId, childId)`: Verifies parent-child relationship

### **Cloud Function Verification**
- All callable functions verify `context.auth.uid`
- Check user role before allowing actions
- Verify ownership (user can only modify own data)
- All state mutations logged for audit trail

### **Data Encryption**
- Firebase automatically encrypts data in transit (HTTPS)
- At-rest encryption handled by Firebase
- Sensitive data (payments) not stored plaintext

---

## TECH STACK

### **Frontend**
- **React** 18+ with functional components
- **React Router** v6 for navigation
- **Firebase SDK** (Auth, Firestore, Storage, Functions)
- **Inline CSS** for styling

### **Backend**
- **Firebase Cloud Functions** (Node.js runtime)
- **Firestore** (NoSQL database)
- **Firebase Authentication**
- **Firebase Storage** (worker photos, documents)

### **Infrastructure**
- **Firebase Hosting** (React app)
- **Cloud Functions** (callable functions)
- **Firestore Database** (production mode)
- **Firestore Rules** (role-based security)

### **Development**
- **npm** for package management
- **firebase-tools CLI** for deployment
- **Git** for version control

---

## KEY FEATURES SUMMARY

### ✅ Fully Implemented & Working
1. User authentication (phone + password)
2. Admin authentication (email + password)
3. Worker registration with approval flow
4. Booking creation and management
5. Quote submission and acceptance
6. Worker assignment
7. Real-time status tracking
8. Dispute management with escalation
9. Rating and review system
10. Region lead hierarchy
11. SuperAdmin governance
12. Activity logging
13. Cashback system
14. Mobile-responsive UI
15. Error handling & validation
16. File upload (photos, documents)

### ✅ Recently Fixed (Latest Build)
1. Cancel booking for quoted/accepted status ✅
2. Activity logs optimized query ✅
3. Worker creation with admin role check ✅
4. Worker toggle with ownership validation ✅
5. Hardcoded OTP removed ✅
6. Plaintext password removed from Firestore ✅
7. EscrowStatus tracking on quote ✅

### 📊 Metrics
- **Total Collections:** 8 (admins, bookings, gig_workers, users, users_by_phone, activity_logs, disputes, cashbacks)
- **Total Components:** 15+ (Auth, Home, Service, MyBookings, Profile, Admin, AdminBookings, Workers, SuperAdmin, Chat, etc.)
- **Total Status Types:** 8 (pending, quoted, accepted, assigned, in_progress, awaiting_confirmation, completed, cancelled)
- **Total Actions:** 12+ (quote, accept, assign, start, finish, confirm, cancel, rate, dispute, resolve, log call, log visit)
- **Total Callable Functions:** 5+ (submitQuote, acceptQuote, updateBookingStatus, + spark fallbacks)

---

## DEPLOYMENT STATUS

### ✅ Production Ready
- Zero syntax errors ✅
- All features tested ✅
- Security rules deployed ✅
- Cloud functions deployed ✅
- Database schema validated ✅
- Real-time listeners verified ✅
- Mobile responsive ✅

### 📋 Quick Deploy Checklist
- `firebase deploy --only firestore:rules` (Firestore)
- `firebase deploy --only functions` (Cloud Functions)
- `npm run build` then deploy to Firebase Hosting (React)

---

**Document Version:** 1.0 Complete Master Guide
**Last Tested:** March 5, 2026
**Status:** ✅ All Systems Operational
