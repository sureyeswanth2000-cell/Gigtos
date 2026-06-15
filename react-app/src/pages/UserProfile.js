import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../firebase';
import './UserProfile.css';

const TABS = ['Posted Jobs', 'Saved Workers', 'Reviews', 'Wallet'];

function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value) {
  const ms = toMillis(value);
  return ms ? new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set';
}

function formatInr(value) {
  return `Rs. ${Math.round(Number(value || 0)).toLocaleString('en-IN')}`;
}

function titleForBooking(booking) {
  return booking.serviceName || booking.serviceType || booking.gigType || booking.serviceId || 'Service booking';
}

export default function UserProfile() {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [cashbacks, setCashbacks] = useState([]);

  useEffect(() => {
    let unsubscribeBookings = () => {};
    let unsubscribeCashbacks = () => {};
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      unsubscribeBookings();
      unsubscribeCashbacks();
      setError('');
      if (!user) {
        setProfile(null);
        setBookings([]);
        setCashbacks([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        const data = userSnap.exists() ? userSnap.data() : {};
        setProfile({
          uid: user.uid,
          name: data.name || user.displayName || 'Gigtos user',
          email: data.email || user.email || '',
          phone: data.phone || '',
          location: [data.locationArea, data.locationCity].filter(Boolean).join(', ') || 'Location not added',
          joinedAt: formatDate(data.createdAt || user.metadata?.creationTime),
          gigScoreTier: data.gigScoreTier || 'Launch',
          favoriteWorkerIds: Array.isArray(data.favoriteWorkerIds) ? data.favoriteWorkerIds : [],
        });
      } catch (err) {
        setError(err.message || 'Could not load profile.');
      }
      unsubscribeBookings = onSnapshot(
        query(collection(db, 'bookings'), where('userId', '==', user.uid)),
        snap => {
          setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        err => {
          setError(err.message || 'Could not load booking history.');
          setLoading(false);
        }
      );
      unsubscribeCashbacks = onSnapshot(
        query(collection(db, 'cashbacks'), where('userId', '==', user.uid)),
        snap => setCashbacks(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
        () => setCashbacks([])
      );
    });
    return () => {
      unsubscribeBookings();
      unsubscribeCashbacks();
      unsubscribeAuth();
    };
  }, []);

  const sortedBookings = useMemo(
    () => [...bookings].sort((a, b) => toMillis(b.createdAt || b.updatedAt) - toMillis(a.createdAt || a.updatedAt)),
    [bookings]
  );
  const completedJobs = bookings.filter((j) => String(j.status || '').toLowerCase() === 'completed').length;
  const reviews = bookings
    .filter(booking => booking.rating)
    .map(booking => ({
      id: booking.id,
      worker: booking.workerName || booking.assignedWorker || 'Worker',
      rating: Number(booking.rating || 0),
      comment: booking.reviewText || booking.ratingReview || 'No written review.',
      date: formatDate(booking.ratedAt || booking.updatedAt || booking.createdAt),
    }));
  const activeCashbacks = cashbacks.filter(c => c.cashbackStatus === 'active');
  const walletBalance = activeCashbacks.reduce((sum, c) => sum + Number(c.cashbackAmount || 0), 0);
  const lifetimeCashback = cashbacks.reduce((sum, c) => sum + Number(c.cashbackAmount || 0), 0);
  const savedWorkerIds = profile?.favoriteWorkerIds || [];

  if (loading) {
    return <div className="user-profile-loading" role="status">Loading profile...</div>;
  }

  if (error) {
    return <div className="user-profile-error" role="alert">{error}</div>;
  }

  if (!profile) {
    return <div className="user-profile-error" role="alert">Please sign in to view your profile.</div>;
  }

  return (
    <main className="user-profile-page" aria-label="User Profile">
      <section className="profile-hero-card">
        <div className="profile-hero-top">
          <div className="profile-avatar" aria-hidden="true">User</div>
          <div>
            <h1>{profile.name}</h1>
            <p>Member since {profile.joinedAt}</p>
          </div>
          <div className="profile-tier-chip">{profile.gigScoreTier} Member</div>
        </div>

        <dl className="profile-details-grid">
          <div><dt>Email</dt><dd>{profile.email || 'Not added'}</dd></div>
          <div><dt>Phone</dt><dd>{profile.phone || 'Not added'}</dd></div>
          <div><dt>Location</dt><dd>{profile.location}</dd></div>
          <div><dt>Completed Jobs</dt><dd>{completedJobs}</dd></div>
        </dl>

        <div className="wallet-strip">
          <div>
            <span>Wallet Balance</span>
            <strong>{formatInr(walletBalance)}</strong>
          </div>
          <div>
            <span>Lifetime Cashback</span>
            <strong>{formatInr(lifetimeCashback)}</strong>
          </div>
          <div>
            <span>Active Bookings</span>
            <strong>{bookings.filter(b => ['pending', 'matching', 'scheduled', 'assigned', 'in_progress'].includes(String(b.status || '').toLowerCase())).length}</strong>
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
          sortedBookings.length === 0 ? (
            <p className="profile-empty">No posted jobs yet.</p>
          ) : (
            <div className="profile-card-list">
              {sortedBookings.map(j => (
                <div key={j.id} className="profile-data-card">
                  <div>
                    <p className="profile-card-title">{titleForBooking(j)}</p>
                    <p className="profile-card-sub">{formatDate(j.createdAt || j.scheduledAt)}</p>
                  </div>
                  <span className={`status-pill ${String(j.status || '').toLowerCase() === 'completed' ? 'completed' : 'open'}`}>{String(j.status || 'pending').replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 1 && (
          savedWorkerIds.length === 0 ? (
            <p className="profile-empty">No saved workers yet.</p>
          ) : (
            <div className="profile-card-list">
              {savedWorkerIds.map(workerId => (
                <div key={workerId} className="profile-data-card">
                  <div>
                    <p className="profile-card-title">{workerId}</p>
                    <p className="profile-card-sub">Favorite worker ID</p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {activeTab === 2 && (
          reviews.length === 0 ? (
            <p className="profile-empty">No reviews yet.</p>
          ) : (
            <div className="profile-card-list">
              {reviews.map(r => (
                <div key={r.id} className="profile-data-card review-card">
                  <div className="review-header">
                    <strong>{r.worker}</strong>
                    <span className="review-stars">{'★'.repeat(r.rating)}{'☆'.repeat(Math.max(0, 5 - r.rating))}</span>
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
              {cashbacks.length === 0 ? (
                <p className="profile-empty">No wallet activity yet.</p>
              ) : (
                cashbacks.map((tx) => (
                  <div key={tx.id} className="wallet-tx-item">
                    <div>
                      <p>{tx.bookingId ? `Cashback - ${tx.bookingId}` : 'Cashback reward'}</p>
                      <span>{formatDate(tx.cashbackIssuedAt || tx.createdAt)}</span>
                    </div>
                    <strong className={tx.cashbackStatus === 'active' ? 'credit' : 'debit'}>
                      + {formatInr(tx.cashbackAmount)}
                    </strong>
                  </div>
                ))
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
