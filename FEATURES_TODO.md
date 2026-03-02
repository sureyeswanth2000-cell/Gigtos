# Gigto Feature Status & To-Do

This document summarizes the features in the Gigto project, indicating which items are already implemented, currently in progress, and planned for future phases. It also serves as a quick reference for developers and stakeholders.

---

## ✅ Implemented Features

- **Authentication**
  - User login via Phone + OTP
  - Admin login via Email + Password
  - Role-based redirection (Admin → Admin Dashboard, User → User Dashboard)
  - Admin status validation (active/inactive)
  - Firebase-based role storage (admins collection)

- **User Features**
  - Booking system (create, view active bookings, history)
  - Cancel booking (only if pending) with modal confirmation
  - Bookings grouped into Active / Completed / Cancelled

- **Admin Features**
  - Booking lifecycle management (pending → assigned → in_progress → completed/cancelled)
  - Assign worker, start work, mark completed, cancel booking
  - Automatic worker freeing on cancellation
  - View worker availability (free/busy logic)

- **Worker Management**
  - Create, disable/enable workers
  - Delete worker (superadmin only)
  - Worker linked to adminId
  - Dynamic availability calculation
  - Search/filter workers by name/status (All / Free / Busy)

- **UX & UI**
  - Mobile‑friendly booking card layout
  - Worker table with availability filter
  - Responsive design
  - Header menu system & clean admin navigation
  - Availability counter display

- **Security**
  - Firestore security rules enforcing role-based read/write access
  - Users can update only their own bookings
  - Admins manage workflow, worker CRUD restricted by ownership
  - Prevent booking deletion

---

## 🚧 In-Progress / Partially Designed

- **Advanced Booking Workflow**
  - New status flow (pending → assigned → in_progress → awaiting_confirmation → completed → cancelled)

- **Consumer Confirmation System**
  - Admin marks work "Finished" (status → awaiting_confirmation)
  - User must confirm to transition to completed
  - Prevents forced completion by admins

- **Admin Cancel → Reopen Logic**
  - If admin cancels after assignment, revert to pending, clear assignedWorkerId & adminId, expose booking externally until user cancels

- **History Improvements**
  - Sort history by `updatedAt` (latest first)
  - Separate Completed / Cancelled lists
  - Allow reopening booking from history

- **Multi-Day Work Support**
  - Track start date, daily updates, prevent immediate completion, require user confirmation

- **Photo Progress System (planned)**
  - Worker uploads before/progress/after photos, user complaint photos
  - Firebase structure with `progressPhotos` array
  - Phase 1: Firebase Storage, Phase 2: migrate to S3 with expiry/compression/watermark

- **Admin System Improvements**
  - Real-time updates using `onSnapshot`
  - Statistics dashboard (total bookings today, completed, cancelled, active, worker load)

- **Future Booking System**
  - Scheduling for future dates
  - Worker assignment calendar
  - Day-based booking control

- **Business Features**
  - Call masking (last-phase)
  - WhatsApp link/automation (deferred)
  - Aadhaar verification (mandatory)
  - Commission tracking
  - Payment gateway integration (last-phase)
  - Region‑based admin control, multi-admin hierarchy

- **System Control Features**
  - Activity logs
  - Dispute state & escalation workflow
  - Rating system, worker performance metrics
  - Booking timeline visualization

---

## 🔮 Future Architecture Vision

Transition from a **Basic Booking App** to a **Work Lifecycle Management Platform** with:

- Andhra-wide service platform
- Gig workers, verified workforce
- Regional admin management and secure communication
- Controlled lifecycle tracking and data-driven operations

---

## 🚀 Development Priority Order

1. Consumer confirmation system
2. Awaiting confirmation state
3. Admin cancel → reopen logic
4. History sorting
5. Real-time updates
6. Admin stats dashboard
7. Multi-day job handling
8. Photo upload system
9. Timeline view
10. Dispute handling
11. Call masking
12. Aadhaar validation
13. Payments
14. WhatsApp automation

> **Note:** WhatsApp link, call masking, and payment features will be added in the last phase.

---

Feel free to copy this into `README.md`, `PROJECT_SCOPE.md`, or another documentation file as needed.