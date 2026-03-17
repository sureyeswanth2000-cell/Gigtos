import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where, getDoc, setDoc, getDocs } from 'firebase/firestore';

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
          err => console.error(err)
        );
      } else {
        setChildAdminIds([]);
        setChildAdmins([]);
      }
    };

    loadRole().catch(console.error);
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
        upsertWorkerPhoneIndex(w.id, w).catch(err => console.error('Phone index sync failed:', err));
      });
    };

    const handleError = (err) => {
      console.error('❌ Firestore error:', err);
      console.error('Error code:', err.code);
      console.error('Error message:', err.message);
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
        console.log('✅ Admin/Mason: showing', approved.length, 'workers for uid:', user.uid);
        console.log('Worker details:', approved.map(w => ({ name: w.name, adminId: w.adminId })));
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
      console.error(e); 
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
      console.error(e);
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
      console.error(e); 
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
        console.log('✅ No workers need migration');
        return;
      }
      
      // Update all workers without adminId to have current user's ID
      for (const workerDoc of workersToMigrate) {
        await updateDoc(doc(db, 'gig_workers', workerDoc.id), {
          adminId: user.uid,
          migratedAt: new Date()
        });
      }
      console.log(`✅ Migrated ${workersToMigrate.length} workers - set adminId to ${user.uid}`);
    } catch (e) {
      console.error('Migration error:', e);
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
      console.error(e);
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
      console.error(e);
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
      console.error(e);
      alert('Error creating mason: ' + e.message);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Workers</h2>
      
      {/* DEBUG: Show current role */}
      <div style={{ 
        background: '#f0f9ff', 
        border: '2px solid #3b82f6', 
        color: '#1e40af', 
        padding: 10, 
        borderRadius: 8, 
        marginBottom: 12,
        fontSize: 12,
        fontWeight: 'bold'
      }}>
        🔐 Current Role: {adminRole || 'loading...'} | UID: {user?.uid?.slice(0, 8)}...
        {(adminRole === 'admin' || adminRole === 'mason') && (
          <div style={{ marginTop: 4, fontSize: 11, fontWeight: 'normal' }}>
            🔒 You can ONLY see and manage gigs that YOU created. Other {adminRole}s' gigs are hidden.
          </div>
        )}
      </div>
      
      {adminRole === 'regionLead' && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: 10, borderRadius: 8, marginBottom: 12 }}>
          Region Admin Mode: approve gig registrations in your area and assign each approved gig to a mason.
        </div>
      )}

      {adminRole === 'regionLead' && (
        <div style={{ background: '#fff', padding: 12, borderRadius: 8, marginBottom: 12, border: '1px solid #dbeafe' }}>
          <h4>Create Mason</h4>
          <input placeholder="Mason Name" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} style={{ padding: 8, marginRight: 8 }} />
          <input placeholder="Mason Email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} style={{ padding: 8, marginRight: 8 }} />
          <input placeholder="Password" type="password" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} style={{ padding: 8, marginRight: 8 }} />
          <button onClick={createChildAdmin} style={{ padding: 8, background: '#2563eb', color: 'white', border: 'none', borderRadius: 4 }}>
            Create Mason
          </button>
        </div>
      )}
      <div style={{ background: '#fff', padding: 12, borderRadius: 8, marginBottom: 12 }}>
        <h4>Create Worker</h4>
        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} style={{ padding: 8, marginRight: 8 }} />
        <input placeholder="10 digit phone" value={contact} onChange={e => setContact(e.target.value)} style={{ padding: 8, marginRight: 8 }} />
        <select value={gigType} onChange={e => setGigType(e.target.value)} style={{ padding: 8, marginRight: 8 }}>
          <option value="Plumber">Plumber</option>
          <option value="Electrician">Electrician</option>
          <option value="Carpenter">Carpenter</option>
          <option value="Painter">Painter</option>
        </select>
        <input placeholder="Certifications (comma separated)" value={certifications} onChange={e => setCertifications(e.target.value)} style={{ padding: 8, marginRight: 8, minWidth: 260, marginTop: 8 }} />
        <input placeholder="Bank Details" value={bankDetails} onChange={e => setBankDetails(e.target.value)} style={{ padding: 8, marginRight: 8, minWidth: 220, marginTop: 8 }} />
        <input placeholder="Total Earnings" value={totalEarnings} onChange={e => setTotalEarnings(e.target.value)} style={{ padding: 8, marginRight: 8, width: 140, marginTop: 8 }} />
        <button onClick={createWorker} disabled={adminRole === 'regionLead'} style={{ padding: 8, opacity: adminRole === 'regionLead' ? 0.6 : 1 }}>
          Create
        </button>
      </div>

      {/* PENDING GIG APPROVALS - For Region Leads */}
      {adminRole === 'regionLead' && pendingGigs.length > 0 && (
        <div style={{ background: '#fef3c7', padding: 16, borderRadius: 8, marginBottom: 16, border: '2px solid #fcd34d' }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#92400e' }}>⏳ Pending Gig Approvals ({pendingGigs.length})</h4>
          {childAdmins.length === 0 && (
            <div style={{ marginBottom: 10, padding: 8, background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', borderRadius: 6, fontSize: 12 }}>
              Create at least one mason under this region lead before approving gigs.
            </div>
          )}
          {pendingGigs.map(w => (
            <div key={w.id} style={{
              background: 'white',
              padding: 12,
              borderRadius: 6,
              marginBottom: 10,
              border: '1px solid #fcd34d',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{w.name}</div>
                <div style={{ color: '#555', fontSize: 12 }}>📞 {w.contact} | 📧 {w.email}</div>
                <div style={{ color: '#666', fontSize: 12, marginTop: 4 }}>
                  Service: <strong>{w.gigType}</strong> | Area: <strong>{w.area}</strong>
                </div>
                <div style={{ marginTop: 8 }}>
                  <select
                    value={approvalAssignments[w.id] || ''}
                    onChange={e => setApprovalAssignments(prev => ({ ...prev, [w.id]: e.target.value }))}
                    style={{ padding: 6, minWidth: 220 }}
                  >
                    <option value="">Assign to mason...</option>
                    {childAdmins.map(a => (
                      <option key={a.id} value={a.id}>{a.name || a.email}</option>
                    ))}
                  </select>
                </div>
                <div style={{ color: '#999', fontSize: 11, marginTop: 4 }}>
                  Applied: {w.createdAt?.toDate?.()?.toLocaleDateString?.() || 'Recently'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginLeft: 12 }}>
                <button
                  onClick={() => approveWorker(w.id)}
                  disabled={childAdmins.length === 0}
                  style={{
                    padding: '6px 14px',
                    background: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 'bold',
                    opacity: childAdmins.length === 0 ? 0.5 : 1
                  }}
                >
                  ✅ Approve
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Reject this gig application?')) {
                      rejectWorker(w.id);
                    }
                  }}
                  style={{
                    padding: '6px 14px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 'bold'
                  }}
                >
                  ❌ Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <h4>
          {adminRole === 'superadmin' ? 'All Workers' : 
           adminRole === 'regionLead' ? `Workers in Your Region` : 
           'Your Workers'} ({workers.length})
        </h4>
        
        {workers.length === 0 ? (
          <div style={{
            background: '#f0fdf4',
            border: '2px solid #bbf7d0',
            color: '#166534',
            padding: 16,
            borderRadius: 8,
            marginBottom: 12
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: 8 }}>📭 No workers created yet</div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              {adminRole === 'mason' || adminRole === 'admin' 
                ? 'Create your first worker using the form above. Only workers YOU create will appear here.'
                : 'Create your first worker using the form above. Your workers will appear here once created.'}
              <br />
              <span style={{ fontSize: 11, color: '#15803d', marginTop: 8, display: 'block' }}>
                👉 Tip: Each worker can be assigned to multiple jobs across the platform.
              </span>
            </div>
          </div>
        ) : null}
        
        {workers.map(w => (
          <div key={w.id} style={{ background: '#fff', padding: 12, borderRadius: 8, marginBottom: 8, display: 'flex', justifyContent: 'space-between', border: '1px solid #e5e7eb', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1f2937' }}>{w.name}</div>
              <div style={{ color: '#6b7280', fontSize: 13, marginTop: 4 }}>
                {w.gigType} • 📞 {w.contact}
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 6 }}>
                Status: <span style={{ 
                  fontWeight: 'bold',
                  color: w.status === 'active' ? '#059669' : '#d97706',
                  background: w.status === 'active' ? '#d1fae5' : '#fef3c7',
                  padding: '2px 8px',
                  borderRadius: 4,
                  display: 'inline-block'
                }}>
                  {w.status === 'active' ? '✅ Active' : '⏸️ Inactive'}
                </span>
              </div>
              {w.completedJobs > 0 && (
                <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 4 }}>
                  ⭐ Completed: {w.completedJobs} job{w.completedJobs !== 1 ? 's' : ''}
                </div>
              )}
              {w.isTopListed && (
                <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>
                  🏆 Top Listed Worker
                </div>
              )}
              {editingWorkerId === w.id ? (
                <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                  <input
                    placeholder="Certifications"
                    value={editWorkerData.certifications}
                    onChange={e => setEditWorkerData(prev => ({ ...prev, certifications: e.target.value }))}
                    style={{ padding: 6, fontSize: 12, minWidth: 260 }}
                  />
                  <input
                    placeholder="Bank Details"
                    value={editWorkerData.bankDetails}
                    onChange={e => setEditWorkerData(prev => ({ ...prev, bankDetails: e.target.value }))}
                    style={{ padding: 6, fontSize: 12, minWidth: 260 }}
                  />
                  <input
                    placeholder="Total Earnings"
                    value={editWorkerData.totalEarnings}
                    onChange={e => setEditWorkerData(prev => ({ ...prev, totalEarnings: e.target.value }))}
                    style={{ padding: 6, fontSize: 12, width: 140 }}
                  />
                </div>
              ) : (
                <div style={{ fontSize: 11, color: '#374151', marginTop: 6, lineHeight: 1.5 }}>
                  <div>Certifications: {w.certifications || 'N/A'}</div>
                  <div>Bank Details: {w.bankDetails || 'N/A'}</div>
                  <div>Total Earnings: Rs.{Number(w.totalEarnings || 0)}</div>
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <button 
                onClick={() => {
                  if (window.confirm(`${w.status === 'active' ? 'Disable' : 'Enable'} this worker?`)) {
                    toggleWorker(w.id, w.status);
                  }
                }}
                style={{ 
                  padding: '8px 12px',
                  background: w.status === 'active' ? '#ef4444' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 'bold',
                  transition: 'all 0.2s'
                }}>
                {w.status === 'active' ? '⏸️ Disable' : '▶️ Enable'}
              </button>
              <div style={{ marginTop: 8, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                {editingWorkerId === w.id ? (
                  <>
                    <button
                      onClick={() => saveWorkerSchema(w.id)}
                      style={{ padding: '6px 10px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingWorkerId(null);
                        setEditWorkerData({ certifications: '', bankDetails: '', totalEarnings: '0' });
                      }}
                      style={{ padding: '6px 10px', background: '#9ca3af', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => startEditWorker(w)}
                    style={{ padding: '6px 10px', background: '#0ea5e9', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}
                  >
                    Edit Details
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
