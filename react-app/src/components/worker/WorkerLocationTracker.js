import React from 'react';
import { useWorkerLocation } from '../../context/WorkerLocationContext';

/**
 * WorkerLocationTracker — displays the worker's live location tracking status
 * on the worker dashboard while the worker is active.
 *
 * Shows:
 * - Current tracking status (tracking / at location / left location / closed)
 * - Reach time and left time when available
 * - Distance to work location (if provided)
 * - Warning when location sharing is stopped
 */
export default function WorkerLocationTracker() {
  const ctx = useWorkerLocation();

  // Context may be null if not wrapped in WorkerLocationProvider
  if (!ctx) return null;

  const {
    tracking,
    locationStatus,
    reachTime,
    leftTime,
    isAtWorkLocation,
    error,
  } = ctx;

  // Don't render anything when idle
  if (locationStatus === 'idle' && !tracking) return null;

  const formatTime = (date) => {
    if (!date) return '—';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const statusConfig = {
    tracking: {
      icon: '📡',
      label: 'Tracking Location',
      color: '#2563EB',
      bg: '#EFF6FF',
      border: '#BFDBFE',
      description: 'Your location is being tracked. Head to the work location.',
    },
    at_location: {
      icon: '✅',
      label: 'At Work Location',
      color: '#059669',
      bg: '#ECFDF5',
      border: '#A7F3D0',
      description: 'You are at the work location. Time is being recorded.',
    },
    left_location: {
      icon: '🚶',
      label: 'Left Work Location',
      color: '#D97706',
      bg: '#FFFBEB',
      border: '#FDE68A',
      description: 'You have left the work location.',
    },
    closed: {
      icon: '🔴',
      label: 'Location Closed',
      color: '#DC2626',
      bg: '#FEF2F2',
      border: '#FECACA',
      description: 'Location sharing stopped. Please enable location to continue tracking.',
    },
    stopped: {
      icon: '⏹️',
      label: 'Tracking Stopped',
      color: '#6B7280',
      bg: '#F9FAFB',
      border: '#E5E7EB',
      description: 'Location tracking has been stopped.',
    },
  };

  const status = statusConfig[locationStatus] || statusConfig.tracking;

  return (
    <div
      style={{
        background: status.bg,
        border: `1px solid ${status.border}`,
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 20 }}>{status.icon}</span>
        <span style={{ fontWeight: 700, fontSize: 15, color: status.color }}>
          {status.label}
        </span>
        {tracking && (
          <span
            style={{
              marginLeft: 'auto',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: isAtWorkLocation ? '#34D399' : '#60A5FA',
              boxShadow: `0 0 0 3px ${isAtWorkLocation ? 'rgba(52,211,153,0.3)' : 'rgba(96,165,250,0.3)'}`,
              animation: 'pulse 2s infinite',
            }}
          />
        )}
      </div>

      <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 10px' }}>
        {status.description}
      </p>

      {(reachTime || leftTime) && (
        <div
          style={{
            display: 'flex',
            gap: 16,
            fontSize: 13,
            background: 'rgba(255,255,255,0.7)',
            borderRadius: 8,
            padding: '8px 12px',
          }}
        >
          <div>
            <span style={{ color: '#6B7280' }}>Reach Time: </span>
            <strong style={{ color: '#059669' }}>{formatTime(reachTime)}</strong>
          </div>
          <div>
            <span style={{ color: '#6B7280' }}>Left Time: </span>
            <strong style={{ color: '#D97706' }}>{formatTime(leftTime)}</strong>
          </div>
          {reachTime && leftTime && (
            <div>
              <span style={{ color: '#6B7280' }}>Duration: </span>
              <strong style={{ color: '#2563EB' }}>
                {Math.round((leftTime.getTime() - reachTime.getTime()) / 60000)} min
              </strong>
            </div>
          )}
        </div>
      )}

      {error && (
        <p style={{ fontSize: 12, color: '#DC2626', marginTop: 8, marginBottom: 0 }}>
          ⚠️ {error}
        </p>
      )}
    </div>
  );
}
