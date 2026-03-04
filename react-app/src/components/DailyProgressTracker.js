/**
 * DAILY PROGRESS TRACKER COMPONENT
 *
 * Renders a timeline view for multi-day job bookings, including:
 * - Daily notes from workers
 * - Photo gallery per day
 * - Daily confirmation status by the user
 * - Confirmation history
 *
 * Props:
 *   booking        - the booking object from Firestore
 *   isOwner        - boolean: whether the current user owns this booking
 *   onConfirmDay   - async callback(date) called when user confirms a day
 */

import React, { useState } from 'react';

export default function DailyProgressTracker({ booking, isOwner, onConfirmDay }) {
  const [confirmingDate, setConfirmingDate] = useState(null);
  const [qualityRating, setQualityRating] = useState(3);
  const [confirmNote, setConfirmNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!booking.isMultiDay) return null;

  const startDate = booking.startDate;
  const endDate = booking.endDate;
  const jobDuration = booking.jobDuration || 1;

  const dailyNotes = booking.dailyNotes || [];
  const dailyPhotos = booking.dailyPhotos || [];
  const dailyConfirmations = booking.dailyConfirmations || [];

  // Build a list of date strings for each day in the job
  const dayList = [];
  if (startDate) {
    const start = startDate.toDate ? startDate.toDate() : new Date(startDate);
    for (let i = 0; i < jobDuration; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      dayList.push(d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }));
    }
  }

  const notesForDay = (dateLabel) =>
    dailyNotes.filter(n => n.dateLabel === dateLabel);

  const photosForDay = (dateLabel) =>
    dailyPhotos.filter(p => p.dateLabel === dateLabel);

  const confirmationForDay = (dateLabel) =>
    dailyConfirmations.find(c => c.dateLabel === dateLabel);

  const handleConfirm = async (dateLabel) => {
    if (!onConfirmDay) return;
    setSubmitting(true);
    try {
      await onConfirmDay(dateLabel, qualityRating, confirmNote);
      setConfirmingDate(null);
      setQualityRating(3);
      setConfirmNote('');
    } catch (e) {
      alert('Confirmation failed: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmedDays = dailyConfirmations.length;
  const totalDays = jobDuration;
  const allConfirmed = confirmedDays >= totalDays && totalDays > 0;

  return (
    <div style={{ marginTop: '12px' }}>
      {/* Summary bar */}
      <div style={{
        padding: '10px 14px', background: allConfirmed ? '#d1fae5' : '#f0f4ff',
        borderRadius: '8px', border: `1px solid ${allConfirmed ? '#86efac' : '#c7d2fe'}`,
        fontSize: '13px', marginBottom: '12px', fontWeight: 'bold',
        color: allConfirmed ? '#065f46' : '#3730a3'
      }}>
        📅 Multi-Day Job — {confirmedDays}/{totalDays} days confirmed
        {allConfirmed && ' ✅ All days confirmed!'}
      </div>

      {/* Per-day timeline */}
      {dayList.map((dateLabel, idx) => {
        const notes = notesForDay(dateLabel);
        const photos = photosForDay(dateLabel);
        const confirmation = confirmationForDay(dateLabel);
        const isConfirmed = !!confirmation;

        return (
          <div key={idx} style={{
            border: `1px solid ${isConfirmed ? '#86efac' : '#e2e8f0'}`,
            borderRadius: '8px', padding: '12px', marginBottom: '8px',
            background: isConfirmed ? '#f0fdf4' : 'white'
          }}>
            {/* Day header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#374151' }}>
                Day {idx + 1} — {dateLabel}
              </div>
              <span style={{
                padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold',
                background: isConfirmed ? '#bbf7d0' : '#e5e7eb',
                color: isConfirmed ? '#065f46' : '#6b7280'
              }}>
                {isConfirmed ? '✓ Confirmed' : 'Pending'}
              </span>
            </div>

            {/* Worker notes */}
            {notes.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', marginBottom: '4px' }}>📋 Worker Notes:</div>
                {notes.map((n, i) => (
                  <div key={i} style={{ fontSize: '12px', color: '#374151', padding: '4px 8px', background: '#f8fafc', borderRadius: '4px', marginBottom: '2px' }}>
                    {n.note}
                  </div>
                ))}
              </div>
            )}

            {/* Photos */}
            {photos.length > 0 && (
              <div style={{ marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#6b7280', marginBottom: '4px' }}>📸 Photos:</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {photos.map((p, i) => (
                    <a key={i} href={p.url} target="_blank" rel="noreferrer">
                      <img src={p.url} alt={p.label || 'photo'} title={p.label || ''}
                        style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #e2e8f0' }} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Confirmation info */}
            {isConfirmed && (
              <div style={{ fontSize: '12px', color: '#065f46', background: '#dcfce7', padding: '6px 10px', borderRadius: '6px', marginBottom: '8px' }}>
                ✓ Confirmed — Quality: {'★'.repeat(confirmation.workQuality || 0)}
                {confirmation.notes && <div style={{ marginTop: '2px', color: '#166534' }}>"{confirmation.notes}"</div>}
              </div>
            )}

            {/* Confirm day button (owner only, not yet confirmed) */}
            {isOwner && !isConfirmed && booking.status === 'in_progress' && (
              <>
                {confirmingDate === dateLabel ? (
                  <div style={{ marginTop: '8px', padding: '10px', background: '#fefce8', border: '1px solid #fde047', borderRadius: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#854d0e', marginBottom: '8px' }}>Confirm Day {idx + 1} Work</div>
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontSize: '11px', color: '#666', marginBottom: '4px' }}>Work Quality:</div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {[1, 2, 3, 4, 5].map(s => (
                          <span key={s} onClick={() => setQualityRating(s)}
                            style={{ fontSize: '20px', cursor: 'pointer', color: s <= qualityRating ? '#f59e0b' : '#d1d5db' }}>★</span>
                        ))}
                      </div>
                    </div>
                    <textarea
                      value={confirmNote}
                      onChange={e => setConfirmNote(e.target.value)}
                      placeholder="Optional note about today's work..."
                      rows={2}
                      style={{ width: '100%', padding: '6px', border: '1px solid #fde047', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box', marginBottom: '8px' }}
                    />
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setConfirmingDate(null)} disabled={submitting}
                        style={{ flex: 1, padding: '7px', background: '#e5e7eb', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                        Cancel
                      </button>
                      <button onClick={() => handleConfirm(dateLabel)} disabled={submitting}
                        style={{ flex: 1, padding: '7px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                        {submitting ? '⏳...' : '✓ Confirm'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setConfirmingDate(dateLabel)}
                    style={{ padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                    ✓ Confirm Day {idx + 1}
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
