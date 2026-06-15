import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functionsInstance } from '../../firebase';
import { useWorkerLocation } from '../../context/WorkerLocationContext';

const ACTIVE_DURATION = 90 * 60 * 1000;
const HEARTBEAT_INTERVAL = 4 * 60 * 1000;
const LS_KEY = 'worker_active_since';
const SESSION_KEY = 'worker_open_session_id';

const SERVICE_ALIASES = {
  'home-helper': 'maid_hourly_basic_help',
  'home helper': 'maid_hourly_basic_help',
  home_helper: 'maid_hourly_basic_help',
  maid: 'maid_hourly_basic_help',
  cleaning: 'full_house_basic_cleaning',
  'kitchen-help': 'kitchen_help',
  'kitchen help': 'kitchen_help',
  kitchen_help: 'kitchen_help',
  'bathroom-cleaning': 'bathroom_cleaning',
  bathroom_cleaning: 'bathroom_cleaning',
  'bedroom-cleaning': 'bedroom_cleaning',
  bedroom_cleaning: 'bedroom_cleaning',
  'house-cleaning': 'full_house_basic_cleaning',
  house_cleaning: 'full_house_basic_cleaning',
  'full-house-cleaning': 'full_house_basic_cleaning',
  full_house_basic_cleaning: 'full_house_basic_cleaning',
  'kitchen-cleaning': 'deep_kitchen_cleaning',
  kitchen_cleaning: 'deep_kitchen_cleaning',
};

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function normalizeServiceId(value) {
  const raw = String(value || '').trim().toLowerCase();
  const slug = slugify(raw);
  return SERVICE_ALIASES[raw] || SERVICE_ALIASES[slug] || slug;
}

function uniqueList(values) {
  return [...new Set((Array.isArray(values) ? values : [values]).map(Boolean).filter(Boolean))];
}

function formatServiceLabel(value) {
  return String(value || 'Service')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatInr(value) {
  return `INR ${Math.max(0, Math.round(Number(value) || 0)).toLocaleString('en-IN')}`;
}

function formatOpenSessionError(error) {
  const message = error?.message || 'Could not open work session. Check price rules and approval status.';
  if (/price rule missing/i.test(message)) {
    return 'SuperAdmin price rule is missing for this area/service. Ask SuperAdmin to create it before opening work.';
  }
  if (/disabled or mismatched/i.test(message)) {
    return 'This area/service price rule is disabled or mismatched. Ask SuperAdmin to review the rule.';
  }
  if (/above.*cap|above the area cap/i.test(message)) {
    return 'Your worker price is above the allowed area cap. Lower the price or ask SuperAdmin for an override.';
  }
  if (/approved and active/i.test(message)) {
    return 'Your account must be approved and active before you can open work.';
  }
  return message;
}

function buildOpenSessionPayload(workerData = {}) {
  const city = workerData.locationCity || workerData.city || workerData.workCity || 'Bangalore';
  const areaName = workerData.locationArea || workerData.area || workerData.areaName || 'central';
  const areaIds = uniqueList(workerData.areaIds || [`${slugify(city)}_${slugify(areaName)}`]);
  const serviceSource = workerData.serviceIds ||
    workerData.serviceTypes ||
    workerData.gigTypes ||
    [workerData.gigType || workerData.jobRole || 'home helper'];
  const serviceIds = uniqueList(serviceSource).map(normalizeServiceId).filter(Boolean);
  const workerBasePrices = serviceIds.reduce((acc, serviceId) => {
    acc[serviceId] = Number(
      workerData.workerBasePrices?.[serviceId] ||
      workerData.fixedRate ||
      workerData.dailyRate ||
      workerData.price ||
      150
    );
    return acc;
  }, {});

  return {
    action: 'open',
    city,
    areaIds,
    serviceIds,
    workerBasePrices,
    locationConsent: true,
    lat: workerData.locationLat || workerData.lat || null,
    lng: workerData.locationLng || workerData.lng || null,
  };
}

function buildPayloadSignature(payload = {}) {
  return JSON.stringify({
    city: payload.city,
    areaIds: payload.areaIds,
    serviceIds: payload.serviceIds,
    workerBasePrices: payload.workerBasePrices,
  });
}

function buildDevPreview(payload = {}) {
  const currentSuggestedPrices = {};
  const priceGuardDetails = {};
  Object.entries(payload.workerBasePrices || {}).forEach(([serviceId, price]) => {
    const requestedPrice = Math.max(1, Math.round(Number(price) || 0));
    const normalSuggested = Math.max(requestedPrice, requestedPrice + 30);
    currentSuggestedPrices[serviceId] = normalSuggested;
    priceGuardDetails[serviceId] = {
      minAllowed: Math.max(100, requestedPrice - 50),
      maxAllowed: Math.max(normalSuggested + 100, requestedPrice + 300),
      normalSuggested,
      highSuggested: normalSuggested + 40,
      peakSuggested: normalSuggested + 80,
      requestedPrice,
      adjustedPrice: requestedPrice,
      suggestedPrice: normalSuggested,
    };
  });
  return {
    status: 'preview',
    sessionId: 'dev-open-session',
    ...payload,
    workerRequestedPrices: payload.workerBasePrices,
    currentSuggestedPrices,
    priceGuardDetails,
    priceGuardReasons: [],
    demandContext: {
      matchingOpenJobsCount: 1,
      matchingActiveBookingsCount: 1,
      openWorkersCount: 3,
      contexts: [],
    },
  };
}

export default function ActiveStatusButton({ onStatusChange, workerData, devMode = false }) {
  const [activeSince, setActiveSince] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionMeta, setSessionMeta] = useState(null);
  const [lastHeartbeatAt, setLastHeartbeatAt] = useState(null);
  const [toast, setToast] = useState(null);
  const [editablePrices, setEditablePrices] = useState({});
  const [pricePreviewMeta, setPricePreviewMeta] = useState(null);
  const [pricePreviewSignature, setPricePreviewSignature] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const toastTimeoutRef = useRef(null);
  const baseOpenPreview = useMemo(() => buildOpenSessionPayload(workerData || {}), [workerData]);
  const baseOpenSignature = useMemo(() => buildPayloadSignature(baseOpenPreview), [baseOpenPreview]);

  useEffect(() => {
    setEditablePrices(baseOpenPreview.workerBasePrices || {});
    setPricePreviewMeta(null);
    setPricePreviewSignature('');
  }, [baseOpenSignature, baseOpenPreview.workerBasePrices]);

  const openPreview = useMemo(() => {
    const workerBasePrices = (baseOpenPreview.serviceIds || []).reduce((acc, serviceId) => {
      acc[serviceId] = Math.max(1, Math.round(Number(editablePrices[serviceId] || baseOpenPreview.workerBasePrices?.[serviceId] || 0)));
      return acc;
    }, {});
    return { ...baseOpenPreview, workerBasePrices };
  }, [baseOpenPreview, editablePrices]);
  const openSignature = useMemo(() => buildPayloadSignature(openPreview), [openPreview]);
  const pricePreviewCurrent = pricePreviewMeta && pricePreviewSignature === openSignature;

  const workerLoc = useWorkerLocation();
  const workerLocRef = useRef(workerLoc);
  useEffect(() => { workerLocRef.current = workerLoc; }, [workerLoc]);

  const showToast = useCallback((msg, type = '') => {
    setToast({ msg, type });
    clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) {
      const ts = parseInt(stored, 10);
      if (Date.now() - ts < ACTIVE_DURATION) {
        setActiveSince(ts);
        setSessionMeta({ sessionId: localStorage.getItem(SESSION_KEY) || null });
        const loc = workerLocRef.current;
        if (loc && !loc.tracking) loc.startTracking(null);
      } else {
        localStorage.removeItem(LS_KEY);
        localStorage.removeItem(SESSION_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (!activeSince) return undefined;
    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current - activeSince >= ACTIVE_DURATION) {
        setActiveSince(null);
        setSessionMeta(null);
        localStorage.removeItem(LS_KEY);
        localStorage.removeItem(SESSION_KEY);
        showToast('Open-to-Work session expired after 90 minutes', 'error');
        if (onStatusChange) onStatusChange(false);
        const loc = workerLocRef.current;
        if (loc && loc.tracking) loc.stopTracking();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSince, onStatusChange, showToast]);

  useEffect(() => {
    if (!activeSince || devMode) return undefined;
    const interval = setInterval(async () => {
      try {
        await httpsCallable(functionsInstance, 'updateWorkerOpenSession')({ action: 'heartbeat' });
        const ts = Date.now();
        setActiveSince(ts);
        setLastHeartbeatAt(new Date(ts));
        localStorage.setItem(LS_KEY, ts.toString());
      } catch (err) {
        showToast(formatOpenSessionError(err), 'error');
      }
    }, HEARTBEAT_INTERVAL);
    return () => clearInterval(interval);
  }, [activeSince, devMode, showToast]);

  useEffect(() => () => clearTimeout(toastTimeoutRef.current), []);

  const handlePriceChange = useCallback((serviceId, value) => {
    setEditablePrices(prev => ({ ...prev, [serviceId]: value }));
    setPricePreviewMeta(null);
    setPricePreviewSignature('');
  }, []);

  const handlePreviewPrices = useCallback(async () => {
    setPreviewLoading(true);
    try {
      let data = buildDevPreview(openPreview);
      if (!devMode) {
        const result = await httpsCallable(functionsInstance, 'updateWorkerOpenSession')({
          ...openPreview,
          action: 'preview',
        });
        data = result.data || data;
      }
      setPricePreviewMeta(data);
      setPricePreviewSignature(openSignature);
      showToast('Local price rules checked. Review suggested prices before opening work.', 'success');
    } catch (err) {
      setPricePreviewMeta(null);
      setPricePreviewSignature('');
      showToast(formatOpenSessionError(err), 'error');
    } finally {
      setPreviewLoading(false);
    }
  }, [devMode, openPreview, openSignature, showToast]);

  const handleActivate = useCallback(async () => {
    if (!devMode && !pricePreviewCurrent) {
      showToast('Check local price rules before opening work so the suggested price is clear.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      let data = {
        sessionId: 'dev-open-session',
        expiresAt: new Date(Date.now() + ACTIVE_DURATION).toISOString(),
        priceGuardReasons: [],
      };
      if (!devMode) {
        const result = await httpsCallable(functionsInstance, 'updateWorkerOpenSession')(
          openPreview
        );
        data = result.data || data;
      }

      const ts = Date.now();
      setActiveSince(ts);
      setSessionMeta(data);
      setLastHeartbeatAt(new Date(ts));
      localStorage.setItem(LS_KEY, ts.toString());
      localStorage.setItem(SESSION_KEY, data.sessionId || 'worker-session');
      const priceNote = data.priceGuardReasons?.length ? ` ${data.priceGuardReasons.join(', ')}.` : '';
      showToast(`Open to Work for 90 minutes.${priceNote}`, 'success');
      if (onStatusChange) onStatusChange(true);
      const loc = workerLocRef.current;
      if (loc && !loc.tracking) loc.startTracking(null);
    } catch (err) {
      showToast(formatOpenSessionError(err), 'error');
    } finally {
      setSubmitting(false);
    }
  }, [devMode, onStatusChange, openPreview, pricePreviewCurrent, showToast]);

  const handleDeactivate = useCallback(async () => {
    setSubmitting(true);
    try {
      if (!devMode) {
        await httpsCallable(functionsInstance, 'updateWorkerOpenSession')({ action: 'close' });
      }
      setActiveSince(null);
      setSessionMeta(null);
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(SESSION_KEY);
      setShowConfirm(false);
      showToast('Open-to-Work session closed', 'error');
      if (onStatusChange) onStatusChange(false);
      const loc = workerLocRef.current;
      if (loc && loc.tracking) loc.stopTracking();
    } catch (err) {
      showToast(err.message || 'Could not close open-work session.', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [devMode, onStatusChange, showToast]);

  const isActive = !!activeSince;
  const remaining = isActive ? Math.max(0, ACTIVE_DURATION - (now - activeSince)) : 0;
  const hours = Math.floor(remaining / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  const lastActive = !isActive && localStorage.getItem(LS_KEY);
  const lastActiveMs = lastActive ? Date.now() - parseInt(lastActive, 10) : null;
  const getLastActiveStr = () => {
    if (!lastActiveMs) return null;
    if (lastActiveMs < 3600000) return `${Math.floor(lastActiveMs / 60000)} min ago`;
    if (lastActiveMs < 86400000) return `${Math.floor(lastActiveMs / 3600000)} hours ago`;
    return `${Math.floor(lastActiveMs / 86400000)} days ago`;
  };
  const demandContext = pricePreviewCurrent ? pricePreviewMeta?.demandContext : null;
  const guardDetails = pricePreviewCurrent ? pricePreviewMeta?.priceGuardDetails || {} : {};

  return (
    <div style={{ marginBottom: 16 }}>
      {isActive ? (
        <>
          <div className="worker-open-session-card">
            <div>
              <div className="worker-open-session-title">Open to Work</div>
              <div className="worker-open-session-copy">
                Smart Queue can send matching offers{sessionMeta?.sessionId ? ` (${sessionMeta.sessionId})` : ''}
              </div>
              {lastHeartbeatAt && (
                <div className="worker-open-session-copy">
                  Last refreshed {lastHeartbeatAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
            </div>
            <div className="worker-open-session-time">
              <div>Session left</div>
              <div>{hours}h {String(minutes).padStart(2, '0')}m {String(seconds).padStart(2, '0')}s</div>
            </div>
          </div>
          {sessionMeta?.currentSuggestedPrices && (
            <div className="worker-open-preview">
              <strong>Suggested prices</strong>
              <div className="worker-open-preview-grid">
                {Object.entries(sessionMeta.currentSuggestedPrices).map(([serviceId, price]) => (
                  <span key={serviceId}>{formatServiceLabel(serviceId)}: {formatInr(price)}</span>
                ))}
              </div>
            </div>
          )}
          <button
            className="btn-danger"
            style={{ width: '100%', padding: 12 }}
            onClick={() => setShowConfirm(true)}
            disabled={submitting}
          >
            Go Offline
          </button>
        </>
      ) : (
        <>
          <div className="worker-open-preview" aria-label="Open-to-Work preview">
            <strong>Open-to-Work setup</strong>
            <div className="worker-open-preview-grid">
              <span>City: {openPreview.city}</span>
              <span>Areas: {openPreview.areaIds.join(', ')}</span>
              <span>Services: {openPreview.serviceIds.map(formatServiceLabel).join(', ')}</span>
            </div>
            <div className="worker-open-price-editor" aria-label="Worker price guardrails">
              {openPreview.serviceIds.map((serviceId) => {
                const guard = guardDetails[serviceId] || {};
                return (
                  <label key={serviceId} className="worker-open-price-row">
                    <span>{formatServiceLabel(serviceId)}</span>
                    <input
                      type="number"
                      min="1"
                      value={editablePrices[serviceId] ?? openPreview.workerBasePrices[serviceId] ?? ''}
                      onChange={event => handlePriceChange(serviceId, event.target.value)}
                      aria-label={`Worker price for ${formatServiceLabel(serviceId)}`}
                    />
                    <small>
                      {pricePreviewCurrent
                        ? `Allowed ${formatInr(guard.minAllowed)} - ${formatInr(guard.maxAllowed)}. Normal ${formatInr(guard.normalSuggested)}, high ${formatInr(guard.highSuggested)}, peak ${formatInr(guard.peakSuggested)}.`
                        : 'Check rules to see allowed min, high, and peak price before opening.'}
                    </small>
                  </label>
                );
              })}
            </div>
            {pricePreviewCurrent && (
              <div className="worker-open-demand-context" aria-label="Open work demand context">
                <span>Open jobs: {demandContext?.matchingOpenJobsCount || 0}</span>
                <span>Active bookings: {demandContext?.matchingActiveBookingsCount || 0}</span>
                <span>Open workers: {demandContext?.openWorkersCount || 0}</span>
              </div>
            )}
            <small>
              Backend checks local min/cap rules before showing you to consumers. In MVP, any consumer price shown for your job is also your receivable.
            </small>
          </div>
          <button
            type="button"
            className="active-status-btn check-rules"
            onClick={handlePreviewPrices}
            disabled={previewLoading || submitting}
          >
            {previewLoading ? 'Checking...' : pricePreviewCurrent ? 'Price rules checked' : 'Check price rules'}
          </button>
          <button className="active-status-btn go-active" onClick={handleActivate} disabled={submitting || previewLoading || (!devMode && !pricePreviewCurrent)}>
            {submitting ? 'Opening...' : 'Open to Work (90 min)'}
          </button>
        </>
      )}
      {!isActive && getLastActiveStr() && (
        <div style={{ fontSize: 12, color: '#6B7280', textAlign: 'center', marginTop: 4 }}>
          Last active: {getLastActiveStr()}
        </div>
      )}

      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal-sheet" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Go Offline?</div>
            <p style={{ color: '#6B7280', marginBottom: 20, fontSize: 14 }}>
              Customers will no longer receive your profile in Smart Queue while you are offline.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn-danger" style={{ flex: 1 }} onClick={handleDeactivate} disabled={submitting}>
                {submitting ? 'Closing...' : 'Go Offline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`toast ${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
}
