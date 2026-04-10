import React, { useEffect, useMemo, useState } from 'react';
import { suggestBudget, formatBudgetRange } from '../utils/aiBudgetSuggestion';
import './AiActivityMonitor.css';

/**
 * Simulated AI activity feed — shows auto-created jobs, work tracking, and budget suggestions.
 * In production these would come from the ai_recommendations_log / user_behavior_events tables.
 * Timestamps are relative offsets from render time; timeAgo() always shows fresh labels.
 *
 * Auto-created jobs start as 'pending_confirmation' — the user must explicitly
 * confirm or dismiss before any booking is placed. AI never auto-books.
 */
const ACTIVITY_OFFSETS_MS = [120000, 90000, 60000, 30000];

function buildActivityFeed() {
  const now = Date.now();
  return [
    { id: 'a1', type: 'auto_job', service: 'Plumber', area: 'Kukatpally', status: 'pending_confirmation', ts: now - ACTIVITY_OFFSETS_MS[0], description: 'Pipe leak repair' },
    { id: 'a2', type: 'auto_job', service: 'Electrician', area: 'Miyapur', status: 'pending_confirmation', ts: now - ACTIVITY_OFFSETS_MS[1], description: 'Switchboard wiring repair' },
    { id: 'a3', type: 'tracking', service: 'Painter', area: 'Gachibowli', status: 'in_progress', ts: now - ACTIVITY_OFFSETS_MS[2], worker: 'FreshCoat Painters', progress: 65, description: 'Interior painting 2BHK' },
    { id: 'a4', type: 'tracking', service: 'Carpenter', area: 'Madhapur', status: 'completed', ts: now - ACTIVITY_OFFSETS_MS[3], worker: 'WoodCraft Studio', progress: 100, description: 'Door frame repair' },
    { id: 'a5', type: 'budget', service: 'Plumber', description: 'Full bathroom renovation', estimatedDays: 3 },
    { id: 'a6', type: 'budget', service: 'Electrician', description: 'Emergency switchboard fix', estimatedDays: 1 },
  ];
}

const STATUS_LABELS = {
  pending_confirmation: '⏳ Awaiting Your Confirmation',
  confirmed: '✅ Confirmed',
  dismissed: '❌ Dismissed',
  created: '🆕 Created',
  matched: '🤝 Worker Matched',
  in_progress: '🔄 In Progress',
  completed: '✅ Completed',
  pending: '⏳ Pending',
};

const STATUS_CLASSES = {
  pending_confirmation: 'status-pending-confirmation',
  confirmed: 'status-confirmed',
  dismissed: 'status-dismissed',
  created: 'status-created',
  matched: 'status-matched',
  in_progress: 'status-progress',
  completed: 'status-completed',
  pending: 'status-pending',
};

function timeAgo(ts) {
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

function AiPulse() {
  return (
    <span className="ai-pulse-dot" aria-hidden="true">
      <span className="ai-pulse-ring" />
    </span>
  );
}

function AutoJobCard({ item, onConfirm, onDismiss }) {
  const isPending = item.status === 'pending_confirmation';
  const isDismissed = item.status === 'dismissed';

  return (
    <div className={`ai-card ai-card--job${isDismissed ? ' ai-card--dismissed' : ''}`}>
      <div className="ai-card__icon">
        <AiPulse />
      </div>
      <div className="ai-card__body">
        <div className="ai-card__title">
          AI suggests <strong>{item.service}</strong> job in {item.area}
        </div>
        <div className="ai-card__desc">{item.description}</div>
        <div className="ai-card__meta">
          <span className={`ai-status ${STATUS_CLASSES[item.status] || ''}`}>
            {STATUS_LABELS[item.status] || item.status}
          </span>
          <span className="ai-card__time">{timeAgo(item.ts)}</span>
        </div>
        {isPending && (
          <div className="ai-card__actions">
            <button className="ai-confirm-btn" onClick={() => onConfirm?.(item.id)} aria-label={`Confirm ${item.service} booking`}>
              ✓ Confirm Booking
            </button>
            <button className="ai-dismiss-btn" onClick={() => onDismiss?.(item.id)} aria-label={`Dismiss ${item.service} suggestion`}>
              ✕ Dismiss
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function TrackingCard({ item }) {
  return (
    <div className="ai-card ai-card--tracking">
      <div className="ai-card__icon">
        <span className="ai-tracking-gif" role="img" aria-label="work in progress">
          {item.status === 'completed' ? '✅' : '⚙️'}
        </span>
      </div>
      <div className="ai-card__body">
        <div className="ai-card__title">
          <strong>{item.service}</strong> — {item.worker}
        </div>
        <div className="ai-card__desc">{item.description} · {item.area}</div>
        <div className="ai-progress-bar" role="progressbar" aria-valuenow={item.progress} aria-valuemin="0" aria-valuemax="100">
          <div className="ai-progress-fill" style={{ width: `${item.progress}%` }} />
        </div>
        <div className="ai-card__meta">
          <span className={`ai-status ${STATUS_CLASSES[item.status] || ''}`}>
            {STATUS_LABELS[item.status] || item.status}
          </span>
          <span className="ai-card__progress-label">{item.progress}% done</span>
        </div>
      </div>
    </div>
  );
}

function BudgetCard({ item }) {
  const suggestion = useMemo(
    () => suggestBudget({
      serviceType: item.service,
      description: item.description,
      estimatedDays: item.estimatedDays || 1,
    }),
    [item.service, item.description, item.estimatedDays]
  );

  return (
    <div className="ai-card ai-card--budget">
      <div className="ai-card__icon">
        <span className="ai-budget-icon" role="img" aria-label="budget suggestion">💰</span>
      </div>
      <div className="ai-card__body">
        <div className="ai-card__title">
          AI Budget for <strong>{item.service}</strong>
        </div>
        <div className="ai-card__desc">{item.description} · {item.estimatedDays} day{item.estimatedDays > 1 ? 's' : ''}</div>
        <div className="ai-budget-range">
          <span className="ai-budget-amount">{formatBudgetRange(suggestion)}</span>
          <span className={`ai-confidence ai-confidence--${suggestion.confidence}`}>
            {suggestion.confidence === 'high' ? '🎯' : '📊'} {suggestion.confidence} confidence
          </span>
        </div>
        <div className="ai-card__explain">{suggestion.explanation}</div>
      </div>
    </div>
  );
}

export default function AiActivityMonitor({ embedded = false }) {
  const [visibleCount, setVisibleCount] = useState(3);
  const [activeTab, setActiveTab] = useState('all');

  // Track user decisions on AI-suggested jobs (confirm / dismiss)
  const [jobDecisions, setJobDecisions] = useState({});

  const handleConfirmJob = (jobId) => {
    setJobDecisions((prev) => ({ ...prev, [jobId]: 'confirmed' }));
  };

  const handleDismissJob = (jobId) => {
    setJobDecisions((prev) => ({ ...prev, [jobId]: 'dismissed' }));
  };

  // Rebuild feed each tick so timeAgo labels stay fresh.
  // Re-key the LIVE badge animation every 8 seconds to create a subtle visual
  // heartbeat that signals the monitor is actively receiving updates.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 8000);
    return () => clearInterval(timer);
  }, []);

  const activityFeed = useMemo(() => {
    const feed = buildActivityFeed();
    // Apply user confirm/dismiss decisions to auto_job items
    return feed.map((item) => {
      if (item.type === 'auto_job' && jobDecisions[item.id]) {
        return { ...item, status: jobDecisions[item.id] };
      }
      return item;
    });
  }, [tick, jobDecisions]);

  const filteredFeed = useMemo(() => {
    if (activeTab === 'all') return activityFeed;
    return activityFeed.filter((item) => item.type === activeTab);
  }, [activeTab, activityFeed]);

  const displayedItems = filteredFeed.slice(0, visibleCount);

  const counts = useMemo(() => ({
    auto_job: activityFeed.filter((i) => i.type === 'auto_job').length,
    tracking: activityFeed.filter((i) => i.type === 'tracking').length,
    budget: activityFeed.filter((i) => i.type === 'budget').length,
  }), [activityFeed]);

  return (
    <section className="ai-monitor" aria-label="AI Activity Monitor">
      <div className="ai-monitor__header">
        <div className="ai-monitor__title-row">
          <AiPulse />
          <h2>Gito AI Activity</h2>
          <span className="ai-live-badge" key={tick}>LIVE</span>
        </div>
        <p className="ai-monitor__subtitle">
          AI suggests jobs, tracks work, and recommends budgets — always with your confirmation first.
        </p>
      </div>

      <div className="ai-monitor__tabs" role="tablist">
        <button role="tab" aria-selected={activeTab === 'all'} className={activeTab === 'all' ? 'active' : ''} onClick={() => { setActiveTab('all'); setVisibleCount(3); }}>
          All
        </button>
        <button role="tab" aria-selected={activeTab === 'auto_job'} className={activeTab === 'auto_job' ? 'active' : ''} onClick={() => { setActiveTab('auto_job'); setVisibleCount(3); }}>
          Jobs ({counts.auto_job})
        </button>
        <button role="tab" aria-selected={activeTab === 'tracking'} className={activeTab === 'tracking' ? 'active' : ''} onClick={() => { setActiveTab('tracking'); setVisibleCount(3); }}>
          Tracking ({counts.tracking})
        </button>
        <button role="tab" aria-selected={activeTab === 'budget'} className={activeTab === 'budget' ? 'active' : ''} onClick={() => { setActiveTab('budget'); setVisibleCount(3); }}>
          Budgets ({counts.budget})
        </button>
      </div>

      <div className="ai-monitor__feed">
        {displayedItems.map((item) => {
          if (item.type === 'auto_job') return <AutoJobCard key={item.id} item={item} onConfirm={handleConfirmJob} onDismiss={handleDismissJob} />;
          if (item.type === 'tracking') return <TrackingCard key={item.id} item={item} />;
          if (item.type === 'budget') return <BudgetCard key={item.id} item={item} />;
          return null;
        })}

        {displayedItems.length === 0 && (
          <div className="ai-empty">No activity to show.</div>
        )}
      </div>

      {visibleCount < filteredFeed.length && (
        <button className="ai-monitor__show-more" onClick={() => setVisibleCount((c) => c + 3)}>
          Show more activity
        </button>
      )}
    </section>
  );
}
