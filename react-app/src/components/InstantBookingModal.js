/**
 * InstantBookingModal — Two-step modal for instant worker booking.
 *
 * Step 1: Show worker name, service type, rating, price breakdown (NO phone number)
 * Step 2: Payment confirmation with full pricing breakdown + Pay button
 *
 * After payment → creates instant booking with 'assigned' status → triggers tracking
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

      // Replace date objects with serverTimestamp
      const firestoreBooking = {
        ...bookingData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'bookings'), firestoreBooking);

      // Mark worker as unavailable after booking
      try {
        await updateDoc(doc(db, 'worker_availability', worker.workerId), {
          isAvailable: false,
          lastBookingId: docRef.id,
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Non-critical: worker availability update failed
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

  // Step 3: Success view
  if (paymentSuccess) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>✅</div>
            <h2 style={{ margin: '0 0 8px', fontSize: 20, color: '#059669' }}>Booking Confirmed!</h2>
            <p style={{ color: '#6B7280', fontSize: 14, margin: '0 0 16px' }}>
              {displayInfo.workerName} ({displayInfo.serviceType}) has been assigned to you.
              You can track their live location from My Bookings.
            </p>
            <div style={{
              background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10,
              padding: 14, marginBottom: 16,
            }}>
              <div style={{ fontSize: 13, color: '#15803D', fontWeight: 600 }}>
                🚶 Worker is now on the way
              </div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                Live tracking will appear in your My Bookings page
              </div>
            </div>
            <button
              onClick={onClose}
              className="btn-primary"
              style={{ width: '100%', padding: 14 }}
            >
              View My Bookings →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[1, 2].map((s) => (
            <div
              key={s}
              style={{
                flex: 1, height: 4, borderRadius: 2,
                background: step >= s ? '#A259FF' : '#E9D5FF',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>

        {step === 1 ? (
          /* ─── STEP 1: Worker Details (no phone) ─── */
          <>
            <div className="modal-title">Available Worker</div>

            {/* Worker card */}
            <div style={{
              background: 'linear-gradient(135deg, #F5F3FF, #EDE9FE)',
              borderRadius: 14, padding: 20, marginBottom: 16,
              border: '1px solid #E9D5FF',
            }}>
              {/* Avatar + Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #7C3AED, #A259FF)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 24, fontWeight: 700, color: 'white',
                }}>
                  {(displayInfo.workerName || 'W').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#1F1144' }}>
                    {displayInfo.workerName}
                  </div>
                  <div style={{ fontSize: 14, color: '#7C3AED', fontWeight: 600 }}>
                    {displayInfo.serviceType}
                  </div>
                  <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
                    ⭐ {displayInfo.rating > 0 ? displayInfo.rating.toFixed(1) : 'New worker'}
                    {displayInfo.area && ` · 📍 ${displayInfo.area}`}
                    {displayInfo.distanceKm != null && ` · ${displayInfo.distanceKm}km away`}
                  </div>
                </div>
              </div>

              {/* Fixed rate display */}
              <div style={{
                background: 'white', borderRadius: 10, padding: 14,
                textAlign: 'center', border: '1px solid #E9D5FF',
              }}>
                <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>Fixed Day Rate</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#059669' }}>
                  ₹{displayInfo.fixedRate.toLocaleString('en-IN')}
                  <span style={{ fontSize: 14, fontWeight: 500, color: '#6B7280' }}>/day</span>
                </div>
              </div>
            </div>

            <div style={{
              background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10,
              padding: 12, marginBottom: 16, fontSize: 13, color: '#92400E',
            }}>
              ℹ️ Worker's phone number will be shared after booking is confirmed.
            </div>

            {error && (
              <div style={{
                background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8,
                padding: 10, marginBottom: 12, fontSize: 13, color: '#B91C1C',
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} className="btn-secondary" style={{ flex: 1, padding: 12 }}>
                Cancel
              </button>
              <button onClick={handleProceedToPayment} className="btn-primary" style={{ flex: 1, padding: 12 }}>
                Proceed to Pay →
              </button>
            </div>
          </>
        ) : (
          /* ─── STEP 2: Payment Gate ─── */
          <>
            <div className="modal-title">Payment</div>

            {/* Pricing breakdown */}
            <div style={{
              background: '#F9FAFB', borderRadius: 12,
              padding: 16, marginBottom: 16,
              border: '1px solid #E5E7EB',
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#1F1144', marginBottom: 12 }}>
                Price Breakdown
              </div>

              {[
                { label: `${displayInfo.serviceType} — ${displayInfo.workerName}`, value: `₹${displayInfo.fixedRate.toLocaleString('en-IN')}` },
                { label: 'Platform Fee (15%)', value: `₹${displayInfo.platformFee.toLocaleString('en-IN')}` },
                { label: 'Payment Charges (2%)', value: `₹${displayInfo.paymentCharge.toLocaleString('en-IN')}` },
              ].map((row) => (
                <div key={row.label} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '6px 0', fontSize: 14, color: '#374151',
                  borderBottom: '1px solid #F3F4F6',
                }}>
                  <span>{row.label}</span>
                  <span style={{ fontWeight: 600 }}>{row.value}</span>
                </div>
              ))}

              <div style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '10px 0 0', fontSize: 16, fontWeight: 700,
                color: '#059669',
              }}>
                <span>Total</span>
                <span>₹{displayInfo.finalPrice.toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* Payment method placeholder */}
            <div style={{
              background: '#F5F3FF', borderRadius: 10, padding: 14,
              marginBottom: 16, border: '1px solid #E9D5FF',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#7C3AED', marginBottom: 8 }}>
                💳 Payment Method
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['UPI', 'Debit Card', 'Credit Card', 'Net Banking'].map((method) => (
                  <div key={method} style={{
                    background: 'white', border: '1px solid #E9D5FF',
                    borderRadius: 8, padding: '6px 12px',
                    fontSize: 12, color: '#1F1144', fontWeight: 500,
                  }}>
                    {method}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6 }}>
                Secure payment powered by Gigtos Pay
              </div>
            </div>

            {/* What happens next */}
            <div style={{
              background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10,
              padding: 12, marginBottom: 16, fontSize: 13,
            }}>
              <div style={{ fontWeight: 600, color: '#15803D', marginBottom: 4 }}>After payment:</div>
              <div style={{ color: '#374151' }}>
                ✓ Worker gets notified instantly<br />
                ✓ You can track the worker live<br />
                ✓ Worker's contact shared after arrival
              </div>
            </div>

            {error && (
              <div style={{
                background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 8,
                padding: 10, marginBottom: 12, fontSize: 13, color: '#B91C1C',
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} className="btn-secondary" style={{ flex: 1, padding: 12 }}>
                ← Back
              </button>
              <button
                onClick={handlePay}
                disabled={paying}
                style={{
                  flex: 2, padding: 14, fontSize: 16, fontWeight: 700,
                  background: paying
                    ? '#9CA3AF'
                    : 'linear-gradient(135deg, #059669, #10B981)',
                  color: 'white', border: 'none', borderRadius: 10,
                  cursor: paying ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
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
