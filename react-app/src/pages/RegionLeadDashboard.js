import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';

export default function RegionLeadDashboard() {
  const navigate = useNavigate();
  const [regionLeadData, setRegionLeadData] = useState(null);
  const [childAdmins, setChildAdmins] = useState([]);
  const [pendingGigs, setPendingGigs] = useState([]);
  const [allGigs, setAllGigs] = useState([]);
  const [activeBookings, setActiveBookings] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [stats, setStats] = useState({
    totalMasons: 0,
    totalGigs: 0,
    pendingApprovals: 0,
    activeBookings: 0,
    openDisputes: 0,
    regionScore: 100,
  });
  
  // Form states
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [approvalAssignments, setApprovalAssignments] = useState({});
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  const uid = auth.currentUser?.uid;

  // Load region lead data
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'admins', uid), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.role !== 'regionLead') {
          navigate('/admin');
          return;
        }
        setRegionLeadData(data);
        setStats(prev => ({
          ...prev,
          regionScore: data.regionScore || 100,
        }));
      }
      setLoading(false);
    });
    return unsub;
  }, [uid, navigate]);

  // Load child admins
  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(
      query(collection(db, 'admins'), where('parentAdminId', '==', uid)),
      (snap) => {
        const admins = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setChildAdmins(admins);
        setStats(prev => ({ ...prev, totalMasons: admins.length }));
      }
    );
    return unsub;
  }, [uid]);

  // Load gigs (both pending and approved)
  useEffect(() => {
    if (!uid || !regionLeadData?.areaName) return;
    const unsub = onSnapshot(
      query(collection(db, 'gig_workers')),
      (snap) => {
        const allW = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        
        // Pending gigs in this region
        const pending = allW.filter(w =>
          w.approvalStatus === 'pending' &&
          (w.area || '').trim().toLowerCase() === (regionLeadData.areaName || '').trim().toLowerCase()
        );
        setPendingGigs(pending);
        
        // Approved gigs under child admins
        const childAdminIds = childAdmins.map(a => a.id);
        const approved = allW.filter(w =>
          childAdminIds.includes(w.adminId) &&
          (!w.approvalStatus || w.approvalStatus === 'approved')
        );
        setAllGigs(approved);
        
        setStats(prev => ({
          ...prev,
          pendingApprovals: pending.length,
          totalGigs: approved.length,
        }));
      }
    );
    return unsub;
  }, [uid, regionLeadData, childAdmins]);

  // Load bookings and disputes
  useEffect(() => {
    if (!uid || childAdmins.length === 0) return;
    
    const childAdminIds = childAdmins.map(a => a.id);
    const unsubscribers = [];
    
    // Use state to properly track bookings from multiple sources
    const bookingsByAdmin = {};
    
    console.log('🔍 RegionLead loading bookings for masons:', childAdminIds);
    
    childAdminIds.forEach(adminId => {
      const unsub = onSnapshot(
        query(collection(db, 'bookings'), where('adminId', '==', adminId)),
        (snap) => {
          const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          
          console.log(`📦 Loaded ${bookings.length} bookings for mason ${adminId}`);
          
          // Store bookings for this admin
          bookingsByAdmin[adminId] = bookings;
          
          // Combine all bookings from all admins
          const allBookings = Object.values(bookingsByAdmin).flat();
          
          console.log(`📊 Total combined bookings: ${allBookings.length}`);
          
          const active = allBookings.filter(b =>
            ['pending', 'scheduled', 'quoted', 'accepted', 'assigned', 'in_progress', 'awaiting_confirmation'].includes(b.status)
          );
          
          const openDisputes = allBookings.filter(b => b.dispute?.status === 'open');
          
          console.log(`✅ Active bookings: ${active.length}, Open disputes: ${openDisputes.length}`);
          
          setActiveBookings(active);
          setDisputes(openDisputes);
          setStats(prev => ({
            ...prev,
            activeBookings: active.length,
            openDisputes: openDisputes.length,
          }));
        },
        (error) => {
          console.error(`❌ Error loading bookings for mason ${adminId}:`, error.message);
          console.error('Error code:', error.code);
          console.error('Full error:', error);
        }
      );
      unsubscribers.push(unsub);
    });
    
    return () => unsubscribers.forEach(fn => fn());
  }, [uid, childAdmins]);

  const createChildAdmin = async () => {
    if (!newAdminName || !newAdminEmail || !newAdminPassword) {
      alert('Please fill in all fields');
      return;
    }
    if (newAdminPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, newAdminEmail, newAdminPassword);
      const newUid = cred.user.uid;
      
      await setDoc(doc(db, 'admins', newUid), {
        name: newAdminName,
        email: newAdminEmail,
        role: 'mason',
        parentAdminId: uid,
        areaName: regionLeadData?.areaName || '',
        regionStatus: 'active',
        createdAt: new Date(),
      });
      
      alert('✅ Mason created successfully!');
      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminPassword('');
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const approveWorker = async (workerId) => {
    const targetAdminId = approvalAssignments[workerId];
    if (!targetAdminId) {
      alert('Please select a mason to assign this gig to');
      return;
    }

    try {
      await updateDoc(doc(db, 'gig_workers', workerId), {
        approvalStatus: 'approved',
        adminId: targetAdminId,
        status: 'active',
        approvedAt: new Date(),
        approvedByRegionLeadId: uid,
      });
      alert('✅ Gig approved!');
      setApprovalAssignments(prev => {
        const updated = { ...prev };
        delete updated[workerId];
        return updated;
      });
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const rejectWorker = async (workerId) => {
    if (!window.confirm('Reject this gig application?')) return;
    
    try {
      await updateDoc(doc(db, 'gig_workers', workerId), {
        approvalStatus: 'rejected',
        status: 'inactive',
        rejectedAt: new Date(),
      });
      alert('Gig application rejected');
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  if (!regionLeadData || regionLeadData.role !== 'regionLead') {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Access Denied</div>;
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '28px', marginBottom: '8px', color: '#111' }}>
          🌐 Region Lead Dashboard
        </h1>
        <p style={{ color: '#666', fontSize: '14px' }}>
          {regionLeadData.name || regionLeadData.email} • Area: {regionLeadData.areaName || 'Not Set'}
        </p>
      </div>

      {/* Region Score Alert */}
      {stats.regionScore < 80 && (
        <div style={{
          background: '#fef2f2',
          border: '2px solid #fca5a5',
          borderRadius: '8px',
          padding: '12px',
          marginBottom: '20px',
          color: '#991b1b',
          fontWeight: 'bold'
        }}>
          ⚠️ Region Score: {stats.regionScore}/100 - Below threshold! Check performance metrics.
        </div>
      )}

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '12px', border: '2px solid #3b82f6' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e40af' }}>{stats.totalMasons}</div>
          <div style={{ fontSize: '13px', color: '#1e40af', marginTop: '4px' }}>Masons</div>
        </div>
        <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '12px', border: '2px solid #10b981' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#065f46' }}>{stats.totalGigs}</div>
          <div style={{ fontSize: '13px', color: '#065f46', marginTop: '4px' }}>Active Gigs</div>
        </div>
        <div style={{ background: '#fef3c7', padding: '16px', borderRadius: '12px', border: '2px solid #f59e0b' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#92400e' }}>{stats.pendingApprovals}</div>
          <div style={{ fontSize: '13px', color: '#92400e', marginTop: '4px' }}>Pending Approvals</div>
        </div>
        <div style={{ background: '#fce7f3', padding: '16px', borderRadius: '12px', border: '2px solid #ec4899' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9f1239' }}>{stats.activeBookings}</div>
          <div style={{ fontSize: '13px', color: '#9f1239', marginTop: '4px' }}>Active Bookings</div>
        </div>
        <div style={{ background: '#fef2f2', padding: '16px', borderRadius: '12px', border: '2px solid #ef4444' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#991b1b' }}>{stats.openDisputes}</div>
          <div style={{ fontSize: '13px', color: '#991b1b', marginTop: '4px' }}>Open Disputes</div>
        </div>
        <div style={{ background: '#f5f3ff', padding: '16px', borderRadius: '12px', border: '2px solid #8b5cf6' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#5b21b6' }}>{stats.regionScore}</div>
          <div style={{ fontSize: '13px', color: '#5b21b6', marginTop: '4px' }}>Region Score</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '2px solid #e5e7eb', paddingBottom: '8px' }}>
        {[
          { key: 'overview', label: 'Overview', icon: '📊' },
          { key: 'gigs', label: `Gig Approvals (${stats.pendingApprovals})`, icon: '⏳' },
          { key: 'admins', label: 'Manage Masons', icon: '👷' },
          { key: 'disputes', label: `Disputes (${stats.openDisputes})`, icon: '🚨' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '10px 16px',
              background: activeTab === tab.key ? '#3b82f6' : 'transparent',
              color: activeTab === tab.key ? 'white' : '#666',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: activeTab === tab.key ? 'bold' : 'normal',
              fontSize: '14px'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          <h3 style={{ marginBottom: '16px' }}>Quick Actions</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <button
              onClick={() => navigate('/admin/bookings')}
              style={{
                padding: '16px',
                background: '#f0f9ff',
                border: '2px solid #3b82f6',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '14px'
              }}
            >
              <div style={{ fontWeight: 'bold', color: '#1e40af', marginBottom: '4px' }}>
                📋 View All Bookings
              </div>
              <div style={{ color: '#64748b', fontSize: '12px' }}>
                Monitor bookings from all child admins
              </div>
            </button>
            
            <button
              onClick={() => navigate('/admin/workers')}
              style={{
                padding: '16px',
                background: '#f0fdf4',
                border: '2px solid #10b981',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '14px'
              }}
            >
              <div style={{ fontWeight: 'bold', color: '#065f46', marginBottom: '4px' }}>
                👷 Manage Gigs
              </div>
              <div style={{ color: '#64748b', fontSize: '12px' }}>
                View all gigs and their performance
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('gigs')}
              style={{
                padding: '16px',
                background: '#fef3c7',
                border: '2px solid #f59e0b',
                borderRadius: '8px',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: '14px'
              }}
            >
              <div style={{ fontWeight: 'bold', color: '#92400e', marginBottom: '4px' }}>
                ⏳ Approve Gigs ({stats.pendingApprovals})
              </div>
              <div style={{ color: '#64748b', fontSize: '12px' }}>
                Review and approve gig registrations
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Gig Approvals Tab */}
      {activeTab === 'gigs' && (
        <div>
          <h3 style={{ marginBottom: '16px' }}>Pending Gig Approvals</h3>
          
          {childAdmins.length === 0 && (
            <div style={{
              background: '#fff7ed',
              border: '1px solid #fdba74',
              color: '#9a3412',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px'
            }}>
              ⚠️ Create at least one mason before approving gigs.
            </div>
          )}
          
          {pendingGigs.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
              No pending gig approvals
            </div>
          ) : (
            pendingGigs.map(worker => (
              <div key={worker.id} style={{
                background: 'white',
                border: '2px solid #fcd34d',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#111' }}>
                      {worker.name}
                    </h4>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                      📞 {worker.contact} | 📧 {worker.email}
                    </div>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
                      🔧 {worker.gigType} | 📍 {worker.area}
                    </div>
                    
                    <select
                      value={approvalAssignments[worker.id] || ''}
                      onChange={(e) => setApprovalAssignments(prev => ({ ...prev, [worker.id]: e.target.value }))}
                      style={{
                        padding: '8px',
                        borderRadius: '6px',
                        border: '1px solid #d1d5db',
                        fontSize: '13px',
                        minWidth: '240px'
                      }}
                    >
                      <option value="">Select mason to assign...</option>
                      {childAdmins.map(admin => (
                        <option key={admin.id} value={admin.id}>
                          {admin.name || admin.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px', marginLeft: '16px' }}>
                    <button
                      onClick={() => approveWorker(worker.id)}
                      disabled={!approvalAssignments[worker.id] || childAdmins.length === 0}
                      style={{
                        padding: '8px 16px',
                        background: '#10b981',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        opacity: (!approvalAssignments[worker.id] || childAdmins.length === 0) ? 0.5 : 1
                      }}
                    >
                      ✅ Approve
                    </button>
                    <button
                      onClick={() => rejectWorker(worker.id)}
                      style={{
                        padding: '8px 16px',
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 'bold'
                      }}
                    >
                      ❌ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Admins Tab */}
      {activeTab === 'admins' && (
        <div>
          <h3 style={{ marginBottom: '16px' }}>Create Mason</h3>
          
          <div style={{
            background: 'white',
            border: '2px solid #3b82f6',
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
              <input
                type="text"
                placeholder="Mason Name"
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px'
                }}
              />
              <input
                type="email"
                placeholder="Mason Email"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px'
                }}
              />
              <input
                type="password"
                placeholder="Password (min 6 characters)"
                value={newAdminPassword}
                onChange={(e) => setNewAdminPassword(e.target.value)}
                style={{
                  padding: '12px',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  fontSize: '14px'
                }}
              />
            </div>
            
            <button
              onClick={createChildAdmin}
              style={{
                padding: '12px 24px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                width: '100%'
              }}
            >
              Create Mason
            </button>
          </div>

          <h3 style={{ marginBottom: '16px' }}>Masons ({childAdmins.length})</h3>
          
          {childAdmins.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
              No masons created yet
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {childAdmins.map(admin => (
                <div key={admin.id} style={{
                  background: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#111', marginBottom: '4px' }}>
                      {admin.name || 'Unnamed Mason'}
                    </div>
                    <div style={{ fontSize: '13px', color: '#666' }}>
                      📧 {admin.email} | 📍 {admin.areaName || 'No area'}
                    </div>
                  </div>
                  <div style={{
                    padding: '4px 12px',
                    background: admin.regionStatus === 'active' ? '#d1fae5' : '#fee2e2',
                    color: admin.regionStatus === 'active' ? '#065f46' : '#991b1b',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {admin.regionStatus || 'active'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Disputes Tab */}
      {activeTab === 'disputes' && (
        <div>
          <h3 style={{ marginBottom: '16px' }}>Open Disputes</h3>
          
          {/* Debug Info */}
          <div style={{
            background: '#fef3c7',
            border: '1px solid #f59e0b',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '12px'
          }}>
            <div><strong>Debug Info:</strong></div>
            <div>↳ Masons under you: {childAdmins.length} ({childAdmins.map(a => a.name).join(', ') || 'none'})</div>
            <div>↳ Total active bookings loaded: {activeBookings.length}</div>
            <div>↳ Bookings with disputes: {activeBookings.filter(b => b.dispute).length}</div>
            <div>↳ Open disputes: {disputes.length}</div>
            <div>↳ Mason IDs: {childAdmins.map(a => a.id.slice(-6)).join(', ')}</div>
            {childAdmins.map(a => (
              <div key={a.id}>↳ {a.name}: parentAdminId = {a.parentAdminId ? a.parentAdminId.slice(-6) + (a.parentAdminId === uid ? ' ✅' : ' ❌') : 'MISSING'}</div>
            ))}
          </div>
          
          {disputes.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
              No open disputes
            </div>
          ) : (
            <div>
              {disputes.map(booking => (
                <div key={booking.id} style={{
                  background: '#fef2f2',
                  border: '2px solid #ef4444',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '12px'
                }}>
                  <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '8px', color: '#991b1b' }}>
                    🚨 Booking #{booking.id.slice(-6)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>
                    Customer: {booking.customerName} | Service: {booking.serviceType}
                  </div>
                  <div style={{ fontSize: '13px', color: '#666', marginBottom: '8px' }}>
                    Dispute Reason: {booking.dispute?.reason || 'No reason provided'}
                  </div>
                  <button
                    onClick={() => navigate('/admin/bookings')}
                    style={{
                      padding: '8px 16px',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 'bold'
                    }}
                  >
                    Handle Dispute →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
