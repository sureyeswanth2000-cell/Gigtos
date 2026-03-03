import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function SuperAdmin() {
    const [admins, setAdmins] = useState([]);
    const [escalatedBookings, setEscalatedBookings] = useState([]);
    const [allWorkers, setAllWorkers] = useState([]);
    const [activeTab, setActiveTab] = useState('regions');

    const uid = auth.currentUser?.uid;

    /* ── Listen to all admins (regionLeads) ── */
    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'admins'), snap => {
            setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return unsub;
    }, []);

    /* ── Listen to escalated disputes ── */
    useEffect(() => {
        const unsub = onSnapshot(
            query(collection(db, 'bookings'), orderBy('createdAt', 'desc')),
            snap => {
                const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setEscalatedBookings(all.filter(b =>
                    b.dispute?.escalationStatus === true && b.dispute?.status === 'open'
                ));
            }
        );
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
        if (!decision) { alert('Please select a decision'); return; }
        await updateDoc(doc(db, 'bookings', booking.id), {
            'dispute.status': 'resolved',
            'dispute.decision': decision,
            'dispute.resolvedBy': uid,
            'dispute.superadminOverride': true,
            updatedAt: new Date(),
        });
        alert('Dispute resolved by superadmin.');
    };

    /* ── Derived data ── */
    const regionLeads = admins.filter(a => a.role === 'regionLead' || a.role === 'admin');
    const probationaryLeads = regionLeads.filter(a => a.probationStatus === true);
    const suspendedLeads = regionLeads.filter(a => a.regionStatus === 'suspended');

    const getScoreColor = (score) => {
        if (score >= 80) return '#10b981';
        if (score >= 60) return '#f59e0b';
        return '#ef4444';
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
                    { label: 'Region Leads', value: regionLeads.length, icon: '🌐', color: '#667eea' },
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
                    { key: 'regions', label: '🌐 Region Performance', color: '#667eea' },
                    { key: 'escalated', label: `🚨 Escalated (${escalatedBookings.length})`, color: '#dc2626' },
                    { key: 'workers', label: '👷 Workers & Fraud', color: '#10b981' },
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

            {/* ═══════════════ ESCALATED DISPUTES TAB ═══════════════ */}
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
