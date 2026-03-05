import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, where, getDoc, setDoc, getDocs } from 'firebase/firestore';

export default function Workers() {
  const [user, setUser] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [pendingWorkers, setPendingWorkers] = useState([]);
  const [adminRole, setAdminRole] = useState('admin');
  const [regionArea, setRegionArea] = useState('');
  const [childAdminIds, setChildAdminIds] = useState([]);
  const [childAdmins, setChildAdmins] = useState([]);
  const [approvalAssignments, setApprovalAssignments] = useState({});
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [gigType, setGigType] = useState('Plumber');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

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
    if (user && adminRole !== 'regionLead') {
      migrateWorkersWithoutAdminId();
    }
  }, [user, adminRole]);

  useEffect(() => {
    if (!user) return;
    
    const unsub = onSnapshot(
      query(collection(db, 'gig_workers')),
      (snap) => {
        const allWorkers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Separate pending and approved workers
        // Workers without approvalStatus field are treated as approved (created by admin directly)
        const pending = allWorkers.filter(w => w.approvalStatus === 'pending');
        const approved = allWorkers.filter(w => {
          return !w.approvalStatus || w.approvalStatus === 'approved' || w.approvalStatus !== 'pending';
        });

        if (adminRole === 'superadmin') {
          setWorkers(approved);
          setPendingWorkers(pending);
          return;
        }

        if (adminRole === 'regionLead') {
          // Region leads monitor workers owned by admins under their region
          const regionWorkers = approved.filter(w => childAdminIds.includes(w.adminId));
          setWorkers(regionWorkers);
          
          // Region leads see pending workers for their own area.
          const regionPending = pending.filter(w =>
            (w.area || '').trim().toLowerCase() === (regionArea || '').trim().toLowerCase()
          );
          setPendingWorkers(regionPending);
          return;
        }

        // Admin/Mason: only workers owned by themselves
        // Include workers with no approvalStatus (directly created) OR explicitly approved
        // For backwards compatibility: include workers with no adminId (old workers) OR matching adminId
        const myWorkers = approved.filter(w => {
          return !w.adminId || w.adminId === user.uid;
        });
        setWorkers(myWorkers);
        setPendingWorkers([]);
      },
      err => console.error(err)
    );
    return () => unsub();
  }, [user, adminRole, childAdminIds, regionArea]);

  async function createWorker() {
    if (!user) return alert('Not authenticated');
    if (adminRole !== 'admin' && adminRole !== 'superadmin') return alert('Only admins can create workers');
    if (adminRole === 'regionLead') return alert('Region leads cannot create workers.');
    if (!name.trim()) return alert('Worker name is required');
    if (!/^[0-9]{10}$/.test(contact)) return alert('Enter valid 10 digit phone');
    try {
      await addDoc(collection(db, 'gig_workers'), {
        name, 
        contact, 
        gigType, 
        status: 'active', 
        adminId: user.uid, 
        approvalStatus: 'approved',  // ✅ Explicitly mark as approved when admin creates
        createdAt: new Date(),
        approvedAt: new Date()
      });
      setName(''); 
      setContact('');
      alert('✅ Worker created successfully!');
    } catch (e) { 
      console.error(e); 
      alert('Error: ' + e.message); 
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
    } catch (e) { 
      console.error(e); 
      alert(e.message); 
    }
  }

  // ✅ Migration: Automatically set adminId on existing workers without it
  async function migrateWorkersWithoutAdminId() {
    if (!user || adminRole === 'regionLead') return;
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
    if (!targetAdminId) return alert('Please select an admin before approval.');
    try {
      await updateDoc(doc(db, 'gig_workers', workerId), {
        approvalStatus: 'approved',
        adminId: targetAdminId,
        status: 'active',
        approvedAt: new Date(),
        approvedByRegionLeadId: user.uid,
      });
      alert('✅ Worker approved successfully!');
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
      alert('Worker application rejected.');
    } catch (e) {
      console.error(e);
      alert('Error rejecting worker: ' + e.message);
    }
  }

  async function createChildAdmin() {
    if (adminRole !== 'regionLead') return alert('Only region admins can create child admins.');
    if (!newAdminName || !newAdminEmail || !newAdminPassword) return alert('Fill all child admin fields.');
    if (newAdminPassword.length < 6) return alert('Password must be at least 6 characters.');

    try {
      const cred = await createUserWithEmailAndPassword(auth, newAdminEmail, newAdminPassword);
      const newUid = cred.user.uid;
      await setDoc(doc(db, 'admins', newUid), {
        name: newAdminName,
        email: newAdminEmail,
        role: 'admin',
        parentAdminId: user.uid,
        areaName: regionArea || '',
        createdAt: new Date(),
      });
      alert('✅ Child admin created successfully.');
      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminPassword('');
    } catch (e) {
      console.error(e);
      alert('Error creating child admin: ' + e.message);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Workers</h2>
      {adminRole === 'regionLead' && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', padding: 10, borderRadius: 8, marginBottom: 12 }}>
          Region Admin Mode: approve worker registrations in your area and assign each approved worker to a child admin.
        </div>
      )}

      {adminRole === 'regionLead' && (
        <div style={{ background: '#fff', padding: 12, borderRadius: 8, marginBottom: 12, border: '1px solid #dbeafe' }}>
          <h4>Create Child Admin</h4>
          <input placeholder="Admin Name" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} style={{ padding: 8, marginRight: 8 }} />
          <input placeholder="Admin Email" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} style={{ padding: 8, marginRight: 8 }} />
          <input placeholder="Password" type="password" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} style={{ padding: 8, marginRight: 8 }} />
          <button onClick={createChildAdmin} style={{ padding: 8, background: '#2563eb', color: 'white', border: 'none', borderRadius: 4 }}>
            Create Admin
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
        <button onClick={createWorker} disabled={adminRole === 'regionLead'} style={{ padding: 8, opacity: adminRole === 'regionLead' ? 0.6 : 1 }}>
          Create
        </button>
      </div>

      {/* PENDING WORKER APPROVALS - For Region Leads */}
      {adminRole === 'regionLead' && pendingWorkers.length > 0 && (
        <div style={{ background: '#fef3c7', padding: 16, borderRadius: 8, marginBottom: 16, border: '2px solid #fcd34d' }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#92400e' }}>⏳ Pending Worker Approvals ({pendingWorkers.length})</h4>
          {childAdmins.length === 0 && (
            <div style={{ marginBottom: 10, padding: 8, background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', borderRadius: 6, fontSize: 12 }}>
              Create at least one child admin under this region admin before approving workers.
            </div>
          )}
          {pendingWorkers.map(w => (
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
                    <option value="">Assign to child admin...</option>
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
                    if (window.confirm('Reject this worker application?')) {
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
        <h4>All Workers ({workers.length})</h4>
        
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
              Create your first worker using the form above. Your workers will appear here once created.
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
