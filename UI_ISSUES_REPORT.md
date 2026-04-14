# Gigtos UI Issues and Broken Elements (2026-04-14)

## Navigation/Link Issues
- **JobCard.jsx**: Navigation may fail if `job.id` is missing (handleClick).
- **JobList.jsx**: Uses `navigate` with job name; may break if job data is malformed.
- **LiveServiceTracker.js**: Map link may be broken if `session.lastLat` or `session.lastLng` is null.

## Buttons/Actions
- **Admin.js**: Button shows "coming soon" alert (multi-admin hierarchy).
- **RegionLeadDashboard.js**: Buttons show alerts if required fields are missing or actions are not available.
- **MyBookings.js**: Various alerts for failed actions, missing selections, or unimplemented features.
- **AdminBookings.js**: Throws error for unimplemented Spark fallback.
- **MyBookings.js**: Throws error for unimplemented Spark fallback.
- **WorkerRegistration.jsx**: Buttons disabled by selection state.

## Error/Null Handling
- **AdminBookings.js**: setReadError and error messages if data fails to load.
- **Service.js**: Error states set and displayed, not always actionable.
- **Auth.js**: Error states and alerts for failed login, registration, or missing fields.

## Disabled/Non-functional UI
- **specialJobs.js**: Many jobs marked as `comingSoon: true` (non-functional by design).
- **Service.js**: Buttons disabled based on loading or missing required fields.
- **MyBookings.js**: Buttons disabled during updates or if required state is missing.

## Null/Undefined Checks
- **LocationContext.js**: Returns null if location cannot be determined.
- **aiAssistant.js**: Returns false/null if location data is missing.
- **instantBooking.js**: Lat/lng can be null, which may affect downstream UI.

## Summary
- Most non-working UI is intentional (disabled, coming soon, or error/alert shown).
- Navigation and map links may break if required data is missing/null.
- Some error states are not actionable by the user.

---

Next: Begin resolving navigation/map link issues and add robust null checks and user feedback for these cases.
