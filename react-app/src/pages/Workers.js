import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where, getDoc, setDoc, getDocs } from 'firebase/firestore';
import MasonDashboard from '../components/MasonDashboard';
import './Workers.css';

export default function Workers() {
  const [user, setUser] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [pendingGigs, setPendingGigs] = useState([]);
  const [adminRole, setAdminRole] = useState('admin');
  const [regionArea, setRegionArea] = useState('');
  const [childAdminIds, setChildAdminIds] = useState([]);
  const [childAdmins, setChildAdmins] = useState([]);
  const [approvalAssignments, setApprovalAssignments] = useState({});
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [gigType, setGigType] = useState('Plumber');
  const [certifications, setCertifications] = useState('');
  const [bankDetails, setBankDetails] = useState('');
  const [totalEarnings, setTotalEarnings] = useState('0');
  const [editingWorkerId, setEditingWorkerId] = useState(null);
  const [editWorkerData, setEditWorkerData] = useState({ certifications: '', bankDetails: '', totalEarnings: '0' });
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  async function upsertWorkerPhoneIndex(workerId, workerData, extra = {}) {
    const phone = (workerData?.contact || '').toString().trim();
    if (!phone) return;

    await setDoc(doc(db, 'workers_by_phone', phone), {
      phone,
      workerDocId: workerId,
      name: workerData?.name || '',
      gigType: workerData?.gigType || '',
      area: workerData?.area || '',
      certifications: workerData?.certifications || '',
      bankDetails: workerData?.bankDetails || '',
      totalEarnings: Number(workerData?.totalEarnings || 0),
      adminId: workerData?.adminId || '',
      approvalStatus: workerData?.approvalStatus || 'approved',
      status: workerData?.status || 'active',
      email: workerData?.email || '',
      updatedAt: new Date(),
      ...extra
    }, { merge: true });
  }

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, u => setUser(u));
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    let unsubChildren = () => {};
    const loadRole = async () => {
      const adminSnap = await getDoc(doc(db, 'admins', user.uid));
      const role = adminSnap.exists() ? (adminSnap.data().role || 'admin') : 'admin';
      setAdminRole(role);
      setRegionArea(adminSnap.exists() ? (adminSnap.data().areaName || '') : '');

      if (role === 'regionLead') {
        unsubChildren = onSnapshot(
          query(collection(db, 'admins'), where('parentAdminId', '==', user.uid)),
          (snap) => {
            const children = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setChildAdmins(children);
            setChildAdminIds(children.map(d => d.id));
          },
          err => { /* error loading child admins */ }
        );
      } else {
        setChildAdminIds([]);
        setChildAdmins([]);
      }
    };

    loadRole().catch(() => { /* error loading role */ });
    return () => unsubChildren();
  }, [user]);

  // Run migration on component mount to fix existing workers without adminId
  useEffect(() => {
    if (user && adminRole === 'superadmin') {
      migrateWorkersWithoutAdminId();
    }
  }, [user, adminRole]);

  useEffect(() => {
    if (!user) return;
    const syncPhoneIndex = (items) => {
      items.forEach(w => {
        upsertWorkerPhoneIndex(w.id, w).catch(() => { /* phone index sync failed */ });
      });
    };

    const handleError = () => {
      /* Firestore error handled silently */
    };

    if (adminRole === 'superadmin') {
      const unsub = onSnapshot(
        query(collection(db, 'gig_workers')),
        (snap) => {
          const allWorkers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          syncPhoneIndex(allWorkers);

          const pending = allWorkers.filter(w => w.approvalStatus === 'pending');
          const approved = allWorkers.filter(w => !w.approvalStatus || w.approvalStatus === 'approved' || w.approvalStatus !== 'pending');
          setWorkers(approved);
          setPendingGigs(pending);
        },
        handleError
      );
      return () => unsub();
    }

    if (adminRole === 'regionLead') {
      const unsubs = [];

      if (regionArea) {
        unsubs.push(onSnapshot(
          query(
            collection(db, 'gig_workers'),
            where('approvalStatus', '==', 'pending'),
            where('area', '==', regionArea)
          ),
          (snap) => {
            const pending = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            syncPhoneIndex(pending);
            setPendingGigs(pending);
          },
          handleError
        ));
      } else {
        setPendingGigs([]);
      }

      if (childAdminIds.length === 0) {
        setWorkers([]);
        return () => unsubs.forEach(fn => fn());
      }

      const workersByAdmin = {};
      const updateRegionWorkers = () => {
        const merged = Object.values(workersByAdmin).flat();
        const approved = merged.filter(w => !w.approvalStatus || w.approvalStatus === 'approved' || w.approvalStatus !== 'pending');
        syncPhoneIndex(approved);
        setWorkers(approved);
      };

      childAdminIds.forEach((adminId) => {
        unsubs.push(onSnapshot(
          query(collection(db, 'gig_workers'), where('adminId', '==', adminId)),
          (snap) => {
            workersByAdmin[adminId] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            updateRegionWorkers();
          },
          handleError
        ));
      });

      return () => unsubs.forEach(fn => fn());
    }

    const unsub = onSnapshot(
      query(collection(db, 'gig_workers'), where('adminId', '==', user.uid)),
      (snap) => {
        const allWorkers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        syncPhoneIndex(allWorkers);

        const approved = allWorkers.filter(w => !w.approvalStatus || w.approvalStatus === 'approved' || w.approvalStatus !== 'pending');
        setWorkers(approved);
        setPendingGigs([]);
      },
      handleError
    );
    return () => unsub();
  }, [user, adminRole, childAdminIds, regionArea]);

  async function createWorker() {
    if (!user) return alert('Not authenticated');
    if (adminRole === 'regionLead') return alert('Region leads cannot create workers directly.');
    if (adminRole !== 'admin' && adminRole !== 'superadmin' && adminRole !== 'mason') {
      return alert('Only admins and masons can create workers');
    }
    if (!name.trim()) return alert('Worker name is required');
    if (!/^[0-9]{10}$/.test(contact)) return alert('Enter valid 10 digit phone');
    const parsedEarnings = Number(totalEarnings);
    if (Number.isNaN(parsedEarnings) || parsedEarnings < 0) return alert('Total earnings must be 0 or more');
    try {
      const newWorkerPayload = {
        name, 
        contact, 
        gigType, 
        certifications: certifications.trim(),
        bankDetails: bankDetails.trim(),
        totalEarnings: parsedEarnings,
        status: 'active', 
        adminId: user.uid, 
        approvalStatus: 'approved',  // ✅ Explicitly mark as approved when admin creates
        createdAt: new Date(),
        approvedAt: new Date()
      };

      const newRef = await addDoc(collection(db, 'gig_workers'), newWorkerPayload);
      await upsertWorkerPhoneIndex(newRef.id, newWorkerPayload);

      setName(''); 
      setContact('');
      setCertifications('');
      setBankDetails('');
      setTotalEarnings('0');
      alert('✅ Worker created successfully!');
    } catch (e) { 
      alert('Error: ' + e.message); 
    }
  }

  function startEditWorker(worker) {
    setEditingWorkerId(worker.id);
    setEditWorkerData({
      certifications: worker.certifications || '',
      bankDetails: worker.bankDetails || '',
      totalEarnings: String(worker.totalEarnings ?? 0),
    });
  }

  async function saveWorkerSchema(workerId) {
    const parsedEarnings = Number(editWorkerData.totalEarnings);
    if (Number.isNaN(parsedEarnings) || parsedEarnings < 0) {
      return alert('Total earnings must be 0 or more');
    }
    try {
      await updateDoc(doc(db, 'gig_workers', workerId), {
        certifications: (editWorkerData.certifications || '').trim(),
        bankDetails: (editWorkerData.bankDetails || '').trim(),
        totalEarnings: parsedEarnings,
        updatedAt: new Date(),
      });

      const updatedSnap = await getDoc(doc(db, 'gig_workers', workerId));
      if (updatedSnap.exists()) {
        await upsertWorkerPhoneIndex(workerId, updatedSnap.data());
      }

      setEditingWorkerId(null);
      setEditWorkerData({ certifications: '', bankDetails: '', totalEarnings: '0' });
      alert('✅ Worker details updated');
    } catch (e) {
      alert('Error updating worker: ' + e.message);
    }
  }

  async function toggleWorker(id, status) {
    try {
      // Check ownership before toggling
      const workerSnap = await getDoc(doc(db, 'gig_workers', id));
      if (!workerSnap.exists()) return alert('Worker not found');
      
      const worker = workerSnap.data();
      
      // Verify ownership (unless superadmin)
      if (adminRole !== 'superadmin' && worker.adminId !== user.uid) {
        return alert('You can only modify your own workers');
      }
      
      await updateDoc(doc(db, 'gig_workers', id), { 
        status: status === 'active' ? 'inactive' : 'active' 
      });

      const updatedSnap = await getDoc(doc(db, 'gig_workers', id));
      if (updatedSnap.exists()) {
        await upsertWorkerPhoneIndex(id, updatedSnap.data());
      }
    } catch (e) { 
      alert(e.message); 
    }
  }

  // ✅ Migration: Automatically set adminId on existing workers without it
  async function migrateWorkersWithoutAdminId() {
    if (!user || adminRole !== 'superadmin') return;
    try {
      const snapshot = await getDocs(collection(db, 'gig_workers'));
      const workersToMigrate = snapshot.docs.filter(d => !d.data().adminId);
      
      if (workersToMigrate.length === 0) {
        return;
      }
      
      // Update all workers without adminId to have current user's ID
      for (const workerDoc of workersToMigrate) {
        await updateDoc(doc(db, 'gig_workers', workerDoc.id), {
          adminId: user.uid,
          migratedAt: new Date()
        });
      }
    } catch {
      /* migration error */
    }
  }

  async function approveWorker(workerId) {
    if (!user) return alert('Not authenticated');
    const targetAdminId = approvalAssignments[workerId];
    if (!targetAdminId) return alert('Please select a mason before approval.');
    try {
      await updateDoc(doc(db, 'gig_workers', workerId), {
        approvalStatus: 'approved',
        adminId: targetAdminId,
        status: 'active',
        approvedAt: new Date(),
        approvedByRegionLeadId: user.uid,
      });

      const updatedSnap = await getDoc(doc(db, 'gig_workers', workerId));
      if (updatedSnap.exists()) {
        await upsertWorkerPhoneIndex(workerId, updatedSnap.data());
      }

      alert('✅ Gig approved successfully!');
    } catch (e) {
      alert('Error approving worker: ' + e.message);
    }
  }

  async function rejectWorker(workerId) {
    try {
      await updateDoc(doc(db, 'gig_workers', workerId), {
        approvalStatus: 'rejected',
        status: 'inactive'
      });

      const updatedSnap = await getDoc(doc(db, 'gig_workers', workerId));
      if (updatedSnap.exists()) {
        await upsertWorkerPhoneIndex(workerId, updatedSnap.data());
      }

      alert('Worker application rejected.');
    } catch (e) {
      alert('Error rejecting worker: ' + e.message);
    }
  }

  async function createChildAdmin() {
    if (adminRole !== 'regionLead') return alert('Only region leads can create masons.');
    if (!newAdminName || !newAdminEmail || !newAdminPassword) return alert('Fill all mason fields.');
    if (newAdminPassword.length < 6) return alert('Password must be at least 6 characters.');

    try {
      const cred = await createUserWithEmailAndPassword(auth, newAdminEmail, newAdminPassword);
      const newUid = cred.user.uid;
      await setDoc(doc(db, 'admins', newUid), {
        name: newAdminName,
        email: newAdminEmail,
        role: 'mason',
        parentAdminId: user.uid,
        areaName: regionArea || '',
        createdAt: new Date(),
      });
      alert('✅ Mason created successfully.');
      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminPassword('');
    } catch (e) {
      alert('Error creating mason: ' + e.message);
    }
  }

  return (
    <div className="workers-page">
      <header className="workers-header">
        <div className="eyebrow">Professional Management</div>
        <h2>Workers & Marketplace</h2>
      </header>

      {/* Mason Dashboard — full job browser for mason/admin roles */}
      {(adminRole === 'mason' || adminRole === 'admin' || adminRole === 'superadmin' || adminRole === 'regionLead') && (
        <details className="dashboard-collapsible">
          <summary>
            🧱 Mason Dashboard — Browse All Job Types &amp; Manage Workers
          </summary>
          <div style={{ padding: 'var(--space-6)' }}>
            <MasonDashboard />
          </div>
        </details>
      )}
      
      {adminRole === 'regionLead' && (
        <div className="region-lead-banner">
          <strong>Region Admin Mode:</strong> Approve gig registrations in your area and assign each approved gig to a mason.
        </div>
      )}

      {adminRole === 'regionLead' && (
        <div className="glass-panel">
          <div className="form-title">👤 Create Mason Account</div>
          <div className="form-grid">
            <input className="input-premium" placeholder="Mason Name" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} />
            <input className="input-premium" placeholder="Mason Email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} />
            <input className="input-premium" placeholder="Password" type="password" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} />
          </div>
          <div className="form-actions">
            <button className="btn-primary" onClick={createChildAdmin}>
              Create Mason
            </button>
          </div>
        </div>
      )}

      <div className="glass-panel">
        <div className="form-title">👷 Add Professional Worker</div>
        <div className="form-grid">
          <input className="input-premium" placeholder="Name" value={name} onChange={e => setName(e.target.value)} />
          <input className="input-premium" placeholder="10 digit phone" value={contact} onChange={e => setContact(e.target.value)} />
          <select className="input-premium" value={gigType} onChange={e => setGigType(e.target.value)}>
            <option value="Plumber">Plumber</option>
            <option value="Electrician">Electrician</option>
            <option value="Carpenter">Carpenter</option>
            <option value="Painter">Painter</option>
          </select>
          <input className="input-premium" placeholder="Certifications (comma separated)" value={certifications} onChange={e => setCertifications(e.target.value)} />
          <input className="input-premium" placeholder="Bank Details" value={bankDetails} onChange={e => setBankDetails(e.target.value)} />
          <input className="input-premium" placeholder="Total Earnings" value={totalEarnings} onChange={e => setTotalEarnings(e.target.value)} />
        </div>
        <div className="form-actions">
          <button className="btn-primary" onClick={createWorker} disabled={adminRole === 'regionLead'}>
            Create Worker Profile
          </button>
        </div>
      </div>

      {/* PENDING GIG APPROVALS - For Region Leads */}
      {adminRole === 'regionLead' && pendingGigs.length > 0 && (
        <div className="pending-approvals-section">
          <div className="form-title" style={{ color: '#92400e' }}>⏳ Pending Gig Approvals ({pendingGigs.length})</div>
          {childAdmins.length === 0 && (
            <div style={{ marginBottom: 16, padding: '12px', background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', borderRadius: 8, fontSize: 13 }}>
              <strong>Action Required:</strong> Create at least one mason under this region lead before approving gigs.
            </div>
          )}
          {pendingGigs.map(w => (
            <div key={w.id} className="pending-card">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-main)' }}>{w.name}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                  📞 {w.contact} | 📧 {w.email}
                </div>
                <div style={{ color: 'var(--text-main)', fontSize: 14, marginTop: 8 }}>
                  Service: <strong>{w.gigType}</strong> | Area: <strong>{w.area}</strong>
                </div>
                <div style={{ marginTop: 12 }}>
                  <select
                    className="input-premium"
                    value={approvalAssignments[w.id] || ''}
                    onChange={e => setApprovalAssignments(prev => ({ ...prev, [w.id]: e.target.value }))}
                    style={{ maxWidth: 300 }}
                  >
                    <option value="">Assign to mason...</option>
                    {childAdmins.map(a => (
                      <option key={a.id} value={a.id}>{a.name || a.email}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  className="btn-primary"
                  onClick={() => approveWorker(w.id)}
                  disabled={childAdmins.length === 0}
                  style={{ padding: '10px 20px', fontSize: 13 }}
                >
                  Approve
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    if (window.confirm('Reject this gig application?')) {
                      rejectWorker(w.id);
                    }
                  }}
                  style={{ padding: '10px 20px', fontSize: 13, color: '#ef4444' }}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <header style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>
            {adminRole === 'superadmin' ? 'Total Workforce' : 
             adminRole === 'regionLead' ? `Regional Professionals` : 
             'Assigned Professionals'} ({workers.length})
          </h3>
        </header>
        
        {workers.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: 'var(--space-12)' }}>
            <div style={{ fontSize: 48, marginBottom: 'var(--space-4)' }}>📭</div>
            <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 'var(--space-2)' }}>No professionals found</div>
            <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
              {adminRole === 'mason' || adminRole === 'admin' 
                ? 'Create or assign your first professional using the tools above.'
                : 'Professionals in your regional jurisdiction will appear here once approved.'}
            </p>
          </div>
        ) : (
          <div className="worker-grid">
            {workers.map(w => (
              <div key={w.id} className="worker-premium-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-main)' }}>{w.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
                      {w.gigType} • 📞 {w.contact}
                    </div>
                  </div>
                  <span className={`worker-status-badge ${w.status === 'active' ? 'status-active' : 'status-inactive'}`}>
                    {w.status === 'active' ? '● Active' : '○ Inactive'}
                  </span>
                </div>

                <div className="worker-earnings">
                  💰 Total Earnings: Rs.{Number(w.totalEarnings || 0).toLocaleString()}
                </div>

                <div style={{ marginTop: 'var(--space-4)', fontSize: 13, borderTop: '1px solid var(--border-light)', paddingTop: 'var(--space-3)' }}>
                  {editingWorkerId === w.id ? (
                    <div style={{ display: 'grid', gap: 10 }}>
                      <input className="input-premium" placeholder="Certifications" value={editWorkerData.certifications} onChange={e => setEditWorkerData(prev => ({ ...prev, certifications: e.target.value }))} />
                      <input className="input-premium" placeholder="Bank Details" value={editWorkerData.bankDetails} onChange={e => setEditWorkerData(prev => ({ ...prev, bankDetails: e.target.value }))} />
                      <input className="input-premium" type="number" placeholder="Earnings" value={editWorkerData.totalEarnings} onChange={e => setEditWorkerData(prev => ({ ...prev, totalEarnings: e.target.value }))} />
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      <div><strong>Cert:</strong> {w.certifications || 'None provided'}</div>
                      <div><strong>Bank:</strong> {w.bankDetails || 'Not available'}</div>
                    </div>
                  )}
                </div>

                <div className="worker-actions">
                  {editingWorkerId === w.id ? (
                    <>
                      <button className="btn-primary" style={{ padding: '8px 16px', fontSize: 12 }} onClick={() => saveWorkerSchema(w.id)}>Save</button>
                      <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: 12 }} onClick={() => setEditingWorkerId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <button className="btn-secondary" style={{ padding: '8px 16px', fontSize: 12, flex: 1 }} onClick={() => startEditWorker(w)}>Update Bio</button>
                      <button 
                        className="btn-secondary"
                        style={{ padding: '8px 16px', fontSize: 12, flex: 1, color: w.status === 'active' ? '#ef4444' : '#10b981' }}
                        onClick={() => {
                          if (window.confirm(`${w.status === 'active' ? 'Disable' : 'Enable'} this worker?`)) {
                            toggleWorker(w.id, w.status);
                          }
                        }}
                      >
                        {w.status === 'active' ? 'Disable' : 'Enable'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
