import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import WorkerRegistration from '../components/WorkerRegistration';

export default function WorkerDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [worker, setWorker] = useState(null);
  const [userId, setUserId] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setError('Not logged in');
        setLoading(false);
        return;
      }

      setUserId(u.uid);

      try {
        const snap = await getDoc(doc(db, 'worker_auth', u.uid));
        if (!snap.exists()) {
          setError('Worker account not found. Please activate your worker login.');
          setLoading(false);
          return;
        }

        setWorker(snap.data());
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    });

    return () => unsub();
  }, []);

  const handleSaveJobTypes = async (selectedIds) => {
    if (!userId) return;
    await updateDoc(doc(db, 'worker_auth', userId), {
      selectedJobIds: selectedIds,
      jobApprovalStatus: 'pending',
    });
    // Refresh worker data
    const snap = await getDoc(doc(db, 'worker_auth', userId));
    setWorker(snap.data());
  };

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center' }}>⏳ Loading worker dashboard...</div>;
  }

  if (error) {
    return <div style={{ padding: 24, color: '#b91c1c' }}>❌ {error}</div>;
  }

  const statusColor = worker?.status === 'active' ? '#065f46' : '#92400e';
  const statusBg = worker?.status === 'active' ? '#d1fae5' : '#fef3c7';
  const isPending = worker?.approvalStatus !== 'approved' || worker?.status !== 'active';
  const pendingJobApproval = worker?.jobApprovalStatus === 'pending';

  const tabs = [
    { id: 'profile', label: '👤 Profile' },
    { id: 'jobs', label: '🔧 My Job Types' },
  ];

  return (
    <div style={{ maxWidth: 900, margin: '20px auto', padding: 20 }}>
      <h2 style={{ marginBottom: 14 }}>👷 Worker Dashboard</h2>

      {isPending && (
        <div
          style={{
            marginBottom: 14,
            background: '#fff7ed',
            border: '1px solid #fdba74',
            color: '#9a3412',
            borderRadius: 10,
            padding: 12,
            fontSize: 13,
            fontWeight: 600
          }}
        >
          ⏳ Worker Pending Approval: Your account is not fully active yet. Please contact your mason/region lead.
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 18px',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: 13,
              background: activeTab === tab.id ? 'var(--primary-purple)' : '#f1f5f9',
              color: activeTab === tab.id ? '#fff' : 'var(--text-dark)',
              transition: 'background 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'profile' && (
        <div style={{ background: 'white', borderRadius: 10, padding: 16, border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>{worker?.name || 'Worker'}</h3>
            <span style={{ background: statusBg, color: statusColor, padding: '6px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
              {worker?.status || 'inactive'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div><strong>Phone:</strong> {worker?.phone || '-'}</div>
            <div><strong>Email:</strong> {worker?.email || '-'}</div>
            <div><strong>Service:</strong> {worker?.gigType || '-'}</div>
            <div><strong>Area:</strong> {worker?.area || '-'}</div>
            <div><strong>Approval:</strong> {worker?.approvalStatus || 'pending'}</div>
            <div><strong>Admin ID:</strong> {worker?.adminId || '-'}</div>
          </div>
        </div>
      )}

      {activeTab === 'jobs' && (
        <WorkerRegistration
          initialSelected={worker?.selectedJobIds || []}
          onSave={handleSaveJobTypes}
          pendingApproval={pendingJobApproval}
        />
      )}
    </div>
  );
}
