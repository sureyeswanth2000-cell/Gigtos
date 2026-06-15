import * as Sentry from '@sentry/react';

const SENTRY_DSN = process.env.REACT_APP_SENTRY_DSN || '';
const SENTRY_ENVIRONMENT = process.env.REACT_APP_SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development';
const SENTRY_RELEASE = process.env.REACT_APP_SENTRY_RELEASE || process.env.REACT_APP_GIT_SHA || '';
const DEFAULT_TRACES_SAMPLE_RATE = Number(process.env.REACT_APP_SENTRY_TRACES_SAMPLE_RATE || 0);
const monitoringEnabled = Boolean(SENTRY_DSN) && process.env.NODE_ENV !== 'test';

// ─── Session-level deduplication ────────────────────────────────────────────
// Free plan = 5,000 errors/month. Cap repeated errors aggressively.
const _sessionErrorCounts = new Map();
const MAX_PER_SESSION = 3;        // same error max 3× per session
let _sessionTotalEvents = 0;
const MAX_SESSION_TOTAL = 20;     // hard cap: max 20 events per page load

// ─── Network / connectivity noise ────────────────────────────────────────────
// Errors that fire when a user has no/poor connectivity. These are expected in
// a field-service marketplace where workers operate in low-signal areas.
const NETWORK_NOISE_PATTERNS = [
  // Generic fetch / XHR failures
  /failed to fetch/i,
  /networkerror/i,
  /network request failed/i,
  /load failed/i,
  /fetch.*failed/i,
  // Browser offline
  /internet connection appears to be offline/i,
  /the network connection was lost/i,
  /client is offline/i,
  /you are offline/i,
  // Chrome net error codes
  /err_internet_disconnected/i,
  /err_network_changed/i,
  /err_connection_reset/i,
  /err_connection_timed_out/i,
  /err_connection_refused/i,
  /err_connection_closed/i,
  /err_empty_response/i,
  /err_timed_out/i,
  /err_blocked_by_client/i,   // ad-blockers
  /err_blocked_by_response/i,
  /err_name_not_resolved/i,
  /err_address_unreachable/i,
  // Abort / cancel
  /request aborted/i,
  /\baborterror\b/i,
  /cancelled by user/i,
  /the user aborted a request/i,
  /signal is aborted/i,
  // iOS / macOS NSURLError
  /nsurlerrordomain/i,
  /nsurlconnection/i,
  // Firebase / Firestore offline
  /firestore.*unavailable/i,
  /firebase.*network/i,
  /failed to get documents from the cache/i,
  /could not reach cloud firestore backend/i,
  /firestore.*offline/i,
  // WebSocket
  /websocket.*closed/i,
  /websocket.*error/i,
  /ws.*connection.*failed/i,
  // Timeout
  /timeout of \d+ms exceeded/i,
  /request timed out/i,
  /gateway timeout/i,
  /\btimed? ?out\b/i,
];

// ─── Firebase auth noise ──────────────────────────────────────────────────────
// Expected user actions that should never count as app errors.
const FIREBASE_AUTH_NOISE_PATTERNS = [
  /auth\/popup-closed-by-user/i,
  /auth\/cancelled-popup-request/i,
  /auth\/user-cancelled/i,
  /auth\/popup-blocked/i,
  /auth\/network-request-failed/i,
  /messaging\/permission-blocked/i,
  /messaging\/permission-default/i,
  /messaging\/permission-denied/i,
  /auth\/web-storage-unsupported/i,
];

// ─── Browser / JS environment noise ──────────────────────────────────────────
// Harmless browser quirks that generate false alerts.
const BROWSER_NOISE_PATTERNS = [
  // ResizeObserver — fires constantly in complex layouts, harmless
  /resizeobserver loop limit exceeded/i,
  /resizeobserver loop completed with undelivered notifications/i,
  // Non-Error rejections — usually string/object throws, not real bugs
  /non-error (exception|promise rejection) captured/i,
  // Chunk / lazy-load failures — caused by network, not code bugs
  /chunkloaderror/i,
  /loading chunk \d+ failed/i,
  /loading css chunk \d+ failed/i,
  /failed to load resource/i,
  /importing a module script failed/i,
  // Unexpected HTML (CDN returned error page instead of JS)
  /unexpected token '<'/i,
  /unexpected token o in json/i,
  // Cross-origin security errors from third-party scripts
  /script error\.?$/i,
  /cross-origin error/i,
  /blocked a frame with origin/i,
  /permission denied to access property/i,
  // Video autoplay policy — expected on mobile
  /the play\(\) request was interrupted/i,
  /notallowederror.*play/i,
  /play\(\) failed because the user/i,
  // Safari ITP / storage partitioning
  /itp.*storage/i,
  /storage.*access.*api/i,
  // Geolocation — user denied / timed out (very common on field workers)
  /geolocationpositionerror/i,
  /user denied geolocation/i,
  /geolocation.*permission.*denied/i,
  /geolocation.*timeout/i,
  /position unavailable/i,
  // Notification permission — user dismissed
  /permission.*notifications.*denied/i,
  /notificationapi.*denied/i,
  // Service Worker update noise
  /failed to update a serviceworker/i,
  /serviceworker.*activate/i,
];

// ─── Razorpay / payment noise ────────────────────────────────────────────────
// Expected user actions during payment flow — not app bugs.
const RAZORPAY_NOISE_PATTERNS = [
  /razorpay.*closed/i,          // User closed payment modal
  /payment.*cancelled/i,         // User cancelled payment
  /payment.*failed.*user/i,      // User-initiated failure
  /razorpay.*error.*cancel/i,
  /checkout.*dismissed/i,
  /payment.*window.*closed/i,
  /rzp.*modal.*dismiss/i,
  /payment.*declined.*user/i,    // User's bank declined — not our bug
  /upi.*timeout/i,               // UPI app didn't respond in time
  /upi.*declined/i,
  /vpa.*invalid/i,               // Wrong UPI ID entered by user
];

// ─── Google Maps noise ────────────────────────────────────────────────────────
// Maps is used for worker location & service area; quota/init errors are infra.
const MAPS_NOISE_PATTERNS = [
  /google.*maps.*api.*key/i,     // API key warning in console
  /initmap is not a function/i,  // Maps not loaded yet
  /google is not defined/i,      // Maps script race condition
  /maps.*quota.*exceeded/i,      // Billing quota — infra issue
  /referernotallowedmaperror/i,  // Domain not whitelisted — config issue
  /invalidkeymaperror/i,
  /maps.*billing/i,
  /you have exceeded your daily request quota/i,
];

// ─── Old Android / low-end device noise ──────────────────────────────────────
// Gigtos workers often use budget Android phones (2–4 GB RAM, Android 8–10).
const LOW_END_DEVICE_PATTERNS = [
  /out of memory/i,
  /quotaexceedederror/i,           // IndexedDB / localStorage full
  /storage.*quota.*exceeded/i,
  /the quota has been exceeded/i,
  /dom.*exception.*22/i,           // Old DOMException code for quota
  /webgl.*context.*lost/i,         // GPU memory pressure
  /cannot allocate memory/i,
  /oom/i,
  /low.*memory/i,
  /gc.*overhead.*limit.*exceeded/i,
  /javascriptcore.*error/i,        // Old iOS WebKit crash
  /webkit.*process.*crash/i,
];

// ─── Expected HTTP / business-logic errors ────────────────────────────────────
// 4xx responses from our own API or Firebase that are expected application flow.
const HTTP_EXPECTED_PATTERNS = [
  /401.*unauthorized/i,            // Session expired — user needs to log in
  /403.*forbidden/i,               // Permission denied — correct behaviour
  /404.*not found/i,               // Booking/worker doc not found
  /429.*too many requests/i,       // Rate limit hit — retry handled in code
  /http.*status.*401/i,
  /http.*status.*403/i,
  /http.*status.*404/i,
  /http.*status.*429/i,
  /session.*expired/i,
  /token.*expired/i,
  /auth\/id-token-expired/i,
  /auth\/session-cookie-expired/i,
  /booking.*not.*found/i,          // Expected when booking was deleted
  /worker.*not.*found/i,
  /service.*unavailable.*maintenance/i,
];

// ─── Browser extension URL patterns ──────────────────────────────────────────
const EXTENSION_URL_PATTERNS = [
  /^chrome-extension:\/\//i,
  /^moz-extension:\/\//i,
  /^safari-web-extension:\/\//i,
  /^webkit-masked-url:\/\//i,
  /^resource:\/\//i,
];

// ─── Noisy third-party domains to ignore in stack traces ─────────────────────
const THIRD_PARTY_DENY_URLS = [
  /googletagmanager\.com/i,
  /google-analytics\.com/i,
  /analytics\.google\.com/i,
  /facebook\.net/i,
  /fbcdn\.net/i,
  /doubleclick\.net/i,
  /hotjar\.com/i,
  /clarity\.ms/i,
  /cdn\.ravenjs\.com/i,
  /graph\.facebook\.com/i,
  /connect\.facebook\.net/i,
  /checkout\.razorpay\.com/i,     // Razorpay widget — not our code
  /lumberjack\.razorpay\.com/i,
  /maps\.googleapis\.com/i,
  /maps\.gstatic\.com/i,
];

// All deny URL patterns combined for Sentry.init()
const ALL_DENY_URLS = [...EXTENSION_URL_PATTERNS, ...THIRD_PARTY_DENY_URLS];

// All ignore error patterns combined for Sentry.init()
const ALL_IGNORE_ERRORS = [
  ...NETWORK_NOISE_PATTERNS,
  ...FIREBASE_AUTH_NOISE_PATTERNS,
  ...BROWSER_NOISE_PATTERNS,
  ...RAZORPAY_NOISE_PATTERNS,
  ...MAPS_NOISE_PATTERNS,
  ...LOW_END_DEVICE_PATTERNS,
  ...HTTP_EXPECTED_PATTERNS,
];

// ─── PII redaction helpers ────────────────────────────────────────────────────

function redactText(value) {
  return String(value || '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
    .replace(/\+?\d[\d\s().-]{7,}\d/g, '[phone]')
    .replace(/\b\d{9,18}\b/g, '[number]')
    .replace(/\b[A-Z]{4}0[A-Z0-9]{6}\b/gi, '[ifsc]')
    .replace(/\b(?:upi|token|secret|password|authorization|cookie)\s*[:=]\s*[^\s,;]+/gi, '[secret]')
    .slice(0, 1000);
}

function sanitizeValue(value, depth = 0) {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') return redactText(value);
  if (depth > 4) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 20).map(item => sanitizeValue(item, depth + 1));
  if (typeof value === 'object') {
    return Object.entries(value).slice(0, 60).reduce((safe, [key, item]) => {
      const normalizedKey = key.toLowerCase();
      if (
        normalizedKey.includes('password') ||
        normalizedKey.includes('secret') ||
        normalizedKey.includes('token') ||
        normalizedKey.includes('authorization') ||
        normalizedKey.includes('cookie') ||
        normalizedKey.includes('address') ||
        normalizedKey === 'lat' ||
        normalizedKey === 'lng' ||
        normalizedKey === 'lon' ||
        normalizedKey === 'long' ||
        normalizedKey.includes('coords') ||
        normalizedKey.includes('coordinate') ||
        normalizedKey.includes('location') ||
        normalizedKey.includes('latitude') ||
        normalizedKey.includes('longitude') ||
        normalizedKey.includes('latlng')
      ) {
        safe[key] = '[redacted]';
      } else {
        safe[key] = sanitizeValue(item, depth + 1);
      }
      return safe;
    }, {});
  }
  return '[unserializable]';
}

// ─── Event analysis helpers ───────────────────────────────────────────────────

function getSentryEventText(event = {}, hint = {}) {
  const exceptionText = Array.isArray(event.exception?.values)
    ? event.exception.values.map(ex => `${ex.type || ''} ${ex.value || ''}`).join(' ')
    : '';
  const originalError = hint.originalException;
  return [
    event.message,
    exceptionText,
    originalError?.name,
    originalError?.message,
    originalError?.code,
  ].filter(Boolean).join(' ');
}

function hasExtensionFrame(event = {}) {
  const values = event.exception?.values || [];
  return values.some(ex =>
    (ex.stacktrace?.frames || []).some(frame =>
      EXTENSION_URL_PATTERNS.some(p => p.test(frame.filename || ''))
    )
  );
}

function isNoStackTrace(event = {}) {
  // Events with no stack at all from cross-origin scripts are almost always noise
  const values = event.exception?.values || [];
  return values.length > 0 && values.every(ex => {
    const frames = ex.stacktrace?.frames || [];
    return frames.length === 0 || frames.every(f => !f.filename || f.filename === '<anonymous>');
  });
}

function getSessionKey(event = {}, hint = {}) {
  // Build a stable fingerprint for deduplication within this page session
  const values = event.exception?.values || [];
  const topFrame = values[0]?.stacktrace?.frames?.slice(-1)[0];
  return [
    values[0]?.type || 'unknown',
    topFrame?.filename || '',
    topFrame?.lineno || '',
    (hint.originalException?.message || event.message || '').slice(0, 80),
  ].join(':');
}

// ─── Main drop / filter decision ─────────────────────────────────────────────

function shouldDropEvent(event = {}, hint = {}) {
  // 1. User is known to be offline right now
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;

  // 2. Comes from a browser extension frame
  if (hasExtensionFrame(event)) return true;

  // 3. Request came from an extension URL
  const requestUrl = event.request?.url || '';
  if (EXTENSION_URL_PATTERNS.some(p => p.test(requestUrl))) return true;

  // 4. Cross-origin script error with no usable stack
  if (isNoStackTrace(event) && /script error/i.test(getSentryEventText(event, hint))) return true;

  // 5. Matches any noise pattern
  const eventText = getSentryEventText(event, hint);
  if (ALL_IGNORE_ERRORS.some(p => p.test(eventText))) return true;

  // 6. Hard per-session total cap (free plan protection)
  if (_sessionTotalEvents >= MAX_SESSION_TOTAL) return true;

  // 7. Session-level rate limit — same error more than MAX_PER_SESSION times
  const key = getSessionKey(event, hint);
  const count = (_sessionErrorCounts.get(key) || 0) + 1;
  _sessionErrorCounts.set(key, count);
  if (count > MAX_PER_SESSION) return true;

  _sessionTotalEvents += 1;
  return false;
}

// ─── beforeSend — final sanitise + drop gate ─────────────────────────────────

function sanitizeSentryEvent(event, hint) {
  if (shouldDropEvent(event, hint)) return null;

  const safeEvent = { ...event };

  if (safeEvent.message) safeEvent.message = redactText(safeEvent.message);

  if (safeEvent.exception?.values) {
    safeEvent.exception = {
      ...safeEvent.exception,
      values: safeEvent.exception.values.map(ex => ({
        ...ex,
        value: redactText(ex.value || ''),
      })),
    };
  }

  // Keep only last 15 breadcrumbs, drop noisy console/xhr ones
  if (safeEvent.breadcrumbs) {
    safeEvent.breadcrumbs = safeEvent.breadcrumbs
      .filter(bc => {
        if (bc.category === 'console' && bc.level === 'log') return false;
        if (bc.category === 'xhr' && /firestore|googleapis/i.test(bc.data?.url || '')) return false;
        return true;
      })
      .slice(-15)
      .map(bc => ({
        ...bc,
        message: redactText(bc.message || ''),
        data: sanitizeValue(bc.data || {}),
      }));
  }

  if (safeEvent.extra)    safeEvent.extra    = sanitizeValue(safeEvent.extra);
  if (safeEvent.contexts) safeEvent.contexts = sanitizeValue(safeEvent.contexts);

  if (safeEvent.request) {
    safeEvent.request = sanitizeValue({
      url: safeEvent.request.url,
      method: safeEvent.request.method,
      query_string: safeEvent.request.query_string,
    });
  }

  if (safeEvent.user) {
    safeEvent.user = sanitizeValue({
      id: safeEvent.user.id,
      role: safeEvent.user.role,
    });
  }

  return safeEvent;
}

// ─── beforeBreadcrumb — drop noisy breadcrumb categories ─────────────────────

function filterBreadcrumb(breadcrumb) {
  // Drop console.log noise
  if (breadcrumb.category === 'console' && breadcrumb.level === 'log') return null;
  // Drop verbose Firestore XHR breadcrumbs
  if (
    breadcrumb.category === 'xhr' &&
    /firestore\.googleapis\.com/i.test(breadcrumb.data?.url || '')
  ) return null;
  // Drop UI click noise on generic elements
  if (breadcrumb.category === 'ui.click' && !breadcrumb.message) return null;
  return breadcrumb;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function initSentryMonitoring() {
  if (!monitoringEnabled) return false;

  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,
    release: SENTRY_RELEASE || undefined,
    sendDefaultPii: false,
    // Client-side ignore lists (fast path — no beforeSend overhead)
    ignoreErrors: ALL_IGNORE_ERRORS,
    denyUrls: ALL_DENY_URLS,
    // Performance tracing OFF — saves entire 10,000/month performance quota
    // on the free plan. Re-enable (e.g. 0.05) only after upgrading.
    tracesSampleRate: 0,
    // Hooks
    beforeSend: sanitizeSentryEvent,
    beforeBreadcrumb: filterBreadcrumb,
  });

  return true;
}

export function captureFrontendException(error, context = {}) {
  if (!monitoringEnabled) {
    if (process.env.NODE_ENV === 'development') {
      // eslint-disable-next-line no-console
      console.error('Frontend error captured locally:', error, context);
    }
    return;
  }
  Sentry.withScope(scope => {
    Object.entries(sanitizeValue(context)).forEach(([key, value]) => {
      scope.setExtra(key, value);
    });
    Sentry.captureException(error);
  });
}

export function setSentryUser(user, role = null) {
  if (!monitoringEnabled) return;
  if (!user) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({
    id: user.uid || user.id || 'unknown',
    role: role || user.role || null,
  });
}

export function addSentryBreadcrumb(message, data = {}) {
  if (!monitoringEnabled) return;
  Sentry.addBreadcrumb({
    category: 'gigtos',
    level: 'info',
    message: redactText(message),
    data: sanitizeValue(data),
  });
}

export const isSentryMonitoringEnabled = () => monitoringEnabled;
