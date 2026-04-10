/**
 * WorkerFixedRateForm — Lets workers set their fixed daily rate.
 *
 * Displayed in the Worker Dashboard. Workers enter their per-day charge
 * (e.g. ₹500, ₹600) and save it to Firestore worker_availability collection.
 * This rate is shown to users when matching nearby workers.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { auth, db } from '../../firebase';
import { doc, getDoc, setDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';

export default function WorkerFixedRateForm({ workerData }) {
  const [rate, setRate] = useState('');
  const [savedRate, setSavedRate] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const toastTimeoutRef = useRef(null);

  // Load existing rate on mount
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    getDoc(doc(db, 'worker_availability', uid))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setSavedRate(data.fixedRate || null);
          setRate(String(data.fixedRate || ''));
        }
      })
      .catch(() => { /* No existing rate — not an error */ });
  }, []);

  const showToast = (msg, type = '') => {
    setToast({ msg, type });
    clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    return () => clearTimeout(toastTimeoutRef.current);
  }, []);

  const handleSave = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const numericRate = Number(rate);
    if (isNaN(numericRate) || numericRate < 100 || numericRate > 50000) {
      showToast('⚠️ Enter a rate between ₹100 and ₹50,000', 'error');
      return;
    }

    setSaving(true);
    try {
      await setDoc(doc(db, 'worker_availability', uid), {
        workerId: uid,
        workerName: workerData?.name || 'Worker',
        serviceType: workerData?.gigType || 'General',
        fixedRate: numericRate,
        rating: workerData?.rating || 0,
        area: workerData?.area || '',
        lat: workerData?.locationLat || null,
        lng: workerData?.locationLng || null,
        isAvailable: true,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      setSavedRate(numericRate);
      setIsEditing(false);
      showToast(`✅ Fixed rate set to ₹${numericRate}/day`, 'success');
    } catch (err) {
      showToast('❌ Failed to save rate. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  }, [rate, workerData]);

  const handleRemoveRate = useCallback(async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    setSaving(true);
    try {
      await deleteDoc(doc(db, 'worker_availability', uid));
      setSavedRate(null);
      setRate('');
      setIsEditing(false);
      showToast('🔴 Fixed rate removed', 'error');
    } catch {
      showToast('❌ Failed to remove rate', 'error');
    } finally {
      setSaving(false);
    }
  }, []);

  // Saved rate display
  if (savedRate && !isEditing) {
    return (
      <div className="worker-card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>💰 My Fixed Day Rate</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#059669' }}>
              ₹{savedRate.toLocaleString('en-IN')}<span style={{ fontSize: 14, fontWeight: 500, color: '#6B7280' }}>/day</span>
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
              Customers see this rate when you're active
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              onClick={() => setIsEditing(true)}
              style={{
                background: '#F5F3FF', color: '#7C3AED', border: '1px solid #E9D5FF',
                borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              ✏️ Edit
            </button>
            <button
              onClick={handleRemoveRate}
              disabled={saving}
              style={{
                background: '#FEE2E2', color: '#EF4444', border: 'none',
                borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                opacity: saving ? 0.5 : 1,
              }}
            >
              Remove
            </button>
          </div>
        </div>
        {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      </div>
    );
  }

  // Edit / Set rate form
  return (
    <div className="worker-card" style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#1F1144', marginBottom: 8 }}>
        💰 Set Your Fixed Day Rate
      </div>
      <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 12px' }}>
        Set your daily charge. Customers nearby will see this rate and can book you instantly.
      </p>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#1F1144' }}>₹</span>
        <input
          type="number"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="e.g. 600"
          min="100"
          max="50000"
          style={{
            flex: 1, padding: '10px 14px', border: '1.5px solid #E9D5FF',
            borderRadius: 10, fontSize: 16, fontWeight: 600, outline: 'none',
            color: '#1F1144',
          }}
          aria-label="Fixed daily rate in rupees"
        />
        <span style={{ fontSize: 14, color: '#6B7280' }}>/day</span>
      </div>

      {rate && Number(rate) >= 100 && (
        <div style={{
          background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8,
          padding: '8px 12px', marginBottom: 12, fontSize: 13,
        }}>
          <div style={{ color: '#15803D', fontWeight: 600 }}>
            Customer pays: ₹{Math.round(Number(rate) * 1.15 * 1.02 * 100) / 100}
          </div>
          <div style={{ color: '#6B7280', fontSize: 12, marginTop: 2 }}>
            Your rate ₹{rate} + 15% platform fee + 2% payment charges
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        {isEditing && (
          <button
            onClick={() => { setIsEditing(false); setRate(String(savedRate || '')); }}
            className="btn-secondary"
            style={{ flex: 1, padding: 10 }}
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={saving || !rate || Number(rate) < 100}
          className="btn-primary"
          style={{ flex: 1, padding: 10 }}
        >
          {saving ? 'Saving...' : savedRate ? 'Update Rate' : 'Set Rate'}
        </button>
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  );
}
