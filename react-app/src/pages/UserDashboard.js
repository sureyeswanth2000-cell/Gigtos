import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const CATEGORIES = [
  { name: 'Plumber', icon: '🚰' },
  { name: 'Electrician', icon: '⚡' },
  { name: 'Carpenter', icon: '🪚' },
  { name: 'Painter', icon: '🎨' },
  { name: 'Driver', icon: '🚗' },
  { name: 'Helper', icon: '🤝' },
  { name: 'Mason', icon: '🧱' },
  { name: 'Cleaner', icon: '🧹' }
];

const MOCK_BOOKINGS = [
  { id: 'b1', service: 'Plumbing', worker: 'Suresh R.', date: '15 Jan 2025', status: 'Completed', amount: '₹650' },
  { id: 'b2', service: 'Electrical', worker: 'Prasad M.', date: '22 Jan 2025', status: 'Scheduled', amount: '₹1200' },
  { id: 'b3', service: 'Carpentry', worker: 'Ganesh K.', date: '2 Feb 2025', status: 'Pending', amount: '₹2500' },
];

const STATS = [
  { label: 'Total Services', value: '8', icon: '📊' },
  { label: 'Saved Money', value: '₹450', icon: '💰' },
  { label: 'Pending', value: '2', icon: '⏳' },
];

const statusColors = {
  Completed: { bg: 'var(--success-bg)', text: 'var(--success)', border: 'var(--success)' },
  Scheduled: { bg: 'var(--primary-purple-glow)', text: 'var(--primary-purple)', border: 'var(--primary-purple)' },
  Pending: { bg: 'var(--warning-bg)', text: 'var(--warning)', border: 'var(--warning)' },
};

export default function UserDashboard() {
  const navigate = useNavigate();
  const [lastWorkType, setLastWorkType] = useState('');
  const [loading] = useState(false);

  useEffect(() => {
    setLastWorkType(localStorage.getItem('last_work_type') || '');
  }, []);

  if (loading) {
    return (
      <div style={{ 
        height: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-main)', color: 'var(--text-muted)', fontSize: 18 
      }}>
        ⏳ Loading your dashboard...
      </div>
    );
  }

  return (
    <div className="dash-container" style={{ 
      minHeight: '100vh', 
      background: 'var(--bg-main)',
      padding: '40px 20px',
    }}>
      <main style={{ maxWidth: 1000, margin: '0 auto' }}>
        
        {/* WELCOME HEADER */}
        <header style={{ marginBottom: 40, textAlign: 'center' }}>
          <h1 style={{ 
            fontSize: 'var(--font-xl)', 
            fontWeight: 800, 
            color: 'var(--text-main)', 
            marginBottom: 8,
            letterSpacing: '-1px'
          }}>
            Welcome Back
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>
            Manage your bookings and discover local experts.
          </p>
        </header>

        {/* QUICK ACTION: REBOOK LAST SERVICE */}
        {lastWorkType && (
          <div style={{ 
            background: 'var(--primary-purple-glow)', 
            backdropFilter: 'var(--glass-blur)',
            border: '1px solid var(--primary-purple)', 
            borderRadius: 'var(--radius-lg)', 
            padding: '24px', 
            marginBottom: 40, 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            boxShadow: '0 8px 32px var(--primary-purple-glow)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ 
                width: 56, height: 56, borderRadius: 'var(--radius-md)', 
                background: 'var(--primary-purple)', display: 'flex', 
                alignItems: 'center', justifyContent: 'center', fontSize: 28 
              }}>
                ✨
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)', fontSize: 18 }}>Need another {lastWorkType}?</p>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>Quickly book a verified professional near you.</p>
              </div>
            </div>
            <button 
              onClick={() => navigate('/service')} 
              className="btn-primary"
            >
              Book Again
            </button>
          </div>
        )}

        {/* STATS TILES */}
        <div style={{ 
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', 
          gap: 24, marginBottom: 48 
        }}>
          {STATS.map(s => (
            <div key={s.label} className="job-card" style={{ 
              padding: 24,
              display: 'flex', alignItems: 'center', gap: 20
            }}>
              <div style={{ 
                width: 56, height: 56, borderRadius: 'var(--radius-md)', background: 'var(--primary-purple-glow)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28
              }}>
                {s.icon}
              </div>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-main)' }}>{s.value}</div>
                <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* BROWSE CATEGORIES */}
        <section style={{ marginBottom: 56 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>Discover Services</h2>
            <button style={{ background: 'none', border: 'none', color: 'var(--primary-purple)', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>View All</button>
          </div>
          <div style={{ 
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
            gap: 20 
          }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat.name}
                onClick={() => { localStorage.setItem('last_work_type', cat.name); navigate('/service'); }}
                className="job-card"
                style={{ 
                  aspectRatio: '1', display: 'flex', flexDirection: 'column', 
                  alignItems: 'center', justifyContent: 'center', gap: 12,
                  cursor: 'pointer', padding: 16,
                }}
              >
                <span style={{ fontSize: 40 }} className="job-card-icon">{cat.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-main)' }}>{cat.name}</span>
              </button>
            ))}
          </div>
        </section>

        {/* RECENT ACTIVITY */}
        <section>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-main)', marginBottom: 24 }}>Recent Bookings</h2>
          <div className="job-card" style={{ padding: 0, overflow: 'hidden' }}>
            {MOCK_BOOKINGS.length === 0 ? (
              <div style={{ padding: 64, textAlign: 'center' }}>
                <div style={{ fontSize: 64, marginBottom: 16 }}>📭</div>
                <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: 18 }}>No active bookings found.</p>
                <button 
                  onClick={() => navigate('/service')}
                  className="btn-primary"
                  style={{ marginTop: 24 }}
                >
                  Start Booking
                </button>
              </div>
            ) : (
              <div>
                {MOCK_BOOKINGS.map((b, i) => (
                  <div key={b.id} style={{ 
                    padding: '24px 32px', display: 'flex', 
                    justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: i === MOCK_BOOKINGS.length - 1 ? 'none' : '1px solid var(--border-light)',
                    transition: 'background var(--motion-base)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-soft)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                      <div style={{ 
                        width: 52, height: 52, borderRadius: 'var(--radius-md)', background: 'var(--bg-main)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
                        border: '1px solid var(--border-light)'
                      }}>
                        {CATEGORIES.find(c => b.service.includes(c.name))?.icon || '🛠️'}
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-main)', fontSize: 16 }}>{b.service}</p>
                        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>{b.worker} · {b.date}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: '0 0 8px 0', fontWeight: 800, color: 'var(--text-main)', fontSize: 18 }}>{b.amount}</p>
                      <span style={{ 
                        backgroundColor: statusColors[b.status].bg, 
                        color: statusColors[b.status].text,
                        border: `1px solid ${statusColors[b.status].border}`,
                        borderRadius: 'var(--radius-pill)', 
                        padding: '4px 12px', 
                        fontSize: 12, 
                        fontWeight: 700, 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.05em'
                      }}>
                        {b.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

      </main>

      <style>{`
        ::-webkit-scrollbar { height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--border-light); border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }
      `}</style>
    </div>
  );
}
