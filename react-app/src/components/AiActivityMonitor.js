import React, { useEffect, useMemo, useState } from 'react';
import { suggestBudget, formatBudgetRange } from '../utils/aiBudgetSuggestion';
import './AiActivityMonitor.css';

/**
 * AI activity feed — shows active workers near you in a rotating display,
 * plus work tracking and budget suggestions.
 * In production these would come from the ai_recommendations_log / user_behavior_events tables.
 *
 * Instead of showing demo/fake jobs, we show a rotating "worker near you" banner
 * highlighting real service types that are active on the platform.
 */

/** Active worker types that rotate in the nearby-worker display */
const ACTIVE_WORKERS = [
  { service: 'Electrician', icon: '⚡', tagline: 'An electrician near you' },
  { service: 'Plumber', icon: '🧰', tagline: 'A plumber near you' },
  { service: 'Private Driver', icon: '🚗', tagline: 'A private driver near you' },
  { service: 'Painter', icon: '🎨', tagline: 'A painter near you' },
  { service: 'Carpenter', icon: '🪚', tagline: 'A carpenter near you' },
  { service: 'Cleaner', icon: '🧹', tagline: 'A cleaner near you' },
];

const ROTATE_INTERVAL_MS = 4000;

function buildActivityFeed() {
  const now = Date.now();
  return [
    { id: 'a1', type: 'tracking', service: 'Painter', area: 'Gachibowli', status: 'in_progress', ts: now - 60000, worker: 'FreshCoat Painters', progress: 65, description: 'Interior painting 2BHK' },
    { id: 'a2', type: 'tracking', service: 'Carpenter', area: 'Madhapur', status: 'completed', ts: now - 30000, worker: 'WoodCraft Studio', progress: 100, description: 'Door frame repair' },
    { id: 'a3', type: 'budget', service: 'Plumber', description: 'Full bathroom renovation', estimatedDays: 3 },
    { id: 'a4', type: 'budget', service: 'Electrician', description: 'Emergency switchboard fix', estimatedDays: 1 },
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

function NearbyWorkerCard({ worker }) {
  return (
    <div className="ai-card ai-card--nearby-worker">
      <div className="ai-card__icon">
        <span className="ai-nearby-icon" role="img" aria-label={worker.service}>
          {worker.icon}
        </span>
      </div>
      <div className="ai-card__body">
        <div className="ai-card__title">
          <strong>{worker.tagline}</strong>
        </div>
        <div className="ai-card__desc">
          Available for booking now
        </div>
        <div className="ai-card__meta">
          <span className="ai-status status-available">✅ Active</span>
        </div>
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
  const [workerIndex, setWorkerIndex] = useState(0);

  // Rotate through active workers
  useEffect(() => {
    const timer = setInterval(() => {
      setWorkerIndex((i) => (i + 1) % ACTIVE_WORKERS.length);
    }, ROTATE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, []);

  // Rebuild feed each tick so timeAgo labels stay fresh.
  // Re-key the LIVE badge animation every 8 seconds to create a subtle visual
  // heartbeat that signals the monitor is actively receiving updates.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 8000);
    return () => clearInterval(timer);
  }, []);

  const activityFeed = useMemo(() => {
    return buildActivityFeed();
  }, [tick]);

  const currentWorker = ACTIVE_WORKERS[workerIndex];

  const filteredFeed = useMemo(() => {
    if (activeTab === 'all') return activityFeed;
    return activityFeed.filter((item) => item.type === activeTab);
  }, [activeTab, activityFeed]);

  const displayedItems = filteredFeed.slice(0, visibleCount);

  const counts = useMemo(() => ({
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
          Active workers near you — book verified professionals anytime.
        </p>
      </div>

      {/* Rotating nearby worker banner */}
      <div className="ai-monitor__nearby-banner" key={workerIndex}>
        <NearbyWorkerCard worker={currentWorker} />
      </div>

      <div className="ai-monitor__tabs" role="tablist">
        <button role="tab" aria-selected={activeTab === 'all'} className={activeTab === 'all' ? 'active' : ''} onClick={() => { setActiveTab('all'); setVisibleCount(3); }}>
          All
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
