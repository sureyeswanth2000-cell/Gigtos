import React from 'react';

export default function WorkerStatsCard({ stats }) {
  const items = [
    { label: 'Completed', value: stats.completed ?? 0, icon: '✅' },
    { label: 'Pending', value: stats.pending ?? 0, icon: '⏳' },
    { label: 'Rating', value: stats.rating ? `${stats.rating}★` : 'N/A', icon: '⭐' },
    { label: 'Earnings', value: stats.earnings ? `₹${stats.earnings}` : '₹0', icon: '💰' },
  ];

  return (
    <div className="stats-row">
      {items.map(item => (
        <div key={item.label} className="stat-card">
          <span style={{ fontSize: 20 }}>{item.icon}</span>
          <span className="stat-value">{item.value}</span>
          <span className="stat-label">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
