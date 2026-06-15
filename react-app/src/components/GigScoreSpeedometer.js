import React from 'react';
import { buildDailyScoreDigest, getTierDisplay, getTierMeta, getVisibleDailyScoreEvents } from '../utils/gigScore';

export default function GigScoreSpeedometer({
  score = 0,
  role = 'worker',
  guildScore = null,
  events = [],
}) {
  const digest = buildDailyScoreDigest({ events, currentScore: score, role });
  const visibleEvents = getVisibleDailyScoreEvents({ events });
  const tier = getTierMeta(score);
  const tierDisplay = getTierDisplay({ score, role });
  const guildTier = guildScore == null ? null : getTierMeta(guildScore);
  const scorePercent = Math.max(0, Math.min(100, Number(score || 0) / 10));

  return (
    <section
      aria-label="GigScore"
      style={{
        border: '1px solid var(--border-light)',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
        background: 'var(--bg-card)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div
          role="meter"
          aria-valuemin={0}
          aria-valuemax={1000}
          aria-valuenow={Number(score) || 0}
          aria-label={`GigScore ${score}`}
          style={{
            width: 132,
            height: 132,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            background: `conic-gradient(${tier.color} ${scorePercent}%, #e5e7eb ${scorePercent}% 100%)`,
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              background: 'var(--bg-main)',
              display: 'grid',
              placeItems: 'center',
              textAlign: 'center',
              border: guildTier ? `4px solid ${guildTier.color}` : '4px solid transparent',
            }}
          >
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-main)' }}>{score}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>GigScore</div>
            </div>
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 210 }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-main)' }}>
            {tierDisplay.publicName} tier
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {tierDisplay.description}
          </div>
          {guildTier && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              Guild tier: {guildTier.name}
            </div>
          )}
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Today</div>
              <div style={{ fontWeight: 700 }}>{digest.finalizedDelta >= 0 ? '+' : ''}{digest.finalizedDelta}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pending</div>
              <div style={{ fontWeight: 700 }}>{digest.pendingDelta >= 0 ? '+' : ''}{digest.pendingDelta}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Next tier</div>
              <div style={{ fontWeight: 700 }}>{digest.pointsToNextTier || 'Top tier'}</div>
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
            {digest.recoveryAdvice}
          </div>
          {visibleEvents.length > 0 && (
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              {visibleEvents.slice(0, 3).map((event, index) => (
                <div
                  key={`${event.bookingId || 'event'}-${event.reasonCode || index}-${index}`}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    background: 'var(--bg-soft)',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, fontWeight: 800 }}>
                    <span>{event.reasonText || event.reasonCode}</span>
                    <span style={{ color: Number(event.delta) < 0 ? 'var(--error)' : 'var(--success)' }}>
                      {Number(event.delta) >= 0 ? '+' : ''}{Number(event.delta || 0)}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                    {event.improvementAdvice}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
