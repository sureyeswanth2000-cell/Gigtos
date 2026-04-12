import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main style={{ maxWidth: 480, margin: '80px auto', padding: '0 24px', textAlign: 'center' }} aria-label="Page Not Found">
      <div style={{ fontSize: 80, marginBottom: 16 }} aria-hidden="true">🔍</div>
      <h1 style={{ fontSize: 32, fontWeight: 800, color: '#1f2937', marginBottom: 8 }}>404 – Page Not Found</h1>
      <p style={{ color: '#6b7280', fontSize: 16, marginBottom: 28, lineHeight: 1.6 }}>
        Oops! The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        style={{ display: 'inline-block', padding: '12px 32px', background: '#A259FF', color: '#fff', borderRadius: 10, fontWeight: 700, fontSize: 16, textDecoration: 'none' }}
        aria-label="Go back to Gigtos home page"
      >
        Go Home
      </Link>
    </main>
  );
}
