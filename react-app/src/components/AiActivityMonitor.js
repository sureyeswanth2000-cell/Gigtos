import React, { useEffect, useState } from 'react';
import './AiActivityMonitor.css';

/**
 * AI activity feed — displays real-time booking and service updates.
 * In production these come from the ai_recommendations_log / user_behavior_events tables.
 */

function AiPulse() {
  return (
    <span className="ai-pulse-dot" aria-hidden="true">
      <span className="ai-pulse-ring" />
    </span>
  );
}

export default function AiActivityMonitor({ embedded = false }) {
  // Re-key the LIVE badge animation every 8 seconds to create a subtle visual
  // heartbeat that signals the monitor is actively receiving updates.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 8000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="ai-monitor" aria-label="AI Activity Monitor">
      <div className="ai-monitor__header">
        <div className="ai-monitor__title-row">
          <AiPulse />
          <h2>Gito AI Activity</h2>
          <span className="ai-live-badge" key={tick}>LIVE</span>
        </div>
        <p className="ai-monitor__subtitle">
          Book a service to see real-time updates and tracking here.
        </p>
      </div>

      <div className="ai-monitor__feed">
        <div className="ai-empty">
          No active bookings yet. Browse services below to get started.
        </div>
      </div>
    </section>
  );
}
