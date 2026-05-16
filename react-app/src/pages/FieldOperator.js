import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
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
    socioScore: 520,
  },
  {
    id: 'worker-quality-1',
    name: 'Sana Khan',
    gigType: 'House Cleaning',
    area: 'Gachibowli',
    approvalStatus: 'approved',
    socioScore: 420,
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
];

const demoTickets = [
  {
    id: 'support-1',
    role: 'worker',
    title: 'Consumer not confirming completed work',
    priority: 'High',
    status: 'open',
  },
];

function QueueTable({ title, description, rows, columns, emptyText }) {
  return (
    <section className="operator-card">
      <div className="operator-section-heading">
        <div>
          <span>{rows.length} open</span>
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
    { id: 'quality', label: 'Quality', count: snapshot.totals.quality },
    { id: 'support', label: 'Support', count: snapshot.totals.support },
  ];

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
