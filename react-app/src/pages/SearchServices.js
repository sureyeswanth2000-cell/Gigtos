/**
 * SEARCH SERVICES PAGE - CONSUMER INTERFACE
 *
 * Allows users to search for available services and workers by:
 * - Service type (Plumber, Electrician, Carpenter, Painter)
 * - Location / address keyword
 * - Price range (min / max)
 * - Date availability (future date)
 * - Worker rating filter
 *
 * Results display worker details and a "Quick Book" shortcut that
 * pre-fills the Service booking page with the selected worker.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';

const SERVICE_TYPES = ['All', 'Plumber', 'Electrician', 'Carpenter', 'Painter'];

const serviceIcons = {
  Plumber: '🧰',
  Electrician: '⚡',
  Carpenter: '🪛',
  Painter: '🎨',
};

const RATING_OPTIONS = [
  { label: 'Any Rating', value: 0 },
  { label: '⭐ 1+ Stars', value: 1 },
  { label: '⭐⭐ 2+ Stars', value: 2 },
  { label: '⭐⭐⭐ 3+ Stars', value: 3 },
  { label: '⭐⭐⭐⭐ 4+ Stars', value: 4 },
  { label: '⭐⭐⭐⭐⭐ 5 Stars', value: 5 },
];

export default function SearchServices() {
  const navigate = useNavigate();

  // ── Filter state ──────────────────────────────────────────────────────────
  const [serviceType, setServiceType] = useState('All');
  const [locationKeyword, setLocationKeyword] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [availableDate, setAvailableDate] = useState('');
  const [minRating, setMinRating] = useState(0);

  // ── Data state ────────────────────────────────────────────────────────────
  const [workers, setWorkers] = useState([]);
  const [filteredWorkers, setFilteredWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // ── Fetch all active/approved workers in real-time ────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'gig_workers'),
      where('status', '==', 'active')
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setWorkers(snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching workers:', err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  // ── Apply filters whenever workers or filter values change ─────────────────
  useEffect(() => {
    let results = [...workers];

    // Service type filter
    if (serviceType !== 'All') {
      results = results.filter((w) => w.gigType === serviceType);
    }

    // Location keyword (matches worker's area/address field)
    if (locationKeyword.trim()) {
      const kw = locationKeyword.trim().toLowerCase();
      results = results.filter(
        (w) =>
          (w.area || '').toLowerCase().includes(kw) ||
          (w.address || '').toLowerCase().includes(kw) ||
          (w.name || '').toLowerCase().includes(kw)
      );
    }

    // Price range filter (based on worker's dailyRate field)
    if (minPrice !== '') {
      results = results.filter((w) => (w.dailyRate || 0) >= Number(minPrice));
    }
    if (maxPrice !== '') {
      results = results.filter((w) => (w.dailyRate || 0) <= Number(maxPrice));
    }

    // Rating filter
    if (minRating > 0) {
      results = results.filter((w) => (w.avgRating || 0) >= minRating);
    }

    // Date availability: exclude workers busy on the selected date
    if (availableDate) {
      results = results.filter((w) => {
        if (!w.bookedDates || !Array.isArray(w.bookedDates)) return true;
        return !w.bookedDates.includes(availableDate);
      });
    }

    setFilteredWorkers(results);
  }, [workers, serviceType, locationKeyword, minPrice, maxPrice, minRating, availableDate]);

  // ── Quick Book: navigate to Service page pre-filled for this worker ────────
  const handleQuickBook = (worker) => {
    if (!auth.currentUser) {
      navigate('/auth?mode=user');
      return;
    }
    navigate(`/service?type=${encodeURIComponent(worker.gigType)}`, {
      state: { preferredWorkerId: worker.id, preferredWorkerName: worker.name },
    });
  };

  const resetFilters = () => {
    setServiceType('All');
    setLocationKeyword('');
    setMinPrice('');
    setMaxPrice('');
    setAvailableDate('');
    setMinRating(0);
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '20px' }}>
      {/* ── Page Header ── */}
      <div style={{ textAlign: 'center', marginBottom: '28px' }}>
        <h1 style={{ fontSize: '26px', margin: '0 0 8px 0', color: '#333' }}>
          🔍 Find Services Near You
        </h1>
        <p style={{ color: '#666', fontSize: '15px', margin: 0 }}>
          Search, filter, and instantly book verified professionals
        </p>
      </div>

      {/* ── Search Bar Row ── */}
      <div style={{
        display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap',
      }}>
        {/* Location / keyword input */}
        <input
          type="text"
          placeholder="📍 Search by location or worker name…"
          value={locationKeyword}
          onChange={(e) => setLocationKeyword(e.target.value)}
          style={{
            flex: '1 1 240px', padding: '10px 14px', fontSize: '14px',
            border: '1px solid #ddd', borderRadius: '8px', outline: 'none',
          }}
        />

        {/* Service type quick selector */}
        <select
          value={serviceType}
          onChange={(e) => setServiceType(e.target.value)}
          style={{
            padding: '10px 14px', fontSize: '14px',
            border: '1px solid #ddd', borderRadius: '8px',
            background: '#fff', cursor: 'pointer',
          }}
        >
          {SERVICE_TYPES.map((t) => (
            <option key={t} value={t}>{t === 'All' ? '🛠️ All Services' : `${serviceIcons[t]} ${t}`}</option>
          ))}
        </select>

        {/* Toggle filters panel */}
        <button
          onClick={() => setShowFilters((v) => !v)}
          style={{
            padding: '10px 18px', fontSize: '14px', fontWeight: 'bold',
            backgroundColor: showFilters ? '#667eea' : '#f0f4ff',
            color: showFilters ? '#fff' : '#667eea',
            border: '1px solid #667eea', borderRadius: '8px', cursor: 'pointer',
          }}
        >
          ⚙️ Filters {showFilters ? '▲' : '▼'}
        </button>
      </div>

      {/* ── Expanded Filter Panel ── */}
      {showFilters && (
        <div style={{
          backgroundColor: '#f9f9f9', border: '1px solid #e0e0e0',
          borderRadius: '10px', padding: '20px', marginBottom: '20px',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px',
        }}>
          {/* Price range */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', display: 'block', marginBottom: '6px' }}>
              💰 Price Range (₹/day)
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="number"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                min="0"
                style={{ width: '80px', padding: '8px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '13px' }}
              />
              <span style={{ color: '#999' }}>–</span>
              <input
                type="number"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                min="0"
                style={{ width: '80px', padding: '8px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '13px' }}
              />
            </div>
          </div>

          {/* Date availability */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', display: 'block', marginBottom: '6px' }}>
              📅 Available On Date
            </label>
            <input
              type="date"
              value={availableDate}
              onChange={(e) => setAvailableDate(e.target.value)}
              min={today}
              style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '13px', width: '100%', boxSizing: 'border-box' }}
            />
          </div>

          {/* Rating filter */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', display: 'block', marginBottom: '6px' }}>
              ⭐ Minimum Rating
            </label>
            <select
              value={minRating}
              onChange={(e) => setMinRating(Number(e.target.value))}
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '6px', fontSize: '13px', background: '#fff' }}
            >
              {RATING_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Reset */}
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button
              onClick={resetFilters}
              style={{
                padding: '8px 16px', fontSize: '13px', cursor: 'pointer',
                backgroundColor: '#fee2e2', color: '#dc2626',
                border: '1px solid #fecaca', borderRadius: '6px', fontWeight: 'bold',
              }}
            >
              ✕ Reset Filters
            </button>
          </div>
        </div>
      )}

      {/* ── Results Summary ── */}
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
        <span style={{ fontSize: '14px', color: '#666' }}>
          {loading ? 'Loading…' : `${filteredWorkers.length} worker${filteredWorkers.length !== 1 ? 's' : ''} found`}
        </span>
        {(serviceType !== 'All' || locationKeyword || minPrice || maxPrice || availableDate || minRating > 0) && (
          <span style={{ fontSize: '13px', color: '#667eea', cursor: 'pointer', textDecoration: 'underline' }} onClick={resetFilters}>
            Clear all filters
          </span>
        )}
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#999', fontSize: '16px' }}>
          ⏳ Loading available workers…
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && filteredWorkers.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          backgroundColor: '#f9f9f9', borderRadius: '12px', border: '1px solid #eee',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <h3 style={{ color: '#555', margin: '0 0 8px 0' }}>No workers found</h3>
          <p style={{ color: '#888', fontSize: '14px', margin: 0 }}>
            Try adjusting your filters or search keyword.
          </p>
        </div>
      )}

      {/* ── Results Grid ── */}
      {!loading && filteredWorkers.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '18px',
        }}>
          {filteredWorkers.map((worker) => (
            <WorkerCard key={worker.id} worker={worker} onQuickBook={handleQuickBook} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Worker Result Card ──────────────────────────────────────────────────── */
function WorkerCard({ worker, onQuickBook }) {
  const rating = worker.avgRating || 0;
  const ratingStars = rating > 0 ? '⭐'.repeat(Math.round(rating)) : '—';
  const isBusy = worker.currentBookingId != null;
  const isTopListed = worker.isTopListed === true;

  return (
    <div style={{
      background: '#fff', borderRadius: '12px',
      border: '1px solid #e2e8f0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      {/* Card Header */}
      <div style={{
        padding: '16px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: '#fff', display: 'flex', alignItems: 'center', gap: '12px',
      }}>
        <div style={{ fontSize: '36px' }}>{serviceIcons[worker.gigType] || '🛠️'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 'bold', fontSize: '16px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {worker.name}
            {isTopListed && <span style={{ marginLeft: '6px', fontSize: '12px', backgroundColor: 'rgba(255,215,0,0.4)', padding: '2px 6px', borderRadius: '10px' }}>⭐ Top Listed</span>}
          </div>
          <div style={{ fontSize: '13px', opacity: 0.85 }}>{worker.gigType}</div>
        </div>
        {/* Availability badge */}
        <div style={{
          padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold',
          backgroundColor: isBusy ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)',
          border: `1px solid ${isBusy ? 'rgba(239,68,68,0.5)' : 'rgba(16,185,129,0.5)'}`,
          whiteSpace: 'nowrap',
        }}>
          {isBusy ? '🔴 Busy' : '🟢 Available'}
        </div>
      </div>

      {/* Card Body */}
      <div style={{ padding: '14px 16px', flex: 1 }}>
        {/* Rating row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <span style={{ fontSize: '13px' }}>{rating > 0 ? ratingStars : '—'}</span>
          <span style={{ fontSize: '12px', color: '#888' }}>
            {rating > 0 ? `${rating.toFixed(1)} / 5` : 'Not rated yet'}
            {worker.totalRatings > 0 && ` (${worker.totalRatings} reviews)`}
          </span>
        </div>

        {/* Contact / area */}
        {worker.area && (
          <div style={{ fontSize: '13px', color: '#555', marginBottom: '6px' }}>
            📍 {worker.area}
          </div>
        )}
        {worker.contact && (
          <div style={{ fontSize: '13px', color: '#555', marginBottom: '6px' }}>
            📞 {worker.contact}
          </div>
        )}

        {/* Daily rate if set */}
        {worker.dailyRate ? (
          <div style={{ fontSize: '13px', color: '#10b981', fontWeight: 'bold', marginBottom: '6px' }}>
            💰 ₹{worker.dailyRate}/day
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: '#888', marginBottom: '6px' }}>
            💰 Quote based
          </div>
        )}

        {/* Completed jobs */}
        {worker.completedJobs > 0 && (
          <div style={{ fontSize: '12px', color: '#888' }}>
            ✅ {worker.completedJobs} job{worker.completedJobs !== 1 ? 's' : ''} completed
          </div>
        )}
      </div>

      {/* Quick Book Button */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0' }}>
        <button
          onClick={() => onQuickBook(worker)}
          disabled={isBusy}
          style={{
            width: '100%', padding: '10px', fontWeight: 'bold', fontSize: '14px',
            backgroundColor: isBusy ? '#e0e0e0' : '#667eea',
            color: isBusy ? '#999' : '#fff',
            border: 'none', borderRadius: '8px',
            cursor: isBusy ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => { if (!isBusy) e.currentTarget.style.backgroundColor = '#5a6fd6'; }}
          onMouseLeave={(e) => { if (!isBusy) e.currentTarget.style.backgroundColor = '#667eea'; }}
        >
          {isBusy ? 'Currently Unavailable' : '⚡ Quick Book'}
        </button>
      </div>
    </div>
  );
}
