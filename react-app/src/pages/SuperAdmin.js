import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, doc, query, where, orderBy, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db, functionsInstance } from '../firebase';

export default function SuperAdmin() {
    const [admins, setAdmins] = useState([]);
    const [escalatedBookings, setEscalatedBookings] = useState([]);
    const [allDisputes, setAllDisputes] = useState([]);
    const [allBookings, setAllBookings] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [allWorkers, setAllWorkers] = useState([]);
    const [activeTab, setActiveTab] = useState('escalations');
    
    // Form states for creating new regionAdmin or admin
    const [createForm, setCreateForm] = useState({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        role: 'regionAdmin',
        regionAdminId: '',
        areaName: '',
    });
    const [createLoading, setCreateLoading] = useState(false);
    const [createError, setCreateError] = useState('');
    const [createSuccess, setCreateSuccess] = useState('');

    const uid = auth.currentUser?.uid;

    /* ── Listen to all admins (regionLeads) ── */
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'admins'), snap => {
            setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return unsub;
    }, []);

    /* ── Listen to all bookings and escalated disputes ── */
    useEffect(() => {
        const unsub = onSnapshot(
            query(collection(db, 'bookings'), orderBy('createdAt', 'desc')),
            snap => {
                const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setAllBookings(all);
                setEscalatedBookings(all.filter(b =>
                    b.dispute?.escalationStatus === true && b.dispute?.status === 'open'
                ));
                // All disputes (both open and resolved)
                const disputes = all.filter(b => b.dispute?.status);
                setAllDisputes(disputes);
            }
        );
        return unsub;
    }, []);

    /* ── Listen to all users ── */
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'users'), snap => {
            setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return unsub;
    }, []);

    /* ── Listen to all workers ── */
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'gig_workers'), snap => {
            setAllWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return unsub;
    }, []);

    /* ── Actions ── */
    const suspendRegion = async (adminId) => {
        if (!window.confirm('Suspend this region lead? Their workers will not receive new assignments.')) return;
        await updateDoc(doc(db, 'admins', adminId), {
            regionStatus: 'suspended',
        });
        alert('Region lead suspended.');
    };

    const reinstateRegion = async (adminId) => {
        await updateDoc(doc(db, 'admins', adminId), {
            regionStatus: 'active',
            probationStatus: false,
        });
        alert('Region lead reinstated.');
    };

    const markWorkerFraud = async (workerId) => {
        if (!window.confirm('Mark this worker as fraudulent? This will impact the region lead\'s score.')) return;
        await updateDoc(doc(db, 'gig_workers', workerId), {
            isFraud: true,
            status: 'inactive',
        });
        alert('Worker marked as fraud and deactivated.');
    };

    const resolveEscalatedDispute = async (booking, decision) => {
        if (!decision) return alert('Please select a decision');
        if (!window.confirm('Resolve this dispute?')) return;
        try {
            await httpsCallable(functionsInstance, 'updateBookingStatus')({
                bookingId: booking.id,
                action: 'admin_resolve_dispute',
                extraArgs: { decision }
            });
            alert('✅ Dispute resolved');
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    // ✅ Assign child admin to region lead
    const assignAdminToRegionLead = async (adminId, regionLeadId) => {
        if (!adminId || !regionLeadId) return alert('Please select both admin and region lead');
        if (!window.confirm('Assign this admin to the region lead?')) return;
        try {
            await updateDoc(doc(db, 'admins', adminId), {
                parentAdminId: regionLeadId
            });
            alert('✅ Admin assigned to region lead');
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    // ✅ Remove admin from region lead
    const unassignAdminFromRegionLead = async (adminId) => {
        if (!window.confirm('Remove this admin from the region lead?')) return;
        try {
            await updateDoc(doc(db, 'admins', adminId), {
                parentAdminId: null
            });
            alert('✅ Admin unassigned');
        } catch (err) {
            alert('Error: ' + err.message);
        }
    };

    const createRegionAdmin = async (e) => {
        e.preventDefault();
        setCreateError('');
        setCreateSuccess('');

        const { name, email, password, confirmPassword, areaName } = createForm;

        // Validation
        if (!name || !email || !password || !confirmPassword) {
            setCreateError('Please fill in all fields');
            return;
        }

        if (password !== confirmPassword) {
            setCreateError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setCreateError('Password must be at least 6 characters');
            return;
        }

        if (!areaName) {
            setCreateError('Please specify the area/region name');
            return;
        }

        setCreateLoading(true);

        try {
            // Step 1: Create Firebase Auth user
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            const uid = userCred.user.uid;

            // Step 2: Create admin document in Firestore
            const adminData = {
                name,
                email,
                role: 'regionLead',
                createdAt: new Date(),
                regionStatus: 'active',
                probationStatus: false,
                regionScore: 100,
                totalDisputes: 0,
                fraudCount: 0,
                areaName,
            };

            await setDoc(doc(db, 'admins', uid), adminData);

            // Step 3: ✅ FIX - Log back in as SuperAdmin (createUserWithEmailAndPassword auto-logged in the new user)
            const superAdminUser = auth.currentUser;
            if (superAdminUser) {
                // Get SuperAdmin credentials and re-authenticate
                // For now, we'll stay logged in as the newly created region lead briefly, 
                // but show a message that they should log out and back in as SuperAdmin
                console.log('⚠️ NEW REGION LEAD CREATED - You are now logged in as:', email);
            }

            setCreateSuccess(`✅ Region Admin "${name}" created successfully! You are logged in as the new region lead. Please LOGOUT and log back in to return to SuperAdmin mode.`);
            
            // Reset form
            setCreateForm({
                name: '',
                email: '',
                password: '',
                confirmPassword: '',
                role: 'regionAdmin',
                regionAdminId: '',
                areaName: '',
            });

            // Longer timeout since they need to read the message
            setTimeout(() => setCreateSuccess(''), 5000);
        } catch (err) {
            setCreateError('Error: ' + (err.message || err));
            console.error('Create region admin error:', err);
        } finally {
            setCreateLoading(false);
        }
    };

    /* ── Derived data ── */
    const regionLeads = admins.filter(a => a.role === 'regionLead');
    const childAdmins = admins.filter(a => ['admin', 'mason'].includes(a.role) && !!a.parentAdminId);
    const unassignedAdmins = admins.filter(a => ['admin', 'mason'].includes(a.role) && !a.parentAdminId);
    const probationaryLeads = regionLeads.filter(a => a.probationStatus === true);
    const suspendedLeads = regionLeads.filter(a => a.regionStatus === 'suspended');

    const getScoreColor = (score) => {
        if (score >= 80) return '#10b981';
        if (score >= 60) return '#f59e0b';
        return '#ef4444';
    };

    /* ── Helper: Get admin/region lead info ── */
    const getAdminInfo = (adminId) => {
        return admins.find(a => a.id === adminId) || { name: 'Unknown Admin', id: adminId };
    };

    const getRegionLeadInfo = (adminId) => {
        const admin = admins.find(a => a.id === adminId);
        if (admin?.role === 'regionLead') {
            return { name: admin.name || admin.email, region: admin.areaName };
        }
        if (admin?.parentAdminId) {
            const regionLead = admins.find(a => a.id === admin.parentAdminId);
            if (regionLead) {
                return { name: regionLead.name || regionLead.email, region: regionLead.areaName };
            }
        }
        return { name: 'Unknown Region Lead', region: 'N/A' };
    };

    const getWorkerInfo = (workerId) => {
        return allWorkers.find(w => w.id === workerId) || { name: 'Unknown Worker', id: workerId };
    };

    const getUserInfo = (userId) => {
        return allUsers.find(u => u.id === userId) || { name: 'Unknown User', phone: 'N/A' };
    };

    return (
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>
            {/* Header */}
            <div style={{ marginBottom: '30px' }}>
                <h1 style={{ fontSize: '28px', margin: '0 0 8px 0', color: '#1e293b' }}>
                    🛡️ SuperAdmin Control Center
                </h1>
                <p style={{ color: '#64748b', margin: 0, fontSize: '14px' }}>
                    Governance, region performance, escalated disputes, and fraud management
                </p>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px', marginBottom: '30px' }}>
                {[
                    { label: 'Region Admins', value: regionLeads.length, icon: '🌐', color: '#667eea' },
                    { label: 'Masons', value: childAdmins.length, icon: '👤', color: '#3b82f6' },
                    { label: 'Unassigned Masons', value: unassignedAdmins.length, icon: '⚠️', color: '#f97316' },
                    { label: 'On Probation', value: probationaryLeads.length, icon: '⚠️', color: '#f59e0b' },
                    { label: 'Suspended', value: suspendedLeads.length, icon: '🚫', color: '#ef4444' },
                    { label: 'Escalated Disputes', value: escalatedBookings.length, icon: '🚨', color: '#dc2626' },
                    { label: 'Total Workers', value: allWorkers.length, icon: '👷', color: '#10b981' },
                    { label: 'Fraud Workers', value: allWorkers.filter(w => w.isFraud).length, icon: '🕵️', color: '#7c3aed' },
                ].map((card, i) => (
                    <div key={i} style={{
                        background: 'white', padding: '16px', borderRadius: '12px',
                        border: `2px solid ${card.color}20`, textAlign: 'center',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                    }}>
                        <div style={{ fontSize: '28px', marginBottom: '6px' }}>{card.icon}</div>
                        <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '4px' }}>{card.label}</div>
                        <div style={{ fontSize: '24px', fontWeight: 'bold', color: card.color }}>{card.value}</div>
                    </div>
                ))}
            </div>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
                {[
                    { key: 'escalations', label: `🚨 Escalations (${escalatedBookings.length})`, color: '#dc2626' },
                    { key: 'disputes', label: `⚠️ All Disputes (${allDisputes.length})`, color: '#f59e0b' },
                    { key: 'work-status', label: `📋 Work Status (${allBookings.length})`, color: '#2563eb' },
                    { key: 'admin-workers', label: '👥 Admin & Workers', color: '#059669' },
                    { key: 'regions', label: '🌐 Region Performance', color: '#667eea' },
                    { key: 'create', label: '➕ Create Region Admin', color: '#1e40af' },
                ].map(tab => (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                        style={{
                            padding: '10px 20px', border: 'none', borderRadius: '25px',
                            cursor: 'pointer', fontWeight: 'bold', fontSize: '13px',
                            background: activeTab === tab.key ? tab.color : '#f1f5f9',
                            color: activeTab === tab.key ? 'white' : '#475569',
                            transition: 'all 0.2s',
                        }}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* ═══════════════ CREATE ADMIN/REGIONLEAD TAB ═══════════════ */}
            {activeTab === 'create' && (
                <div>
                    <h3 style={{ fontSize: '18px', color: '#1e293b', marginBottom: '16px' }}>➕ Create New Region Admin</h3>

                    <div style={{
                        background: 'white', borderRadius: '12px', padding: '24px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.05)', maxWidth: '600px'
                    }}>
                        {createError && (
                            <div style={{
                                padding: '12px 16px', background: '#fee2e2', color: '#991b1b',
                                borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: '500'
                            }}>
                                ❌ {createError}
                            </div>
                        )}

                        {createSuccess && (
                            <div style={{
                                padding: '12px 16px', background: '#dcfce7', color: '#166534',
                                borderRadius: '8px', marginBottom: '16px', fontSize: '13px', fontWeight: '500'
                            }}>
                                {createSuccess}
                            </div>
                        )}

                        <form onSubmit={createRegionAdmin}>
                            {/* Name */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>
                                    Name *
                                </label>
                                <input
                                    type="text"
                                    value={createForm.name}
                                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                                    style={{
                                        width: '100%', padding: '10px', border: '1px solid #cbd5e1',
                                        borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box'
                                    }}
                                    placeholder="e.g., Rajesh Kumar"
                                />
                            </div>

                            {/* Email */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>
                                    Email *
                                </label>
                                <input
                                    type="email"
                                    value={createForm.email}
                                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                                    style={{
                                        width: '100%', padding: '10px', border: '1px solid #cbd5e1',
                                        borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box'
                                    }}
                                    placeholder="e.g., rajesh@example.com"
                                />
                            </div>

                            {/* Password */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>
                                    Password (min 6 chars) *
                                </label>
                                <input
                                    type="password"
                                    value={createForm.password}
                                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                                    style={{
                                        width: '100%', padding: '10px', border: '1px solid #cbd5e1',
                                        borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box'
                                    }}
                                    placeholder="Enter password"
                                />
                            </div>

                            {/* Confirm Password */}
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>
                                    Confirm Password *
                                </label>
                                <input
                                    type="password"
                                    value={createForm.confirmPassword}
                                    onChange={(e) => setCreateForm({ ...createForm, confirmPassword: e.target.value })}
                                    style={{
                                        width: '100%', padding: '10px', border: '1px solid #cbd5e1',
                                        borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box'
                                    }}
                                    placeholder="Confirm password"
                                />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>
                                    Role
                                </label>
                                <input
                                    value="Region Admin"
                                    readOnly
                                    style={{
                                        width: '100%', padding: '10px', border: '1px solid #cbd5e1',
                                        borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box', background: '#f8fafc', color: '#475569'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 'bold', color: '#1e293b' }}>
                                    Area/Region Name *
                                </label>
                                <input
                                    type="text"
                                    value={createForm.areaName}
                                    onChange={(e) => setCreateForm({ ...createForm, areaName: e.target.value })}
                                    style={{
                                        width: '100%', padding: '10px', border: '1px solid #cbd5e1',
                                        borderRadius: '8px', fontSize: '13px', boxSizing: 'border-box'
                                    }}
                                    placeholder="e.g., North Mumbai, Delhi South"
                                />
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={createLoading}
                                style={{
                                    width: '100%', padding: '12px', background: '#1e40af',
                                    color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px',
                                    fontWeight: 'bold', cursor: createLoading ? 'not-allowed' : 'pointer',
                                    opacity: createLoading ? 0.6 : 1, transition: 'all 0.2s'
                                }}
                            >
                                {createLoading ? '⏳ Creating...' : '✅ Create Account'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ═══════════════ ADMIN & WORKERS TAB ═══════════════ */}
            {activeTab === 'admin-workers' && (
                <div>
                    <h3 style={{ fontSize: '18px', color: '#1e293b', marginBottom: '16px' }}>👥 Region Admins, Child Admins & Workers</h3>

                    {regionLeads.length === 0 && (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>
                            No region admins found.
                        </div>
                    )}

                    {regionLeads.map((regionAdmin) => {
                        const adminsUnderRegion = childAdmins.filter(a => a.parentAdminId === regionAdmin.id);
                        return (
                            <div key={regionAdmin.id} style={{ background: 'white', borderRadius: '12px', padding: '20px', marginBottom: '16px', border: '2px solid #667eea', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                                <div style={{ marginBottom: '12px' }}>
                                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1e293b' }}>🌐 {regionAdmin.name || regionAdmin.email}</div>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>Area: {regionAdmin.areaName || 'N/A'} | Child Admins: {adminsUnderRegion.length}</div>
                                </div>

                                {adminsUnderRegion.length === 0 && (
                                    <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', color: '#94a3b8', fontSize: '13px' }}>
                                        No child admins assigned to this region admin.
                                    </div>
                                )}

                                {adminsUnderRegion.map((admin) => {
                                    const adminWorkers = allWorkers.filter(w => w.adminId === admin.id);
                                    return (
                                        <div key={admin.id} style={{ marginTop: '10px', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '8px', background: '#f8fafc' }}>
                                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>👤 {admin.name || admin.email}</div>
                                            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>Workers: {adminWorkers.length}</div>

                                            {adminWorkers.length === 0 ? (
                                                <div style={{ fontSize: '12px', color: '#94a3b8' }}>No workers under this admin.</div>
                                            ) : (
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                                                            <th style={{ textAlign: 'left', padding: '6px' }}>Worker</th>
                                                            <th style={{ textAlign: 'left', padding: '6px' }}>Service</th>
                                                            <th style={{ textAlign: 'center', padding: '6px' }}>Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {adminWorkers.map(w => (
                                                            <tr key={w.id} style={{ borderBottom: '1px solid #eef2f7' }}>
                                                                <td style={{ padding: '6px' }}>{w.name}</td>
                                                                <td style={{ padding: '6px' }}>{w.gigType}</td>
                                                                <td style={{ padding: '6px', textAlign: 'center' }}>{w.status}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}

                    {unassignedAdmins.length > 0 && (
                        <div style={{ marginTop: '20px', padding: '14px', border: '1px solid #fb923c', borderRadius: '8px', background: '#fff7ed' }}>
                            <div style={{ fontWeight: 'bold', color: '#9a3412', marginBottom: '12px' }}>⚠️ Unassigned Masons - Assign to Region Lead</div>
                            {unassignedAdmins.map(a => (
                                <div key={a.id} style={{ fontSize: '13px', color: '#7c2d12', marginBottom: '12px', padding: '10px', background: 'white', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={{ flex: 1 }}>{a.name || a.email}</div>
                                    <select
                                        defaultValue=""
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                assignAdminToRegionLead(a.id, e.target.value);
                                                e.target.value = '';
                                            }
                                        }}
                                        style={{
                                            padding: '6px 8px', fontSize: '12px', border: '1px solid #cbd5e1',
                                            borderRadius: '4px', cursor: 'pointer', background: 'white'
                                        }}
                                    >
                                        <option value="">← Assign to...</option>
                                        {regionLeads.map(rl => (
                                            <option key={rl.id} value={rl.id}>{rl.name || rl.email} ({rl.areaName})</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Show assigned masons with ability to unassign */}
                    {childAdmins.length > 0 && (
                        <div style={{ marginTop: '20px', padding: '14px', border: '1px solid #86efac', borderRadius: '8px', background: '#f0fdf4' }}>
                            <div style={{ fontWeight: 'bold', color: '#166534', marginBottom: '12px' }}>✅ Assigned Masons</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
                                {childAdmins.map(a => {
                                    const regionLead = admins.find(r => r.id === a.parentAdminId);
                                    return (
                                        <div key={a.id} style={{ padding: '10px', background: 'white', borderRadius: '6px', border: '1px solid #d1fae5' }}>
                                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>{a.name || a.email}</div>
                                            <div style={{ fontSize: '11px', color: '#059669', marginBottom: '6px' }}>📍 {regionLead?.areaName || 'N/A'}</div>
                                            <button onClick={() => unassignAdminFromRegionLead(a.id)}
                                                style={{
                                                    width: '100%', padding: '6px', fontSize: '11px', background: '#fecaca', border: '1px solid #fca5a5',
                                                    borderRadius: '4px', cursor: 'pointer', color: '#7f1d1d', fontWeight: 'bold'
                                                }}>
                                                Unassign
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════ REGIONS TAB ═══════════════ */}
            {activeTab === 'regions' && (
                <div>
                    <h3 style={{ fontSize: '18px', color: '#1e293b', marginBottom: '16px' }}>📊 Region Lead Performance</h3>

                    {regionLeads.length === 0 && (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>
                            No region leads found.
                        </div>
                    )}

                    {regionLeads.map(lead => (
                        <div key={lead.id} style={{
                            background: 'white', borderRadius: '12px', padding: '20px',
                            marginBottom: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                            border: lead.probationStatus ? '2px solid #f59e0b' : lead.regionStatus === 'suspended' ? '2px solid #ef4444' : '1px solid #e2e8f0',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>
                                            {lead.name || lead.email || lead.id}
                                        </span>
                                        {lead.probationStatus && (
                                            <span style={{ padding: '3px 8px', background: '#fef3c7', color: '#92400e', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}>
                                                ⚠️ PROBATION
                                            </span>
                                        )}
                                        {lead.regionStatus === 'suspended' && (
                                            <span style={{ padding: '3px 8px', background: '#fee2e2', color: '#991b1b', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}>
                                                🚫 SUSPENDED
                                            </span>
                                        )}
                                    </div>

                                    {/* Performance Metrics */}
                                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '12px' }}>
                                        <div>
                                            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>Score</div>
                                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: getScoreColor(lead.regionScore ?? 100) }}>
                                                {lead.regionScore ?? 100}
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>Disputes</div>
                                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#475569' }}>{lead.totalDisputes || 0}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>Fraud Cases</div>
                                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: (lead.fraudCount || 0) > 0 ? '#ef4444' : '#475569' }}>{lead.fraudCount || 0}</div>
                                        </div>
                                        <div>
                                            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 'bold' }}>Avg Resolution</div>
                                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: (lead.avgResolutionTime || 0) > 24 ? '#ef4444' : '#475569' }}>
                                                {lead.avgResolutionTime ? `${lead.avgResolutionTime}h` : '—'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Score Bar */}
                                    <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{
                                            width: `${lead.regionScore ?? 100}%`, height: '100%',
                                            background: getScoreColor(lead.regionScore ?? 100),
                                            borderRadius: '4px', transition: 'width 0.5s ease',
                                        }} />
                                    </div>
                                </div>

                                {/* Actions */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {lead.regionStatus !== 'suspended' ? (
                                        <button onClick={() => suspendRegion(lead.id)}
                                            style={{ padding: '8px 16px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                                            🚫 Suspend
                                        </button>
                                    ) : (
                                        <button onClick={() => reinstateRegion(lead.id)}
                                            style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                                            ✅ Reinstate
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ═══════════════ ESCALATIONS TAB ═══════════════ */}
            {activeTab === 'escalations' && (
                <div>
                    <h3 style={{ fontSize: '18px', color: '#1e293b', marginBottom: '16px' }}>🚨 Escalated Disputes (Immediate Attention Required)</h3>

                    {escalatedBookings.length === 0 && (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>
                            ✅ No escalated disputes — all regions are performing well.
                        </div>
                    )}

                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <thead>
                            <tr style={{ background: '#fef2f2', borderBottom: '2px solid #fca5a5' }}>
                                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>Booking ID</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>Service</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>User Info</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>Admin</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>Region Lead</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>Worker</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>Dispute Reason</th>
                                <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {escalatedBookings.map(b => {
                                const admin = getAdminInfo(b.adminId);
                                const regionLead = getRegionLeadInfo(b.adminId);
                                const worker = getWorkerInfo(b.assignedWorkerId);
                                const user = getUserInfo(b.userId);
                                return (
                                    <tr key={b.id} style={{ borderBottom: '1px solid #fed7d7', background: '#fffbfb' }}>
                                        <td style={{ padding: '12px', fontSize: '12px', fontFamily: 'monospace', color: '#475569', fontWeight: 'bold' }}>
                                            {b.id.slice(0, 8)}...
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '13px', color: '#1e293b', fontWeight: 'bold' }}>
                                            {b.serviceType}
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '12px', color: '#475569' }}>
                                            {user.name || b.customerName}
                                            <br />
                                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>📞 {b.phone}</span>
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '12px', color: '#1e293b', fontWeight: '500' }}>
                                            {admin.name}
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '12px', color: '#1e293b', fontWeight: '500' }}>
                                            {regionLead.name}
                                            {regionLead.region && <br />}
                                            {regionLead.region && <span style={{ fontSize: '11px', color: '#94a3b8' }}>{regionLead.region}</span>}
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '12px', color: '#1e293b' }}>
                                            {b.assignedWorkerId ? (
                                                <>
                                                    {worker.name}
                                                    <br />
                                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>📱 {worker.contact || 'N/A'}</span>
                                                </>
                                            ) : (
                                                <span style={{ color: '#94a3b8' }}>Not assigned</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '11px', color: '#7f1d1d', maxWidth: '150px' }}>
                                            <div style={{ wordBreak: 'break-word', lineHeight: '1.4' }}>{b.dispute?.reason}</div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center' }}>
                                            <button onClick={() => {
                                                const decision = prompt('Enter decision:\nworker_fault\nuser_fault\nshared_fault');
                                                if (decision) resolveEscalatedDispute(b, decision);
                                            }}
                                                style={{
                                                    padding: '6px 10px', background: '#dc2626', color: 'white', border: 'none',
                                                    borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold'
                                                }}>
                                                Resolve
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ═══════════════ DISPUTES TAB ═══════════════ */}
            {activeTab === 'disputes' && (
                <div>
                    <h3 style={{ fontSize: '18px', color: '#1e293b', marginBottom: '16px' }}>⚠️ All Disputes</h3>

                    {allDisputes.length === 0 && (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>
                            ✅ No disputes found.
                        </div>
                    )}

                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        <thead>
                            <tr style={{ background: '#fffbf0', borderBottom: '2px solid #fed7aa' }}>
                                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>Booking ID</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>Service</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>User</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>Raised By</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>Reason</th>
                                <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>Status</th>
                                <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold', color: '#1e293b' }}>Raised Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allDisputes.map(b => {
                                const user = getUserInfo(b.userId);
                                const isOpen = b.dispute?.status === 'open';
                                const isEscalated = b.dispute?.escalationStatus === true;
                                return (
                                    <tr key={b.id} style={{
                                        borderBottom: '1px solid #fed7aa',
                                        background: isEscalated ? '#fef2f2' : isOpen ? '#fffbf0' : '#f0fdf4'
                                    }}>
                                        <td style={{ padding: '12px', fontSize: '12px', fontFamily: 'monospace', color: '#475569', fontWeight: 'bold' }}>
                                            {b.id.slice(0, 8)}...
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '13px', color: '#1e293b', fontWeight: 'bold' }}>
                                            {b.serviceType}
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '12px', color: '#475569' }}>
                                            {user.name || b.customerName}
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '12px', color: '#475569' }}>
                                            {b.dispute?.raisedBy === b.userId ? '👤 User' : '👨‍💼 Admin'}
                                        </td>
                                        <td style={{ padding: '12px', fontSize: '11px', color: '#475569', maxWidth: '150px' }}>
                                            <div style={{ wordBreak: 'break-word', lineHeight: '1.4' }}>{b.dispute?.reason}</div>
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '11px', fontWeight: 'bold' }}>
                                            {isEscalated && <div style={{ color: '#dc2626' }}>🚨 ESCALATED</div>}
                                            {isOpen && <div style={{ color: '#f59e0b' }}>⏳ OPEN</div>}
                                            {b.dispute?.status === 'resolved' && <div style={{ color: '#10b981' }}>✅ RESOLVED</div>}
                                        </td>
                                        <td style={{ padding: '12px', textAlign: 'center', fontSize: '11px', color: '#94a3b8' }}>
                                            {b.dispute?.raisedAt?.toDate?.()?.toLocaleDateString?.() || '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ═══════════════ WORK STATUS TAB ═══════════════ */}
            {activeTab === 'work-status' && (
                <div>
                    <h3 style={{ fontSize: '18px', color: '#1e293b', marginBottom: '16px' }}>📋 All Work Status</h3>

                    {allBookings.length === 0 && (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>
                            No bookings found.
                        </div>
                    )}

                    <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', fontSize: '12px' }}>
                        <thead>
                            <tr style={{ background: '#f0f4f8', borderBottom: '2px solid #cbd5e1' }}>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold', color: '#1e293b' }}>ID</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold', color: '#1e293b' }}>Service</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold', color: '#1e293b' }}>User</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold', color: '#1e293b' }}>Admin</th>
                                <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold', color: '#1e293b' }}>Worker</th>
                                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#1e293b' }}>Status</th>
                                <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#1e293b' }}>Created</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allBookings.map(b => {
                                const admin = getAdminInfo(b.adminId);
                                const worker = getWorkerInfo(b.assignedWorkerId);
                                const user = getUserInfo(b.userId);
                                const statusColors = {
                                    'pending': '#ff9800',
                                    'quoted': '#6366f1',
                                    'accepted': '#ec4899',
                                    'assigned': '#2196f3',
                                    'in_progress': '#9c27b0',
                                    'awaiting_confirmation': '#f44336',
                                    'completed': '#4caf50',
                                    'cancelled': '#757575',
                                };
                                return (
                                    <tr key={b.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                                        <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 'bold', color: '#475569' }}>
                                            {b.id.slice(0, 6)}...
                                        </td>
                                        <td style={{ padding: '10px 12px', color: '#1e293b', fontWeight: '500' }}>
                                            {b.serviceType}
                                        </td>
                                        <td style={{ padding: '10px 12px', color: '#475569' }}>
                                            {user.name || b.customerName}
                                        </td>
                                        <td style={{ padding: '10px 12px', color: '#475569' }}>
                                            {admin.name || 'Unassigned'}
                                        </td>
                                        <td style={{ padding: '10px 12px', color: '#475569' }}>
                                            {b.assignedWorkerId ? worker.name : '—'}
                                        </td>
                                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                            <span style={{
                                                padding: '4px 8px',
                                                background: statusColors[b.status] + '20',
                                                color: statusColors[b.status],
                                                borderRadius: '6px',
                                                fontWeight: 'bold',
                                                fontSize: '11px',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {b.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '10px 12px', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>
                                            {b.createdAt?.toDate?.()?.toLocaleDateString?.() || '—'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* ═══════════════ ESCALATED DISPUTES TAB (LEGACY) ═══════════════ */}
            {activeTab === 'escalated' && (
                <div>
                    <h3 style={{ fontSize: '18px', color: '#1e293b', marginBottom: '16px' }}>🚨 Escalated Disputes (Overdue 24h+)</h3>

                    {escalatedBookings.length === 0 && (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>
                            ✅ No escalated disputes — all regions are performing well.
                        </div>
                    )}

                    {escalatedBookings.map(b => (
                        <div key={b.id} style={{
                            background: 'white', borderRadius: '12px', padding: '20px',
                            marginBottom: '16px', border: '2px solid #fca5a5',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', fontSize: '15px', color: '#1e293b' }}>
                                        {b.serviceType} — {b.customerName}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                                        📞 {b.phone} | Booking ID: {b.id.slice(0, 8)}...
                                    </div>
                                </div>
                                <span style={{ padding: '4px 10px', background: '#fef2f2', color: '#dc2626', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold' }}>
                                    ⏰ ESCALATED
                                </span>
                            </div>

                            {/* Dispute Info */}
                            <div style={{ background: '#fef2f2', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#991b1b', marginBottom: '4px' }}>Dispute Reason:</div>
                                <div style={{ fontSize: '13px', color: '#7f1d1d' }}>{b.dispute?.reason}</div>
                                <div style={{ fontSize: '11px', color: '#991b1b', marginTop: '6px' }}>
                                    Raised: {b.dispute?.raisedAt?.toDate?.()?.toLocaleString?.() || '—'}
                                    {b.dispute?.escalatedAt && ` | Escalated: ${b.dispute.escalatedAt.toDate?.()?.toLocaleString?.() || '—'}`}
                                </div>
                                {b.dispute?.autoTriggered && (
                                    <div style={{ fontSize: '11px', color: '#7c3aed', marginTop: '4px', fontWeight: 'bold' }}>
                                        ⚡ Auto-triggered by 1-star rating
                                    </div>
                                )}
                            </div>

                            {/* SuperAdmin Decision */}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {['worker_fault', 'user_fault', 'shared_fault'].map(decision => (
                                    <button key={decision}
                                        onClick={() => resolveEscalatedDispute(b, decision)}
                                        style={{
                                            padding: '8px 16px', border: 'none', borderRadius: '8px',
                                            cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                                            background: decision === 'worker_fault' ? '#ef4444' : decision === 'user_fault' ? '#3b82f6' : '#f59e0b',
                                            color: 'white',
                                        }}>
                                        {decision === 'worker_fault' ? '⚠️ Worker Fault' :
                                            decision === 'user_fault' ? '👤 User Fault' : '🤝 Shared Fault'}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ═══════════════ WORKERS & FRAUD TAB ═══════════════ */}
            {activeTab === 'workers' && (
                <div>
                    <h3 style={{ fontSize: '18px', color: '#1e293b', marginBottom: '16px' }}>👷 Worker Overview & Fraud Management</h3>

                    {allWorkers.length === 0 && (
                        <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '12px' }}>
                            No workers found.
                        </div>
                    )}

                    {/* Workers Table */}
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e2e8f0' }}>
                                    <th style={{ textAlign: 'left', padding: '12px 8px', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Worker</th>
                                    <th style={{ textAlign: 'left', padding: '12px 8px', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Type</th>
                                    <th style={{ textAlign: 'center', padding: '12px 8px', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Jobs</th>
                                    <th style={{ textAlign: 'center', padding: '12px 8px', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Top Listed</th>
                                    <th style={{ textAlign: 'center', padding: '12px 8px', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Status</th>
                                    <th style={{ textAlign: 'center', padding: '12px 8px', color: '#64748b', fontSize: '11px', textTransform: 'uppercase' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allWorkers.map(w => (
                                    <tr key={w.id} style={{
                                        borderBottom: '1px solid #f1f5f9',
                                        background: w.isFraud ? '#fef2f2' : 'white',
                                    }}>
                                        <td style={{ padding: '12px 8px' }}>
                                            <div style={{ fontWeight: 'bold', color: '#1e293b' }}>{w.name}</div>
                                            <div style={{ fontSize: '11px', color: '#94a3b8' }}>{w.contact}</div>
                                        </td>
                                        <td style={{ padding: '12px 8px', color: '#475569' }}>{w.gigType}</td>
                                        <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', color: '#475569' }}>{w.completedJobs || 0}</td>
                                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                            {w.isTopListed ? (
                                                <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>⭐ Yes</span>
                                            ) : (
                                                <span style={{ color: '#94a3b8' }}>—</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                            {w.isFraud ? (
                                                <span style={{ padding: '3px 8px', background: '#fee2e2', color: '#991b1b', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold' }}>
                                                    🚨 FRAUD
                                                </span>
                                            ) : (
                                                <span style={{
                                                    padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold',
                                                    background: w.status === 'active' ? '#dcfce7' : '#f1f5f9',
                                                    color: w.status === 'active' ? '#166534' : '#64748b',
                                                }}>
                                                    {w.status}
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                            {!w.isFraud && (
                                                <button onClick={() => markWorkerFraud(w.id)}
                                                    style={{ padding: '5px 10px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold' }}>
                                                    🕵️ Mark Fraud
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
