/**
 * InstantBookingModal — Two-step modal for instant worker booking.
 */
import React, { useState, useCallback } from 'react';
import { auth, db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { getWorkerDisplayInfo, createInstantBooking } from '../utils/instantBooking';

export default function InstantBookingModal({ worker, userData, onClose, onBooked }) {
  const [step, setStep] = useState(1);
  const [paying, setPaying] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [error, setError] = useState(null);

  const displayInfo = getWorkerDisplayInfo(worker);
  if (!displayInfo) return null;

  const handleProceedToPayment = () => {
    if (!auth.currentUser) {
      setError('Please log in to book a service.');
      return;
    }
    setStep(2);
    setError(null);
  };

  const handlePay = useCallback(async () => {
    if (!auth.currentUser) return;
    setPaying(true);
    setError(null);

    try {
      const bookingData = createInstantBooking({
        userId: auth.currentUser.uid,
        userName: userData?.name || auth.currentUser.displayName || '',
        userPhone: userData?.phone || '',
        userAddress: userData?.address || '',
        userCity: userData?.locationCity || '',
        worker,
      });

      const firestoreBooking = {
        ...bookingData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'bookings'), firestoreBooking);

      try {
        await updateDoc(doc(db, 'worker_availability', worker.workerId), {
          isAvailable: false,
          lastBookingId: docRef.id,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Non-critical
      }

      setPaymentSuccess(true);
      if (onBooked) {
        onBooked({ bookingId: docRef.id, worker, pricing: bookingData.acceptedQuote.pricing });
      }
    } catch (err) {
      setError('Payment failed. Please try again.');
      setPaying(false);
    }
  }, [worker, userData, onBooked]);

  if (paymentSuccess) {
    return (
      <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '32px', maxWidth: '440px', width: '100%', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-lg)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 24, color: 'var(--success)', fontWeight: '800' }}>Booking Confirmed!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 15, margin: '0 0 24px', lineHeight: 1.5 }}>
              <strong>{displayInfo.workerName}</strong> has been assigned. You can track their arrival from your bookings.
            </p>
            <div style={{
              background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 16,
              padding: 16, marginBottom: 24, textAlign: 'left'
            }}>
              <div style={{ fontSize: 14, color: 'var(--success)', fontWeight: 700 }}>
                🚶 Worker is now on the way
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                Estimated arrival: 15-30 mins
              </div>
            </div>
            <button
              onClick={onClose}
              style={{ width: '100%', padding: '16px', background: 'var(--primary-purple)', color: '#fff', border: 'none', borderRadius: '14px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px var(--primary-purple-glow)' }}
            >
              View My Bookings →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 10000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg-card)', borderRadius: '24px', padding: '24px', maxWidth: '440px', width: '100%', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[1, 2].map((s) => (
            <div
              key={s}
              style={{
                flex: 1, height: 4, borderRadius: 2,
                background: step >= s ? 'var(--primary-purple)' : 'var(--border-light)',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>

        {step === 1 ? (
          <>
            <h2 style={{ fontSize: 20, fontWeight: '850', color: 'var(--text-main)', margin: '0 0 16px' }}>Available Professional</h2>

            {/* Worker card */}
            <div style={{
              background: 'var(--bg-main)',
              borderRadius: 20, padding: 20, marginBottom: 16,
              border: '1px solid var(--border-light)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--primary-purple), #a78bfa)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, fontWeight: 800, color: 'white',
                  boxShadow: '0 4px 12px var(--primary-purple-glow)'
                }}>
                  {(displayInfo.workerName || 'W').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)' }}>
                    {displayInfo.workerName}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--primary-purple)', fontWeight: 700 }}>
                    {displayInfo.serviceType}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                    ⭐ {displayInfo.rating > 0 ? displayInfo.rating.toFixed(1) : 'New worker'}
                    {displayInfo.area && ` · 📍 ${displayInfo.area}`}
                  </div>
                </div>
              </div>

              {/* Fixed rate display */}
              <div style={{
                background: 'var(--bg-card)', borderRadius: 16, padding: 16,
                textAlign: 'center', border: '1px solid var(--border-light)',
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Daily Professional Rate</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--success)' }}>
                  ₹{displayInfo.fixedRate.toLocaleString('en-IN')}
                  <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-muted)', marginLeft: 4 }}>/day</span>
                </div>
              </div>
            </div>

            <div style={{
              background: 'var(--warning-bg)', border: '1px solid var(--warning)', borderRadius: 12,
              padding: 12, marginBottom: 20, fontSize: 13, color: 'var(--warning)', fontWeight: '500'
            }}>
              ℹ️ Direct contact details shared after confirmation.
            </div>

            {error && (
              <div style={{
                background: 'var(--error-bg)', border: '1px solid var(--error)', borderRadius: 12,
                padding: 12, marginBottom: 16, fontSize: 13, color: 'var(--error)', fontWeight: '600'
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={onClose} style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-main)', fontWeight: '700', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleProceedToPayment} style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'var(--primary-purple)', color: '#fff', border: 'none', fontWeight: '800', cursor: 'pointer', boxShadow: '0 4px 12px var(--primary-purple-glow)' }}>
                View Price →
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: 20, fontWeight: '850', color: 'var(--text-main)', margin: '0 0 16px' }}>Price Confirmation</h2>

            <div style={{
              background: 'var(--bg-main)', borderRadius: 18,
              padding: 20, marginBottom: 20,
              border: '1px solid var(--border-light)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Booking Details
              </div>

              {[
                { label: `Service: ${displayInfo.serviceType}`, value: `₹${displayInfo.fixedRate.toLocaleString('en-IN')}` },
                { label: 'Platform Fee (15%)', value: `₹${displayInfo.platformFee.toLocaleString('en-IN')}` },
                { label: 'Insurance & Taxes', value: `₹${displayInfo.paymentCharge.toLocaleString('en-IN')}` },
              ].map((row) => (
                <div key={row.label} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '10px 0', fontSize: 14, color: 'var(--text-main)',
                  borderBottom: '1px solid var(--border-light)',
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                  <span style={{ fontWeight: 700 }}>{row.value}</span>
                </div>
              ))}

              <div style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '16px 0 0', fontSize: 20, fontWeight: 900,
                color: 'var(--success)',
              }}>
                <span>Total Payable</span>
                <span>₹{displayInfo.finalPrice.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div style={{
              background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 14,
              padding: 16, marginBottom: 20, fontSize: 13,
            }}>
              <div style={{ fontWeight: 800, color: 'var(--success)', marginBottom: 6 }}>Booking Benefits:</div>
              <ul style={{ color: 'var(--text-main)', margin: 0, paddingLeft: 18, listStyle: 'none', display: 'grid', gap: '4px' }}>
                <li>✓ Instant professional matching</li>
                <li>✓ 24/7 Support assistance</li>
                <li>✓ Secure digital payment</li>
              </ul>
            </div>

            {error && (
              <div style={{
                background: 'var(--error-bg)', border: '1px solid var(--error)', borderRadius: 12,
                padding: 12, marginBottom: 16, fontSize: 13, color: 'var(--error)', fontWeight: '600'
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={() => setStep(1)} style={{ flex: 1, padding: '14px', borderRadius: '14px', background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-main)', fontWeight: '700', cursor: 'pointer' }}>
                ← Back
              </button>
              <button
                onClick={handlePay}
                disabled={paying}
                style={{
                  flex: 1.5, padding: '14px', fontSize: 16, fontWeight: '900',
                  background: paying
                    ? 'var(--text-muted)'
                    : 'linear-gradient(135deg, var(--success), #10B981)',
                  color: 'white', border: 'none', borderRadius: '14px',
                  cursor: paying ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: paying ? 'none' : '0 4px 16px var(--success-bg)'
                }}
              >
                {paying ? '⏳ Processing...' : `Pay ₹${displayInfo.finalPrice.toLocaleString('en-IN')}`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
