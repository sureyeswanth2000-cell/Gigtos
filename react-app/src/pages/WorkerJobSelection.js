import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { SERVICE_CATALOG } from '../utils/aiAssistant';
import { SPECIAL_JOBS } from '../config/specialJobs';

const MAX_SELECTIONS = 3;

function buildAllJobOptions() {
  const options = [];
  const seen = new Set();
  for (const sj of SPECIAL_JOBS) {
    if (!seen.has(sj.id)) {
      options.push({ id: sj.id, name: sj.label, icon: sj.icon, category: sj.category });
      seen.add(sj.id);
    }
  }
  for (const svc of SERVICE_CATALOG) {
    const normalizedId = svc.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!seen.has(normalizedId)) {
      options.push({ id: normalizedId, name: svc.name, icon: svc.icon, category: svc.category });
      seen.add(normalizedId);
    }
  }
  return options;
}

const ALL_JOB_OPTIONS = buildAllJobOptions();

/**
 * WorkerJobSelection – page for workers to view and edit their selected job types (up to 3).
 * Loads current selections from Firestore and allows updating.
 */
export default function WorkerJobSelection() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState([]);
  const [originalSelected, setOriginalSelected] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const loadWorkerJobs = async () => {
      const uid = auth.currentUser?.uid;
      if (!uid) { navigate('/auth'); return; }
      try {
        const snap = await getDoc(doc(db, 'worker_auth', uid));
        if (snap.exists()) {
          const data = snap.data();
          const gigTypes = data.gigTypes || (data.gigType ? [data.gigType] : []);
          const mapped = gigTypes.map(t => {
            const found = ALL_JOB_OPTIONS.find(o => o.id === t);
            return found || { id: t, name: t.charAt(0).toUpperCase() + t.slice(1).replace(/-/g, ' '), icon: '🔧', category: '' };
          });
          setSelected(mapped);
          setOriginalSelected(mapped);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    loadWorkerJobs();
  }, [navigate]);

  const toggleJob = useCallback((job) => {
    setSelected(prev => {
      const exists = prev.find(j => j.id === job.id);
      if (exists) return prev.filter(j => j.id !== job.id);
      if (prev.length >= MAX_SELECTIONS) return prev;
      return [...prev, job];
    });
  }, []);

  const handleSave = async () => {
    if (selected.length === 0) { setToast({ msg: 'Select at least one job type', type: 'error' }); return; }
    setSaving(true);
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const gigTypes = selected.map(j => j.id);
    try {
      await updateDoc(doc(db, 'worker_auth', uid), { gigTypes, gigType: gigTypes[0] });
      await updateDoc(doc(db, 'gig_workers', uid), { gigTypes, gigType: gigTypes[0] }).catch(() => {});
      setOriginalSelected(selected);
      setToast({ msg: '✅ Job types updated!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      setToast({ msg: 'Error saving: ' + err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = JSON.stringify(selected.map(s => s.id)) !== JSON.stringify(originalSelected.map(s => s.id));

  const filteredOptions = ALL_JOB_OPTIONS.filter(job => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return job.name.toLowerCase().includes(q) || (job.category || '').toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
        <p>Loading your job selections...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', padding: '16px 16px 100px' }}>
      <button onClick={() => navigate('/worker/dashboard')} style={{
        background: 'none', border: 'none', color: '#7C3AED', fontWeight: 600,
        fontSize: 14, cursor: 'pointer', marginBottom: 12, padding: 0
      }}>← Back to Dashboard</button>

      <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1F1144', margin: '0 0 4px' }}>
        ✏️ Edit Job Types
      </h2>
      <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 16px' }}>
        Select up to <strong>{MAX_SELECTIONS}</strong> job types you support. Changes are saved to your profile.
      </p>

      {/* Selected chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {selected.map(job => (
          <span key={job.id} style={{
            background: '#7C3AED', color: 'white', padding: '5px 12px',
            borderRadius: 20, fontSize: 13, fontWeight: 600,
            display: 'inline-flex', alignItems: 'center', gap: 4
          }}>
            {job.icon} {job.name}
            <button onClick={() => toggleJob(job)} style={{
              background: 'none', border: 'none', color: 'white',
              cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1
            }}>✕</button>
          </span>
        ))}
        {selected.length === 0 && (
          <span style={{ fontSize: 13, color: '#9CA3AF' }}>No jobs selected</span>
        )}
      </div>

      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
        {selected.length}/{MAX_SELECTIONS} selected
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search job types…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{
          width: '100%', padding: 10, border: '1.5px solid #E9D5FF',
          borderRadius: 10, fontSize: 14, boxSizing: 'border-box', marginBottom: 12,
          outline: 'none'
        }}
      />

      {/* Job grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 8, marginBottom: 20
      }}>
        {filteredOptions.map(job => {
          const isChecked = !!selected.find(j => j.id === job.id);
          const isDisabled = !isChecked && selected.length >= MAX_SELECTIONS;
          return (
            <button key={job.id} onClick={() => !isDisabled && toggleJob(job)}
              style={{
                background: isChecked ? '#EDE9FE' : 'white',
                border: isChecked ? '2px solid #7C3AED' : '1.5px solid #E9D5FF',
                borderRadius: 12, padding: '12px 8px', cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.4 : 1, textAlign: 'center',
                transition: 'all 0.2s'
              }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{job.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1F1144' }}>{job.name}</div>
              {job.category && <div style={{ fontSize: 10, color: '#9CA3AF' }}>{job.category}</div>}
            </button>
          );
        })}
      </div>

      {filteredOptions.length === 0 && (
        <p style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
          No job types found for "{search}".
        </p>
      )}

      {/* Save button */}
      <button onClick={handleSave} disabled={!hasChanges || saving || selected.length === 0}
        style={{
          width: '100%', padding: 14, borderRadius: 12, border: 'none',
          background: hasChanges ? 'linear-gradient(135deg, #7C3AED, #A259FF)' : '#E5E7EB',
          color: hasChanges ? 'white' : '#9CA3AF', fontSize: 15, fontWeight: 700,
          cursor: hasChanges ? 'pointer' : 'not-allowed',
          transition: 'all 0.2s'
        }}>
        {saving ? '⏳ Saving...' : '💾 Save Changes'}
      </button>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: toast.type === 'success' ? '#059669' : '#DC2626',
          color: 'white', padding: '10px 20px', borderRadius: 24, fontSize: 14,
          fontWeight: 500, zIndex: 9999
        }}>{toast.msg}</div>
      )}
    </div>
  );
}
