import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

export default function WorkerDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [worker, setWorker] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setError('Not logged in');
        setLoading(false);
        return;
      }

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

  if (loading) {
    return <div style={{ padding: 24, textAlign: 'center' }}>⏳ Loading worker dashboard...</div>;
  }

  if (error) {
    return <div style={{ padding: 24, color: '#b91c1c' }}>❌ {error}</div>;
  }

  const statusColor = worker?.status === 'active' ? '#065f46' : '#92400e';
  const statusBg = worker?.status === 'active' ? '#d1fae5' : '#fef3c7';
  const isPending = worker?.approvalStatus !== 'approved' || worker?.status !== 'active';

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

      <div style={{ marginTop: 16, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, fontSize: 13, color: '#334155' }}>
        Job assignment UI can be connected next. This dashboard is now enabled for worker login and account visibility.
      </div>
    </div>
  );
}
