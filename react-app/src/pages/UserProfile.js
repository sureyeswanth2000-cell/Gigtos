import React, { useMemo, useState } from 'react';
import './UserProfile.css';

const MOCK_PROFILE = {
  name: 'Ravi Kumar',
  email: 'ravi.kumar@example.com',
  phone: '+91 98765 43210',
  location: 'Kavali, Andhra Pradesh',
  joinedAt: 'January 2024',
};

const MOCK_POSTED_JOBS = [
  { id: '1', title: 'Plumbing Repair', status: 'Open', postedAt: '2 days ago' },
  { id: '2', title: 'Wall Painting', status: 'Completed', postedAt: '1 week ago' },
];

const MOCK_SAVED_WORKERS = [
  { id: 'w1', name: 'Suresh Reddy', service: 'Electrician', rating: 4.8 },
  { id: 'w2', name: 'Prasad M.', service: 'Plumber', rating: 4.5 },
];

const MOCK_REVIEWS = [
  { id: 'r1', worker: 'Suresh Reddy', rating: 5, comment: 'Excellent work, very professional.', date: '2 weeks ago' },
  { id: 'r2', worker: 'Prasad M.', rating: 4, comment: 'Good service, came on time.', date: '1 month ago' },
];

const MOCK_WALLET = {
  balance: 1240,
  lifetimeEarned: 4310,
  tier: 'Gold',
  nextTier: 'Platinum',
  nextTierProgress: 72,
  transactions: [
    { id: 't1', label: 'Cashback - Plumbing Repair', amount: 240, date: '3 days ago', type: 'credit' },
    { id: 't2', label: 'Wallet used - Painting', amount: 300, date: '1 week ago', type: 'debit' },
    { id: 't3', label: 'Referral bonus', amount: 500, date: '2 weeks ago', type: 'credit' },
  ],
};

const TABS = ['Posted Jobs', 'Saved Workers', 'Reviews', 'Wallet'];

export default function UserProfile() {
  const [activeTab, setActiveTab] = useState(0);
  const [loading] = useState(false);
  const [error] = useState('');
  const completedJobs = useMemo(
    () => MOCK_POSTED_JOBS.filter((j) => j.status === 'Completed').length,
    []
  );

  if (loading) {
    return <div className="user-profile-loading" role="status">Loading profile...</div>;
  }

  if (error) {
    return <div className="user-profile-error" role="alert">{error}</div>;
  }

  return (
    <main className="user-profile-page" aria-label="User Profile">
      <section className="profile-hero-card">
        <div className="profile-hero-top">
          <div className="profile-avatar" aria-hidden="true">👤</div>
          <div>
            <h1>{MOCK_PROFILE.name}</h1>
            <p>Member since {MOCK_PROFILE.joinedAt}</p>
          </div>
          <div className="profile-tier-chip">{MOCK_WALLET.tier} Member</div>
        </div>

        <dl className="profile-details-grid">
          <div><dt>Email</dt><dd>{MOCK_PROFILE.email}</dd></div>
          <div><dt>Phone</dt><dd>{MOCK_PROFILE.phone}</dd></div>
          <div><dt>Location</dt><dd>{MOCK_PROFILE.location}</dd></div>
          <div><dt>Completed Jobs</dt><dd>{completedJobs}</dd></div>
        </dl>

        <div className="wallet-strip">
          <div>
            <span>Wallet Balance</span>
            <strong>Rs. {MOCK_WALLET.balance.toLocaleString()}</strong>
          </div>
          <div>
            <span>Lifetime Cashback</span>
            <strong>Rs. {MOCK_WALLET.lifetimeEarned.toLocaleString()}</strong>
          </div>
          <div>
            <span>Next Tier</span>
            <strong>{MOCK_WALLET.nextTier}</strong>
          </div>
        </div>

        <div className="tier-progress-wrap">
          <div className="tier-progress-head">
            <span>Progress to {MOCK_WALLET.nextTier}</span>
            <span>{MOCK_WALLET.nextTierProgress}%</span>
          </div>
          <div className="tier-progress-track">
            <div className="tier-progress-fill" style={{ width: `${MOCK_WALLET.nextTierProgress}%` }} />
          </div>
        </div>
      </section>

      <div className="profile-tabs" role="tablist" aria-label="Profile sections">
        {TABS.map((tab, i) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === i}
            aria-controls={`tab-panel-${i}`}
            onClick={() => setActiveTab(i)}
            className={`profile-tab-btn ${activeTab === i ? 'active' : ''}`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`tab-panel-${activeTab}`} className="profile-tab-panel">
        {activeTab === 0 && (
          MOCK_POSTED_JOBS.length === 0 ? (
            <p className="profile-empty">No posted jobs yet.</p>
          ) : (
            <div className="profile-card-list">
              {MOCK_POSTED_JOBS.map(j => (
                <div key={j.id} className="profile-data-card">
                  <div>
                    <p className="profile-card-title">{j.title}</p>
                    <p className="profile-card-sub">{j.postedAt}</p>
                  </div>
                  <span className={`status-pill ${j.status === 'Open' ? 'open' : 'completed'}`}>{j.status}</span>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 1 && (
          MOCK_SAVED_WORKERS.length === 0 ? (
            <p className="profile-empty">No saved workers yet.</p>
          ) : (
            <div className="profile-card-list">
              {MOCK_SAVED_WORKERS.map(w => (
                <div key={w.id} className="profile-data-card">
                  <div>
                    <p className="profile-card-title">{w.name}</p>
                    <p className="profile-card-sub">{w.service}</p>
                  </div>
                  <span className="worker-rating">★ {w.rating}</span>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 2 && (
          MOCK_REVIEWS.length === 0 ? (
            <p className="profile-empty">No reviews yet.</p>
          ) : (
            <div className="profile-card-list">
              {MOCK_REVIEWS.map(r => (
                <div key={r.id} className="profile-data-card review-card">
                  <div className="review-header">
                    <strong>{r.worker}</strong>
                    <span className="review-stars">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                  </div>
                  <p className="review-comment">{r.comment}</p>
                  <p className="review-date">{r.date}</p>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 3 && (
          <section className="wallet-panel">
            <h3>Cashback Wallet Activity</h3>
            <div className="wallet-tx-list">
              {MOCK_WALLET.transactions.map((tx) => (
                <div key={tx.id} className="wallet-tx-item">
                  <div>
                    <p>{tx.label}</p>
                    <span>{tx.date}</span>
                  </div>
                  <strong className={tx.type === 'credit' ? 'credit' : 'debit'}>
                    {tx.type === 'credit' ? '+' : '-'} Rs. {tx.amount}
                  </strong>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
