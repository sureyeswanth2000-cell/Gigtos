/**
 * Two-step instant booking modal.
 * MVP launch uses direct worker payment after completed work; online payment stays paused.
 */
import React, { useState, useCallback } from 'react';
import { auth, db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { getWorkerDisplayInfo, createInstantBooking } from '../utils/instantBooking';
import { usePricingSettings } from '../utils/usePricingSettings';

const sheetStyle = {
  background: 'var(--bg-card)',
  borderRadius: '24px',
  padding: '24px',
  maxWidth: '440px',
  width: '100%',
  border: '1px solid var(--border-light)',
  boxShadow: 'var(--shadow-lg)',
  maxHeight: '90vh',
  overflowY: 'auto',
};

const buttonBase = {
  flex: 1,
  padding: '14px',
  borderRadius: '14px',
  fontWeight: '800',
  cursor: 'pointer',
};

export default function InstantBookingModal({ worker, userData, onClose, onBooked }) {
  const [step, setStep] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [error, setError] = useState(null);
  const pricingSettings = usePricingSettings();

  const displayInfo = getWorkerDisplayInfo(worker, pricingSettings);
  if (!displayInfo) return null;

  const handleProceed = () => {
    if (!auth.currentUser) {
      setError('Please log in to book a service.');
      return;
    }
    setStep(2);
    setError(null);
  };

  const handleConfirmBooking = useCallback(async () => {
    if (!auth.currentUser) return;
    setConfirming(true);
    setError(null);

    try {
      const bookingData = createInstantBooking({
        userId: auth.currentUser.uid,
        userName: userData?.name || auth.currentUser.displayName || '',
        userPhone: userData?.phone || '',
        userAddress: userData?.address || '',
        userCity: userData?.locationCity || '',
        worker,
      }, pricingSettings);

      const firestoreBooking = {
        ...bookingData,
        status: bookingData.status || 'assigned',
        paymentProvider: 'mvp_direct',
        paymentStatus: 'pay_worker_after_work',
        paymentFlow: 'direct_worker_payment_after_work',
        consumerPaymentInstruction: 'Pay the worker directly after the work is completed and accepted.',
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
        // Availability update is best-effort; booking remains the source of truth.
      }

      setBookingSuccess(true);
      onBooked?.({
        bookingId: docRef.id,
        worker,
        pricing: bookingData.acceptedQuote?.pricing,
        paymentFlow: 'mvp_direct',
      });
    } catch (err) {
      setError(err.message || 'Booking failed. Please try again.');
      setConfirming(false);
    }
  }, [worker, userData, onBooked, pricingSettings]);

  const overlay = (children) => (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        zIndex: 10000,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()} style={sheetStyle}>
        {children}
      </div>
    </div>
  );

  if (bookingSuccess) {
    return overlay(
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 42, marginBottom: 16, fontWeight: 900, color: 'var(--success)' }}>OK</div>
        <h2 style={{ margin: '0 0 8px', fontSize: 24, color: 'var(--success)', fontWeight: '800' }}>
          Booking Confirmed
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: 15, margin: '0 0 24px', lineHeight: 1.5 }}>
          <strong>{displayInfo.workerName}</strong> is assigned. Pay the worker directly after work is completed and accepted.
        </p>
        <div style={{
          background: 'var(--success-bg)',
          border: '1px solid var(--success)',
          borderRadius: 16,
          padding: 16,
          marginBottom: 24,
          textAlign: 'left',
        }}>
          <div style={{ fontSize: 14, color: 'var(--success)', fontWeight: 700 }}>Worker is assigned</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
            Amount after work: INR {displayInfo.finalPrice.toLocaleString('en-IN')}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '16px',
            background: 'var(--primary-purple)',
            color: '#fff',
            border: 'none',
            borderRadius: '14px',
            fontWeight: '800',
            cursor: 'pointer',
          }}
        >
          View My Bookings
        </button>
      </div>
    );
  }

  return overlay(
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[1, 2].map((s) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: step >= s ? 'var(--primary-purple)' : 'var(--border-light)',
            }}
          />
        ))}
      </div>

      {step === 1 ? (
        <>
          <h2 style={{ fontSize: 20, fontWeight: '850', color: 'var(--text-main)', margin: '0 0 16px' }}>
            Available Professional
          </h2>

          <div style={{
            background: 'var(--bg-main)',
            borderRadius: 20,
            padding: 20,
            marginBottom: 16,
            border: '1px solid var(--border-light)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <div style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--primary-purple), #a78bfa)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                fontWeight: 800,
                color: 'white',
              }}>
                {(displayInfo.workerName || 'W').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-main)' }}>{displayInfo.workerName}</div>
                <div style={{ fontSize: 14, color: 'var(--primary-purple)', fontWeight: 700 }}>{displayInfo.serviceType}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                  Rating: {displayInfo.rating > 0 ? displayInfo.rating.toFixed(1) : 'New worker'}
                  {displayInfo.area && ` | ${displayInfo.area}`}
                </div>
              </div>
            </div>

            <div style={{
              background: 'var(--bg-card)',
              borderRadius: 16,
              padding: 16,
              textAlign: 'center',
              border: '1px solid var(--border-light)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 }}>
                Launch MVP price
              </div>
              <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--success)' }}>
                INR {displayInfo.finalPrice.toLocaleString('en-IN')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                Pay directly to worker after completion.
              </div>
            </div>
          </div>

          <div style={{
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning)',
            borderRadius: 12,
            padding: 12,
            marginBottom: 20,
            fontSize: 13,
            color: 'var(--warning)',
            fontWeight: '600',
          }}>
            Direct contact details are shared after booking confirmation.
          </div>

          {error && <div style={{ color: 'var(--error)', fontWeight: 700, marginBottom: 16 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={onClose} style={{ ...buttonBase, background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-main)' }}>
              Cancel
            </button>
            <button onClick={handleProceed} style={{ ...buttonBase, background: 'var(--primary-purple)', color: '#fff', border: 'none' }}>
              View Price
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 style={{ fontSize: 20, fontWeight: '850', color: 'var(--text-main)', margin: '0 0 16px' }}>
            Confirm Booking
          </h2>

          <div style={{
            background: 'var(--bg-main)',
            borderRadius: 18,
            padding: 20,
            marginBottom: 20,
            border: '1px solid var(--border-light)',
          }}>
            {[
              { label: `Service: ${displayInfo.serviceType}`, value: `INR ${displayInfo.fixedRate.toLocaleString('en-IN')}` },
              { label: 'Gigtos launch fee', value: `INR ${displayInfo.platformFee.toLocaleString('en-IN')}` },
              ...(displayInfo.paymentCharge > 0 ? [{ label: 'Payment/insurance charges', value: `INR ${displayInfo.paymentCharge.toLocaleString('en-IN')}` }] : []),
            ].map((row) => (
              <div key={row.label} style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '10px 0',
                fontSize: 14,
                color: 'var(--text-main)',
                borderBottom: '1px solid var(--border-light)',
              }}>
                <span style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                <span style={{ fontWeight: 700 }}>{row.value}</span>
              </div>
            ))}

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 0 0', fontSize: 20, fontWeight: 900, color: 'var(--success)' }}>
              <span>Pay after work</span>
              <span>INR {displayInfo.finalPrice.toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div style={{
            background: 'var(--success-bg)',
            border: '1px solid var(--success)',
            borderRadius: 14,
            padding: 16,
            marginBottom: 20,
            fontSize: 13,
          }}>
            <div style={{ fontWeight: 800, color: 'var(--success)', marginBottom: 6 }}>MVP payment rule</div>
            <div style={{ color: 'var(--text-main)' }}>
              No online payment is collected during launch. Pay the worker directly only after the work is completed and accepted.
            </div>
          </div>

          {error && <div style={{ color: 'var(--error)', fontWeight: 700, marginBottom: 16 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setStep(1)} style={{ ...buttonBase, background: 'transparent', border: '1px solid var(--border-light)', color: 'var(--text-main)' }}>
              Back
            </button>
            <button
              onClick={handleConfirmBooking}
              disabled={confirming}
              style={{
                ...buttonBase,
                flex: 1.5,
                background: confirming ? 'var(--text-muted)' : 'linear-gradient(135deg, var(--success), #10B981)',
                color: 'white',
                border: 'none',
                cursor: confirming ? 'not-allowed' : 'pointer',
              }}
            >
              {confirming ? 'Confirming...' : 'Confirm booking'}
            </button>
          </div>
        </>
      )}
    </>
  );
}
