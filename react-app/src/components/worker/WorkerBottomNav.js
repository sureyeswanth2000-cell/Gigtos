import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function WorkerBottomNav() {
  const location = useLocation();
  const path = location.pathname;

  const links = [
    { to: '/worker/dashboard', icon: '🏠', label: 'Home' },
    { to: '/worker/open-work', icon: '📋', label: 'Work' },
    { to: '/worker/map', icon: '🗺️', label: 'Map' },
    { to: '/worker/history', icon: '🕐', label: 'History' },
    { to: '/worker/profile', icon: '👤', label: 'Profile' },
  ];

  return (
    <nav className="worker-bottom-nav">
      {links.map(link => (
        <Link
          key={link.to}
          to={link.to}
          className={path === link.to ? 'active' : ''}
        >
          <span className="nav-icon">{link.icon}</span>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
