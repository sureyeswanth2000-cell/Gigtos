import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where } from 'firebase/firestore';

export default function Workers() {
  const [user, setUser] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [gigType, setGigType] = useState('Plumber');
  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'active'
  const [rejectId, setRejectId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, u => setUser(u));
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    // Region leads see their own workers only

    const q = query(collection(db, 'gig_workers'), where('adminId', '==', user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setWorkers(list);
    }, err => console.error(err));
    return () => unsub();
  }, [user]);

  async function createWorker() {
    if (!user) return alert('Not authenticated');
    if (!/^[0-9]{10}$/.test(contact)) return alert('Enter valid 10 digit phone');
    try {
      await addDoc(collection(db, 'gig_workers'), {
        name, contact, gigType,
        status: 'pending_approval',
        adminId: user.uid,
        createdAt: new Date(),
        completedJobs: 0,
        isTopListed: false,
      });
      setName(''); setContact('');
    } catch (e) { console.error(e); alert(e.message); }
  }

  async function approveWorker(id) {
    try {
      await updateDoc(doc(db, 'gig_workers', id), {
        status: 'active',
        approvedAt: new Date(),
        approvedBy: user.uid,
        rejectionReason: null,
      });
    } catch (e) { console.error(e); alert(e.message); }
  }

  async function rejectWorker(id) {
    if (!rejectReason.trim()) return alert('Please enter a rejection reason.');
    try {
      await updateDoc(doc(db, 'gig_workers', id), {
        status: 'rejected',
        rejectedAt: new Date(),
        rejectedBy: user.uid,
        rejectionReason: rejectReason.trim(),
      });
      setRejectId(null);
      setRejectReason('');
    } catch (e) { console.error(e); alert(e.message); }
  }

  async function toggleWorker(id, status) {
    try {
      await updateDoc(doc(db, 'gig_workers', id), {
        status: status === 'active' ? 'inactive' : 'active',
      });
    } catch (e) { console.error(e); alert(e.message); }
  }

  const pending = workers.filter(w => w.status === 'pending_approval');
  const approved = workers.filter(w => {
    if (filterStatus === 'All') return w.status === 'active' || w.status === 'inactive';
    if (filterStatus === 'Active') return w.status === 'active';
    if (filterStatus === 'Inactive') return w.status === 'inactive';
    if (filterStatus === 'Rejected') return w.status === 'rejected';
    return true;
  });

  const statusBadge = (status) => {
    const map = {
      active: { bg: '#d1fae5', color: '#065f46', label: '✅ Active' },
      inactive: { bg: '#f3f4f6', color: '#6b7280', label: '⏸ Inactive' },
      pending_approval: { bg: '#fef3c7', color: '#92400e', label: '⏳ Pending Approval' },
      rejected: { bg: '#fee2e2', color: '#991b1b', label: '❌ Rejected' },
    };
    const s = map[status] || { bg: '#f0f0f0', color: '#666', label: status };
    return (
      <span style={{ padding: '3px 8px', borderRadius: '10px', fontSize: '12px', fontWeight: 'bold', backgroundColor: s.bg, color: s.color }}>
        {s.label}
      </span>
    );
  };

  const tabStyle = (tab) => ({
    padding: '10px 20px', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', border: 'none',
    borderBottom: activeTab === tab ? '3px solid #667eea' : '3px solid transparent',
    backgroundColor: 'transparent', color: activeTab === tab ? '#667eea' : '#666',
    position: 'relative',
  });

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ margin: '0 0 20px 0', fontSize: '24px', color: '#333' }}>👨‍🔧 Worker Management</h2>

      {/* ── Add New Worker Form ── */}
      <div style={{ background: '#fff', padding: '20px', borderRadius: '10px', marginBottom: '24px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h4 style={{ margin: '0 0 16px 0', color: '#333' }}>➕ Register New Worker</h4>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', display: 'block', marginBottom: '4px' }}>Name</label>
            <input placeholder="Worker name" value={name} onChange={e => setName(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', display: 'block', marginBottom: '4px' }}>Phone</label>
            <input placeholder="10-digit phone" value={contact} onChange={e => setContact(e.target.value.replace(/\D/g, '').slice(0, 10))}
              style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px' }} />
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', display: 'block', marginBottom: '4px' }}>Service Type</label>
            <select value={gigType} onChange={e => setGigType(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #ddd', borderRadius: '6px', fontSize: '14px', background: '#fff' }}>
              <option value="Plumber">🧰 Plumber</option>
              <option value="Electrician">⚡ Electrician</option>
              <option value="Carpenter">🪛 Carpenter</option>
              <option value="Painter">🎨 Painter</option>
            </select>
          </div>
          <button onClick={createWorker}
            style={{ padding: '9px 20px', backgroundColor: '#667eea', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' }}>
            Register
          </button>
        </div>
        <p style={{ margin: '10px 0 0 0', fontSize: '12px', color: '#888' }}>
          ℹ️ New workers are placed in <strong>Pending Approval</strong> status until reviewed.
        </p>
      </div>

      {/* ── Tabs ── */}
      <div style={{ borderBottom: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', gap: '0' }}>
        <button style={tabStyle('pending')} onClick={() => setActiveTab('pending')}>
          ⏳ Pending Approval
          {pending.length > 0 && (
            <span style={{ marginLeft: '6px', backgroundColor: '#ef4444', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>
              {pending.length}
            </span>
          )}
        </button>
        <button style={tabStyle('approved')} onClick={() => setActiveTab('approved')}>
          👥 All Workers ({workers.filter(w => w.status !== 'pending_approval').length})
        </button>
      </div>

      {/* ── Pending Approval Tab ── */}
      {activeTab === 'pending' && (
        <div>
          {pending.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#f9f9f9', borderRadius: '10px', color: '#888' }}>
              ✅ No pending worker registrations
            </div>
          ) : (
            pending.map(w => (
              <div key={w.id} style={{ background: '#fff', padding: '16px', borderRadius: '10px', marginBottom: '12px', border: '1px solid #fbbf24', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '16px', color: '#333' }}>{w.name}</div>
                    <div style={{ color: '#555', fontSize: '14px', marginTop: '4px' }}>{w.gigType} • 📞 {w.contact}</div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                      Registered: {w.createdAt?.toDate ? w.createdAt.toDate().toLocaleDateString() : 'N/A'}
                    </div>
                    {statusBadge(w.status)}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => approveWorker(w.id)}
                      style={{ padding: '8px 16px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                      ✅ Approve
                    </button>
                    <button onClick={() => { setRejectId(w.id); setRejectReason(''); }}
                      style={{ padding: '8px 16px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                      ❌ Reject
                    </button>
                  </div>
                </div>
                {/* Rejection reason input (inline) */}
                {rejectId === w.id && (
                  <div style={{ marginTop: '12px', padding: '12px', background: '#fee2e2', borderRadius: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#991b1b', display: 'block', marginBottom: '6px' }}>
                      Rejection Reason (required):
                    </label>
                    <textarea
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      placeholder="Explain why this registration is being rejected…"
                      rows={2}
                      style={{ width: '100%', padding: '8px', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', resize: 'vertical' }}
                    />
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button onClick={() => rejectWorker(w.id)}
                        style={{ padding: '7px 14px', backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
                        Confirm Reject
                      </button>
                      <button onClick={() => setRejectId(null)}
                        style={{ padding: '7px 14px', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Approved/All Workers Tab ── */}
      {activeTab === 'approved' && (
        <div>
          {/* Status filter */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {['All', 'Active', 'Inactive', 'Rejected'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                style={{
                  padding: '6px 14px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', borderRadius: '20px',
                  backgroundColor: filterStatus === s ? '#667eea' : '#f0f4ff',
                  color: filterStatus === s ? '#fff' : '#667eea',
                  border: filterStatus === s ? '1px solid #667eea' : '1px solid #c7d2fe',
                }}>
                {s}
              </button>
            ))}
          </div>

          {approved.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', backgroundColor: '#f9f9f9', borderRadius: '10px', color: '#888' }}>
              No workers in this category
            </div>
          ) : (
            approved.map(w => (
              <div key={w.id} style={{ background: '#fff', padding: '16px', borderRadius: '10px', marginBottom: '10px', border: '1px solid #e2e8f0', boxShadow: '0 2px 6px rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#333' }}>
                    {w.name}
                    {w.isTopListed && <span style={{ marginLeft: '6px', fontSize: '11px', backgroundColor: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '8px' }}>⭐ Top Listed</span>}
                  </div>
                  <div style={{ color: '#555', fontSize: '13px', marginTop: '3px' }}>{w.gigType} • 📞 {w.contact}</div>
                  {w.rejectionReason && (
                    <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>Rejection reason: {w.rejectionReason}</div>
                  )}
                  <div style={{ marginTop: '6px' }}>{statusBadge(w.status)}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(w.status === 'active' || w.status === 'inactive') && (
                    <button onClick={() => toggleWorker(w.id, w.status)}
                      style={{ padding: '7px 14px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', border: 'none', borderRadius: '6px', backgroundColor: w.status === 'active' ? '#fef3c7' : '#d1fae5', color: w.status === 'active' ? '#92400e' : '#065f46' }}>
                      {w.status === 'active' ? '⏸ Disable' : '▶ Enable'}
                    </button>
                  )}
                  {w.status === 'rejected' && (
                    <button onClick={() => approveWorker(w.id)}
                      style={{ padding: '7px 14px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', border: 'none', borderRadius: '6px', backgroundColor: '#d1fae5', color: '#065f46' }}>
                      ✅ Re-Approve
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

