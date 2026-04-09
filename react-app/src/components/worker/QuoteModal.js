import React, { useState } from 'react';

export default function QuoteModal({ job, onClose, onSubmit }) {
  const [price, setPrice] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!price) return alert('Please enter your price');
    setSubmitting(true);
    try {
      await onSubmit({ price, message, jobId: job.id });
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onClose(); }, 2500);
    } catch (e) {
      alert('Failed to send quote: ' + e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        {success ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 48 }}>🎉</div>
            <h3 style={{ color: '#059669', marginTop: 12 }}>Quote Sent!</h3>
            <p style={{ color: '#6B7280', fontSize: 14 }}>
              You'll be notified if your quote is accepted.
            </p>
          </div>
        ) : (
          <>
            <div className="modal-title">Send Quote</div>

            {/* Job Summary */}
            <div style={{
              background: '#F5F3FF',
              borderRadius: 10,
              padding: 12,
              marginBottom: 16,
              border: '1px solid #E9D5FF'
            }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                {job.title || job.serviceType}
              </div>
              <div style={{ fontSize: 13, color: '#6B7280' }}>
                📍 {job.area} {job.budget ? `· Budget: ₹${job.budget}` : ''}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Your Price (₹) *
              </label>
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                placeholder="Enter your price"
                style={{
                  width: '100%',
                  border: '1.5px solid #E9D5FF',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: 15,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
                Message to Customer
              </label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Introduce yourself and explain why you're the right person for this job..."
                rows={3}
                style={{
                  width: '100%',
                  border: '1.5px solid #E9D5FF',
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontSize: 14,
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={onClose}>
                Cancel
              </button>
              <button className="btn-primary" style={{ flex: 1 }} onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Sending...' : '📨 Send Quote'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
