import React, { useState, useEffect, useCallback } from 'react';

const ACTIVE_DURATION = 12 * 60 * 60 * 1000; // 12 hours in ms
const LS_KEY = 'worker_active_since';

export default function ActiveStatusButton({ onStatusChange }) {
  const [activeSince, setActiveSince] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) {
      const ts = parseInt(stored, 10);
      if (Date.now() - ts < ACTIVE_DURATION) {
        setActiveSince(ts);
      } else {
        localStorage.removeItem(LS_KEY);
      }
    }
  }, []);

  useEffect(() => {
    if (!activeSince) return;
    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current - activeSince >= ACTIVE_DURATION) {
        setActiveSince(null);
        localStorage.removeItem(LS_KEY);
        showToast('⏰ Active status expired after 12 hours', 'error');
        if (onStatusChange) onStatusChange(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSince, onStatusChange]);

  const showToast = (msg, type = '') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleActivate = useCallback(() => {
    const ts = Date.now();
    setActiveSince(ts);
    localStorage.setItem(LS_KEY, ts.toString());
    showToast('✅ You are now Active! Customers can see you.', 'success');
    if (onStatusChange) onStatusChange(true);
  }, [onStatusChange]);

  const handleDeactivate = useCallback(() => {
    setActiveSince(null);
    localStorage.removeItem(LS_KEY);
    setShowConfirm(false);
    showToast('🔴 You are now Offline', 'error');
    if (onStatusChange) onStatusChange(false);
  }, [onStatusChange]);

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

  return (
    <div style={{ marginBottom: 16 }}>
      {isActive ? (
        <>
          <div style={{
            background: 'linear-gradient(135deg, #059669, #10B981)',
            color: 'white',
            borderRadius: 12,
            padding: '14px 20px',
            marginBottom: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>✅ Active</div>
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>Customers can find you</div>
            </div>
            <div style={{
              background: 'rgba(255,255,255,0.25)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 13,
              fontWeight: 600,
              textAlign: 'center'
            }}>
              <div>⏱️ Active for</div>
              <div>{hours}h {String(minutes).padStart(2,'0')}m {String(seconds).padStart(2,'0')}s</div>
            </div>
          </div>
          <button
            className="btn-danger"
            style={{ width: '100%', padding: 12 }}
            onClick={() => setShowConfirm(true)}
          >
            🔴 Go Offline
          </button>
        </>
      ) : (
        <button className="active-status-btn go-active" onClick={handleActivate}>
          🟢 Go Active (12 hrs)
        </button>
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
              Are you sure you want to go offline? Customers will no longer be able to find you.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn-danger" style={{ flex: 1 }} onClick={handleDeactivate}>Go Offline</button>
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
