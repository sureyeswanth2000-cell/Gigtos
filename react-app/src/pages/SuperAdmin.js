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
    
    // ── Filter states ──
    const [filterSearch, setFilterSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [filterRegion, setFilterRegion] = useState('all');
    
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
        await updateDoc(doc(db, 'admins', adminId), { regionStatus: 'suspended' });
        alert('Region lead suspended.');
    };

    const reinstateRegion = async (adminId) => {
        await updateDoc(doc(db, 'admins', adminId), { regionStatus: 'active', probationStatus: false });
        alert('Region lead reinstated.');
    };

    const markWorkerFraud = async (workerId) => {
        if (!window.confirm('Mark this worker as fraudulent?')) return;
        await updateDoc(doc(db, 'gig_workers', workerId), { isFraud: true, status: 'inactive' });
        alert('Worker marked as fraud.');
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
        } catch (err) { alert('Error: ' + err.message); }
    };

    const assignAdminToRegionLead = async (adminId, regionLeadId) => {
        if (!adminId || !regionLeadId) return alert('Please select both admin and region lead');
        try {
            await updateDoc(doc(db, 'admins', adminId), { parentAdminId: regionLeadId });
            alert('✅ Admin assigned');
        } catch (err) { alert('Error: ' + err.message); }
    };

    const unassignAdminFromRegionLead = async (adminId) => {
        if (!window.confirm('Remove this admin from the region lead?')) return;
        try {
            await updateDoc(doc(db, 'admins', adminId), { parentAdminId: null });
            alert('✅ Admin unassigned');
        } catch (err) { alert('Error: ' + err.message); }
    };

    const createRegionAdmin = async (e) => {
        e.preventDefault();
        setCreateError(''); setCreateSuccess('');
        const { name, email, password, confirmPassword, areaName } = createForm;
        if (!name || !email || !password || !areaName) return setCreateError('Fill all fields');
        if (password !== confirmPassword) return setCreateError('Passwords mismatch');
        
        setCreateLoading(true);
        try {
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, 'admins', userCred.user.uid), {
                name, email, role: 'regionLead', createdAt: new Date(),
                regionStatus: 'active', probationStatus: false, regionScore: 100,
                totalDisputes: 0, fraudCount: 0, areaName
            });
            setCreateSuccess(`✅ Created "${name}". Please logout and log back in.`);
            setCreateForm({ name: '', email: '', password: '', confirmPassword: '', role: 'regionAdmin', regionAdminId: '', areaName: '' });
        } catch (err) { setCreateError('Error: ' + err.message); }
        finally { setCreateLoading(false); }
    };

    /* ── Derived data ── */
    const regionLeads = admins.filter(a => a.role === 'regionLead');
    const childAdmins = admins.filter(a => ['admin', 'mason'].includes(a.role) && !!a.parentAdminId);
    const unassignedAdmins = admins.filter(a => ['admin', 'mason'].includes(a.role) && !a.parentAdminId);
    
    const getScoreColor = (score) => {
        if (score >= 80) return 'var(--success)';
        if (score >= 60) return 'var(--warning)';
        return 'var(--error)';
    };

    /* ── Filtering helpers ── */
    const filteredBookings = allBookings.filter(b => {
        if (filterStatus !== 'all' && b.status !== filterStatus) return false;
        if (filterSearch && !b.customerName?.toLowerCase().includes(filterSearch.toLowerCase())) return false;
        return true;
    });

    const resetFilters = () => {
        setFilterSearch(''); setFilterStatus('all'); setFilterDateFrom(''); setFilterDateTo(''); setFilterRegion('all');
    };

    return (
        <div className="dash-container" style={{ minHeight: '100vh', background: 'var(--bg-main)', padding: '40px 20px' }}>
            <main style={{ maxWidth: 1200, margin: '0 auto' }}>
                
                {/* Global Header */}
                <header style={{ 
                    background: 'var(--primary-purple-glow)', 
                    backdropFilter: 'var(--glass-blur)',
                    border: '1px solid var(--primary-purple)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '48px',
                    marginBottom: '40px',
                    boxShadow: 'var(--glass-shadow)'
                }}>
                    <h1 style={{ fontSize: 'var(--font-xl)', fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>SuperAdmin Control Center</h1>
                    <p style={{ color: 'var(--text-muted)', fontWeight: 600, marginTop: 12 }}>Governance & Global Logistics Oversight</p>
                </header>

                {/* Summary Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16, marginBottom: 40 }}>
                    {[
                        { label: 'Regions', value: regionLeads.length, icon: '🌐', color: 'var(--primary-purple)' },
                        { label: 'Masons', value: childAdmins.length, icon: '👤', color: 'var(--secondary-green)' },
                        { label: 'Escalations', value: escalatedBookings.length, icon: '🚨', color: 'var(--error)' },
                        { label: 'Total Jobs', value: allBookings.length, icon: '📋', color: 'var(--text-main)' },
                        { label: 'Active Pros', value: allWorkers.length, icon: '👷', color: 'var(--success)' },
                    ].map(card => (
                        <div key={card.label} className="job-card" style={{ padding: 20, textAlign: 'center' }}>
                            <div style={{ fontSize: 24, marginBottom: 8 }}>{card.icon}</div>
                            <div style={{ fontSize: 24, fontWeight: 900, color: card.color }}>{card.value}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>{card.label}</div>
                        </div>
                    ))}
                </div>

                {/* Navigation */}
                <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap', background: 'var(--bg-soft)', padding: 8, borderRadius: 'var(--radius-lg)' }}>
                    {[
                        { id: 'escalations', label: 'Escalations', icon: '🚨', count: escalatedBookings.length },
                        { id: 'disputes', label: 'Disputes', icon: '⚠️' },
                        { id: 'work-status', label: 'Monitor', icon: '🔍' },
                        { id: 'regions', label: 'Performance', icon: '📊' },
                        { id: 'admin-workers', label: 'Infrastructure', icon: '👥' },
                        { id: 'create', label: 'Setup', icon: '➕' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '12px 20px',
                                borderRadius: 'var(--radius-md)',
                                background: activeTab === tab.id ? 'var(--bg-main)' : 'transparent',
                                color: activeTab === tab.id ? 'var(--primary-purple)' : 'var(--text-muted)',
                                fontWeight: 800,
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                transition: 'all 0.2s',
                                boxShadow: activeTab === tab.id ? 'var(--shadow-sm)' : 'none'
                            }}
                        >
                            <span>{tab.icon}</span> {tab.label}
                            {tab.count > 0 && <span style={{ background: 'var(--error)', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 10 }}>{tab.count}</span>}
                        </button>
                    ))}
                </div>

                {/* Tab Content Rendering */}
                <div style={{ minHeight: 400 }}>
                    {activeTab === 'escalations' && (
                        <div className="job-card" style={{ padding: 32 }}>
                            <h3 style={{ margin: '0 0 24px 0', fontSize: 20, fontWeight: 800 }}>Escalated Resolution Queue</h3>
                            {escalatedBookings.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>✅ No pending escalations.</div>
                            ) : (
                                <div style={{ display: 'grid', gap: 16 }}>
                                    {escalatedBookings.map(b => (
                                        <div key={b.id} style={{ padding: 24, background: 'var(--bg-soft)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--error)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                                <div>
                                                    <div style={{ fontWeight: 800, fontSize: 18 }}>{b.serviceType} - {b.id.slice(-6)}</div>
                                                    <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Customer: {b.customerName} | Region: {b.area || 'Unknown'}</div>
                                                </div>
                                                <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 900 }}>ESCALATED</div>
                                            </div>
                                            <div style={{ background: 'var(--bg-main)', padding: 16, borderRadius: 12, marginBottom: 20, fontSize: 13 }}>
                                                <strong>Dispute Detail:</strong> {b.dispute?.reason || 'No reason provided'}
                                            </div>
                                            <div style={{ display: 'flex', gap: 12 }}>
                                                <button onClick={() => resolveEscalatedDispute(b, 'refund_user')} className="btn-primary" style={{ background: 'var(--error)' }}>Full Refund</button>
                                                <button onClick={() => resolveEscalatedDispute(b, 'pay_worker')} className="btn-primary" style={{ background: 'var(--success)' }}>Pay Worker</button>
                                                <button onClick={() => resolveEscalatedDispute(b, 'split_payment')} className="btn-primary" style={{ background: 'var(--primary-purple)' }}>Split 50/50</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'regions' && (
                        <div style={{ display: 'grid', gap: 20 }}>
                            {regionLeads.map(lead => (
                                <div key={lead.id} className="job-card" style={{ padding: 32, borderLeft: `6px solid ${getScoreColor(lead.regionScore)}` }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                        <div>
                                            <div style={{ fontSize: 22, fontWeight: 900 }}>{lead.name || lead.email}</div>
                                            <div style={{ color: 'var(--primary-purple)', fontWeight: 700 }}>{lead.areaName}</div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800 }}>PERFORMANCE SCORE</div>
                                            <div style={{ fontSize: 32, fontWeight: 900, color: getScoreColor(lead.regionScore) }}>{lead.regionScore}%</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 20, marginBottom: 24 }}>
                                        <div style={{ background: 'var(--bg-soft)', padding: 16, borderRadius: 12 }}>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800 }}>DISPUTES</div>
                                            <div style={{ fontSize: 20, fontWeight: 800 }}>{lead.totalDisputes || 0}</div>
                                        </div>
                                        <div style={{ background: 'var(--bg-soft)', padding: 16, borderRadius: 12 }}>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800 }}>FRAUD</div>
                                            <div style={{ fontSize: 20, fontWeight: 800, color: (lead.fraudCount || 0) > 0 ? 'var(--error)' : 'inherit' }}>{lead.fraudCount || 0}</div>
                                        </div>
                                        <div style={{ background: 'var(--bg-soft)', padding: 16, borderRadius: 12 }}>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800 }}>MASONS</div>
                                            <div style={{ fontSize: 20, fontWeight: 800 }}>{childAdmins.filter(a => a.parentAdminId === lead.id).length}</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        {lead.regionStatus !== 'suspended' 
                                            ? <button onClick={() => suspendRegion(lead.id)} style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--error)', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer' }}>Suspend Region</button>
                                            : <button onClick={() => reinstateRegion(lead.id)} style={{ padding: '10px 20px', borderRadius: 8, background: 'var(--success)', color: 'white', border: 'none', fontWeight: 800, cursor: 'pointer' }}>Reinstate Region</button>
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'create' && (
                        <div className="job-card" style={{ padding: 48, maxWidth: 600, margin: '0 auto' }}>
                            <h3 style={{ margin: '0 0 32px 0', fontSize: 24, fontWeight: 800 }}>Commission New Region</h3>
                            <form onSubmit={createRegionAdmin} style={{ display: 'grid', gap: 20 }}>
                                {createError && <div style={{ background: 'var(--error-bg)', color: 'var(--error)', padding: 16, borderRadius: 12, fontWeight: 700 }}>{createError}</div>}
                                {createSuccess && <div style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: 16, borderRadius: 12, fontWeight: 700 }}>{createSuccess}</div>}
                                <input placeholder="Region Leader Name" className="input-field" value={createForm.name} onChange={e => setCreateForm({...createForm, name: e.target.value})} />
                                <input placeholder="Official Email" className="input-field" value={createForm.email} onChange={e => setCreateForm({...createForm, email: e.target.value})} />
                                <input placeholder="Jurisdiction / Area Name" className="input-field" value={createForm.areaName} onChange={e => setCreateForm({...createForm, areaName: e.target.value})} />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <input type="password" placeholder="Secure Password" className="input-field" value={createForm.password} onChange={e => setCreateForm({...createForm, password: e.target.value})} />
                                    <input type="password" placeholder="Confirm Password" className="input-field" value={createForm.confirmPassword} onChange={e => setCreateForm({...createForm, confirmPassword: e.target.value})} />
                                </div>
                                <button type="submit" disabled={createLoading} className="btn-primary" style={{ padding: 20 }}>{createLoading ? 'Provisioning...' : 'Confirm Provisioning'}</button>
                            </form>
                        </div>
                    )}

                    {/* Infrastructure Tab (Child Admins/Masons) */}
                    {activeTab === 'admin-workers' && (
                         <div className="job-card" style={{ padding: 32 }}>
                            <h3 style={{ margin: '0 0 24px 0', fontSize: 20, fontWeight: 800 }}>Logistics Network</h3>
                            <div style={{ display: 'grid', gap: 32 }}>
                                {regionLeads.map(rl => {
                                    const masons = childAdmins.filter(a => a.parentAdminId === rl.id);
                                    return (
                                        <div key={rl.id} style={{ borderBottom: '1px solid var(--border-light)', pb: 32 }}>
                                            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--primary-purple)', mb: 16 }}>🌐 {rl.name} ({rl.areaName})</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
                                                {masons.map(m => (
                                                    <div key={m.id} style={{ background: 'var(--bg-soft)', padding: 16, borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <div>
                                                            <div style={{ fontWeight: 800 }}>{m.name}</div>
                                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.email}</div>
                                                        </div>
                                                        <button onClick={() => unassignAdminFromRegionLead(m.id)} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--error)', color: 'var(--error)', background: 'transparent', fontSize: 10, fontWeight: 800 }}>DETACH</button>
                                                    </div>
                                                ))}
                                                {masons.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)', italic: true }}>No masons assigned to this region.</div>}
                                            </div>
                                        </div>
                                    )
                                })}
                                
                                {unassignedAdmins.length > 0 && (
                                    <div style={{ background: 'var(--warning-bg)', padding: 24, borderRadius: 16, border: '1px dashed var(--warning)' }}>
                                        <h4 style={{ margin: '0 0 16px 0', color: 'var(--warning)', fontWeight: 800 }}>⚠️ Unassigned Logisticians (Masons)</h4>
                                        <div style={{ display: 'grid', gap: 12 }}>
                                            {unassignedAdmins.map(a => (
                                                <div key={a.id} style={{ background: 'var(--bg-main)', padding: 12, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 700 }}>{a.name} ({a.email})</span>
                                                    <select 
                                                        onChange={(e) => e.target.value && assignAdminToRegionLead(a.id, e.target.value)}
                                                        style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--bg-soft)', color: 'var(--text-main)', border: '1px solid var(--border-light)' }}
                                                    >
                                                        <option value="">Assign to Region...</option>
                                                        {regionLeads.map(rl => <option key={rl.id} value={rl.id}>{rl.name} ({rl.areaName})</option>)}
                                                    </select>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                         </div>
                    )}
                    
                    {/* Monitor Tab */}
                    {activeTab === 'work-status' && (
                        <div className="job-card" style={{ padding: 32 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 24 }}>
                                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Global Operation Monitor</h3>
                                <div style={{ display: 'flex', gap: 12 }}>
                                    <input placeholder="Search customer..." className="input-field" style={{ width: 200, padding: '8px 12px' }} value={filterSearch} onChange={e => setFilterSearch(e.target.value)} />
                                    <select className="input-field" style={{ padding: '8px 12px' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                                        <option value="all">All Status</option>
                                        <option value="pending">Pending</option>
                                        <option value="in_progress">Active</option>
                                        <option value="completed">Completed</option>
                                    </select>
                                </div>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 20 }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-light)', textAlign: 'left' }}>
                                            <th style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>JOB ID</th>
                                            <th style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>CUSTOMER</th>
                                            <th style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>SERVICE</th>
                                            <th style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>STATUS</th>
                                            <th style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)' }}>REGION</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredBookings.map(b => (
                                            <tr key={b.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                <td style={{ padding: 12, fontSize: 13, fontWeight: 700 }}>#{b.id.slice(-6)}</td>
                                                <td style={{ padding: 12, fontSize: 13 }}>{b.customerName}</td>
                                                <td style={{ padding: 12, fontSize: 13 }}>{b.serviceType}</td>
                                                <td style={{ padding: 12 }}>
                                                    <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', padding: '4px 8px', borderRadius: 4, background: b.status === 'completed' ? 'var(--success-bg)' : 'var(--bg-soft)', color: b.status === 'completed' ? 'var(--success)' : 'inherit' }}>{b.status}</span>
                                                </td>
                                                <td style={{ padding: 12, fontSize: 13 }}>{b.area || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
