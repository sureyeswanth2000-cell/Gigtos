import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useLocation } from 'react-router-dom';
import { auth, db, functionsInstance } from '../firebase';
import { getDevBypassUserFromSearch, isDevBypassEnabled } from '../utils/devBypass';
import { buildOperatorConsoleSnapshot } from '../utils/operatorQueues';
import './FieldOperator.css';

const demoWorkers = [
  {
    id: 'worker-verify-1',
    name: 'Ravi Kumar',
    gigType: 'Kitchen Help',
    area: 'Indiranagar',
    approvalStatus: 'pending',
    externalPlatformProof: true,
    gigScore: 520,
  },
  {
    id: 'worker-quality-1',
    name: 'Sana Khan',
    gigType: 'House Cleaning',
    area: 'Gachibowli',
    approvalStatus: 'approved',
    gigScore: 420,
  },
];

const demoBookings = [
  {
    id: 'booking-dispute-1',
    serviceType: 'Bathroom Cleaning',
    customerName: 'Dev Consumer',
    workerId: 'worker-quality-1',
    workerName: 'Sana Khan',
    dispute: { status: 'open', severity: 'High' },
  },
  {
    id: 'booking-travel-1',
    serviceType: 'Kitchen Help',
    customerName: 'Dev Consumer',
    workerId: 'worker-quality-1',
    workerName: 'Sana Khan',
    status: 'in_progress',
    travelWatchdogStatus: 'timeout_review',
    travelWatchdogMessage: 'Travel is far beyond expected time and location updates are stale.',
    supportReviewRequired: true,
    noShowCandidate: true,
    travelWatchdogEvidence: { elapsedMinutes: 28, staleSeconds: 180, etaMinutes: 10 },
  },
  {
    id: 'booking-travel-resolved-1',
    serviceType: 'Bathroom Cleaning',
    customerName: 'Dev Consumer',
    workerId: 'worker-quality-1',
    workerName: 'Sana Khan',
    status: 'in_progress',
    travelWatchdogStatus: 'timeout_review',
    travelWatchdogResolutionStatus: 'resolved',
    travelWatchdogResolutionDecision: 'confirmed_no_show',
    travelWatchdogResolutionReason: 'Confirmed after route evidence and calls. Sent to GigScore review.',
    travelWatchdogResolvedAt: new Date('2026-06-02T10:00:00Z'),
    travelWatchdogScoreDecision: 'pending_gigscore_review',
    travelWatchdogGigScoreReviewEventId: 'travel_no_show_booking-travel-resolved-1',
  },
];

const demoTickets = [
  {
    id: 'support-1',
    role: 'worker',
    title: 'Consumer not confirming completed work',
    priority: 'High',
    status: 'open',
  },
  {
    id: 'travel-booking-travel-1-timeout',
    role: 'system',
    category: 'travel_watchdog',
    title: 'Travel timeout review',
    priority: 'High',
    status: 'open',
    bookingId: 'booking-travel-1',
    workerId: 'worker-quality-1',
    evidence: { level: 'timeout_review', elapsedMinutes: 28, staleSeconds: 180 },
  },
  {
    id: 'travel-booking-travel-resolved-1',
    role: 'system',
    category: 'travel_watchdog',
    title: 'Travel timeout resolved',
    priority: 'High',
    status: 'resolved',
    bookingId: 'booking-travel-resolved-1',
    workerId: 'worker-quality-1',
    resolutionDecision: 'confirmed_no_show',
    resolution: 'Confirmed after route evidence and calls. Sent to GigScore review.',
    scoreDecision: 'pending_gigscore_review',
    resolvedAt: new Date('2026-06-02T10:00:00Z'),
    evidence: { level: 'timeout_review', elapsedMinutes: 31, staleSeconds: 220 },
  },
];

function QueueTable({ title, description, rows, columns, emptyText, countLabel = 'open' }) {
  return (
    <section className="operator-card">
      <div className="operator-section-heading">
        <div>
          <span>{rows.length} {countLabel}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="operator-empty">{emptyText}</div>
      ) : (
        <div className="operator-table-wrap">
          <table className="operator-table">
            <thead>
              <tr>
                {columns.map(col => <th key={col.key}>{col.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.id}>
                  {columns.map(col => (
                    <td key={col.key}>{col.render ? col.render(row) : row[col.key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function FieldOperator() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('verification');
  const [workers, setWorkers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const devUser = useMemo(
    () => (isDevBypassEnabled() ? getDevBypassUserFromSearch(location.search) : null),
    [location.search]
  );

  useEffect(() => {
    const load = async () => {
      try {
        if (devUser?.role === 'field_operator' || devUser?.role === 'superadmin') {
          setWorkers(demoWorkers);
          setBookings(demoBookings);
          setTickets(demoTickets);
          return;
        }

        const uid = auth.currentUser?.uid;
        if (!uid) return;

        const [workerSnap, bookingSnap, supportSnap] = await Promise.all([
          getDocs(collection(db, 'gig_workers')),
          getDocs(query(collection(db, 'bookings'), where('status', 'in', ['open', 'assigned', 'in_progress', 'awaiting_confirmation']))),
          getDocs(collection(db, 'support_tickets')).catch(() => ({ docs: [] })),
        ]);

        setWorkers(workerSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setBookings(bookingSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        setTickets(supportSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [devUser]);

  const snapshot = useMemo(
    () => buildOperatorConsoleSnapshot({ workers, bookings, tickets }),
    [workers, bookings, tickets]
  );

  const tabs = [
    { id: 'verification', label: 'Verification', count: snapshot.totals.verification },
    { id: 'disputes', label: 'Disputes', count: snapshot.totals.disputes },
    { id: 'travel', label: 'Travel', count: snapshot.totals.travel },
    { id: 'travel-history', label: 'History', count: snapshot.travelResolvedHistoryQueue.length },
    { id: 'quality', label: 'Quality', count: snapshot.totals.quality },
    { id: 'support', label: 'Support', count: snapshot.totals.support },
  ];

  const holdDisputePayout = async (booking) => {
    if (!booking?.id) return;
    const reason = window.prompt('Reason to hold this worker payout for dispute review?', 'Field operator dispute review before payout release.');
    if (!reason) return;
    if (devUser?.role === 'field_operator' || devUser?.role === 'superadmin') {
      setActionMessage('Dev payout hold recorded.');
      return;
    }
    try {
      await httpsCallable(functionsInstance, 'operatorPayoutAction')({
        action: 'hold_payout_for_dispute',
        payload: {
          bookingId: booking.id,
          operationId: booking.workerPayoutOperationId || null,
          reason,
        },
      });
      setActionMessage('Payout held for field-operator dispute review.');
      setBookings(prev => prev.map(item => (
        item.id === booking.id
          ? { ...item, workerPayoutStatus: 'field_operator_hold', workerPayoutHoldReason: reason }
          : item
      )));
    } catch (err) {
      setActionMessage(err.message || 'Could not hold payout.');
    }
  };

  const resolveTravelReview = async (row, decision) => {
    if (!row?.bookingId) return;
    const reason = window.prompt(
      'Resolution reason for this travel review?',
      decision === 'confirmed_no_show'
        ? 'Confirmed after contacting consumer/worker. Send to GigScore review queue.'
        : 'Reviewed route evidence and contacted parties.'
    );
    if (!reason) return;
    if (devUser?.role === 'field_operator' || devUser?.role === 'superadmin') {
      setActionMessage(`Dev travel review marked ${decision.replace(/_/g, ' ')}.`);
      setBookings(prev => prev.map(item => (
        item.id === row.bookingId
          ? { ...item, travelWatchdogResolutionStatus: decision === 'dismiss_gps_issue' ? 'dismissed' : 'resolved' }
          : item
      )));
      setTickets(prev => prev.map(item => (
        item.id === row.ticket?.id
          ? { ...item, status: decision === 'dismiss_gps_issue' ? 'closed' : 'resolved' }
          : item
      )));
      return;
    }
    try {
      await httpsCallable(functionsInstance, 'resolveTravelWatchdogReview')({
        bookingId: row.bookingId,
        ticketId: row.ticket?.id || '',
        decision,
        reason,
        payoutDecision: decision === 'confirmed_no_show' ? 'hold_for_review' : 'no_payout_change',
        scoreDecision: decision === 'confirmed_no_show' ? 'create_gigscore_review' : 'no_score_change',
      });
      setActionMessage(decision === 'confirmed_no_show' ? 'Travel review updated and GigScore review created.' : 'Travel review updated.');
      setBookings(prev => prev.map(item => (
        item.id === row.bookingId
          ? { ...item, travelWatchdogResolutionStatus: decision === 'dismiss_gps_issue' ? 'dismissed' : 'resolved' }
          : item
      )));
      setTickets(prev => prev.map(item => (
        item.id === row.ticket?.id
          ? { ...item, status: decision === 'dismiss_gps_issue' ? 'closed' : 'resolved' }
          : item
      )));
    } catch (err) {
      setActionMessage(err.message || 'Could not resolve travel review.');
    }
  };

  if (loading) {
    return <div className="operator-page"><div className="operator-loading">Loading operator console...</div></div>;
  }

  return (
    <div className="operator-page">
      <section className="operator-hero">
        <div>
          <span className="operator-kicker">Field operator console</span>
          <h1>Local trust control tower</h1>
          <p>Verify workers, watch disputes, add quality notes, and keep high-risk jobs visible before they damage trust.</p>
        </div>
        <div className="operator-hero-metrics">
          <strong>{Object.values(snapshot.totals).reduce((sum, value) => sum + value, 0)}</strong>
          <span>open checks</span>
        </div>
      </section>

      <section className="operator-metric-grid">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            type="button"
            onClick={() => setActiveTab(tab.id)}
          >
            <strong>{tab.count}</strong>
            <span>{tab.label}</span>
          </button>
        ))}
      </section>

      {actionMessage && (
        <section className="operator-card" style={{ padding: 14, fontWeight: 800 }}>
          {actionMessage}
        </section>
      )}

      {activeTab === 'verification' && (
        <QueueTable
          title="Worker Verification Queue"
          description="Review identity, UC/Pivot proof, service skill evidence, and first-city readiness."
          rows={snapshot.verificationQueue}
          emptyText="No worker verification checks are waiting."
          columns={[
            { key: 'name', label: 'Worker' },
            { key: 'service', label: 'Service' },
            { key: 'area', label: 'Area' },
            { key: 'risk', label: 'Risk' },
            { key: 'nextAction', label: 'Next action' },
            {
              key: 'actions',
              label: 'Actions',
              render: row => (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn-secondary" onClick={() => resolveTravelReview(row, 'worker_contacted')}>
                    Contacted
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => resolveTravelReview(row, 'dismiss_gps_issue')}>
                    Dismiss GPS
                  </button>
                  <button type="button" className="btn-secondary" onClick={() => resolveTravelReview(row, 'confirmed_no_show')}>
                    Send No-show Review
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      {activeTab === 'disputes' && (
        <QueueTable
          title="Dispute Queue"
          description="Use photos, chat, timeline, and job status before refund, payout hold, or replacement decisions."
          rows={snapshot.disputeQueue}
          emptyText="No open disputes."
          columns={[
            { key: 'service', label: 'Service' },
            { key: 'consumer', label: 'Consumer' },
            { key: 'worker', label: 'Worker' },
            { key: 'priority', label: 'Priority' },
            { key: 'nextAction', label: 'Next action' },
            {
              key: 'payoutHold',
              label: 'Payout',
              render: row => (
                <button
                  type="button"
                  onClick={() => holdDisputePayout(row.raw || row)}
                  disabled={(row.raw?.workerPayoutStatus || row.workerPayoutStatus) === 'field_operator_hold'}
                  style={{
                    border: '1px solid #d97706',
                    background: '#fff7ed',
                    color: '#9a3412',
                    borderRadius: 8,
                    padding: '8px 10px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {(row.raw?.workerPayoutStatus || row.workerPayoutStatus) === 'field_operator_hold' ? 'Held' : 'Hold payout'}
                </button>
              ),
            },
          ]}
        />
      )}

      {activeTab === 'travel' && (
        <QueueTable
          title="Travel Watchdog Queue"
          description="Review delayed travel, stale GPS, and no-show candidates before any score or payout decision."
          rows={snapshot.travelReviewQueue}
          emptyText="No travel watchdog reviews."
          columns={[
            { key: 'bookingId', label: 'Booking' },
            { key: 'service', label: 'Service' },
            { key: 'worker', label: 'Worker' },
            { key: 'level', label: 'Level' },
            {
              key: 'timing',
              label: 'Evidence',
              render: row => `${row.elapsedMinutes || 0} min / ${row.staleSeconds || 0}s stale`,
            },
            { key: 'nextAction', label: 'Next action' },
          ]}
        />
      )}

      {activeTab === 'travel-history' && (
        <QueueTable
          title="Resolved Travel Watchdog History"
          description="Completed route reviews kept for audit. These rows are not open work and do not change GigScore unless SuperAdmin later finalizes a pending event."
          rows={snapshot.travelResolvedHistoryQueue}
          emptyText="No resolved travel watchdog history yet."
          countLabel="resolved"
          columns={[
            { key: 'bookingId', label: 'Booking' },
            { key: 'service', label: 'Service' },
            { key: 'worker', label: 'Worker' },
            { key: 'decision', label: 'Decision', render: row => String(row.decision || '').replace(/_/g, ' ') },
            { key: 'status', label: 'Status' },
            { key: 'resolvedAt', label: 'Resolved' },
            {
              key: 'scoreDecision',
              label: 'Score',
              render: row => row.gigScoreReviewEventId ? `Pending review ${row.gigScoreReviewEventId}` : String(row.scoreDecision || 'no score change').replace(/_/g, ' '),
            },
            { key: 'reason', label: 'Reason' },
          ]}
        />
      )}

      {activeTab === 'quality' && (
        <QueueTable
          title="Worker Quality Checks"
          description="Watch low score, repeated 1-star, bad photos, and repeated dispute patterns."
          rows={snapshot.qualityQueue}
          emptyText="No worker quality checks are active."
          columns={[
            { key: 'name', label: 'Worker' },
            { key: 'service', label: 'Service' },
            { key: 'issueCount', label: 'Issues' },
            { key: 'score', label: 'Score' },
            { key: 'nextAction', label: 'Next action' },
          ]}
        />
      )}

      {activeTab === 'support' && (
        <QueueTable
          title="Support Queue"
          description="Track consumer and worker support tickets with clear priority and escalation path."
          rows={snapshot.supportQueue}
          emptyText="No open support tickets."
          columns={[
            { key: 'role', label: 'Role' },
            { key: 'title', label: 'Issue' },
            { key: 'priority', label: 'Priority' },
            { key: 'status', label: 'Status' },
            { key: 'nextAction', label: 'Next action' },
          ]}
        />
      )}

      <section className="operator-card operator-note-card">
        <span className="operator-kicker">Quality notes</span>
        <h2>Operator action rule</h2>
        <p>Every sensitive action should capture reason, before/after summary, actor, timestamp, and whether superadmin approval is required.</p>
      </section>
    </div>
  );
}
