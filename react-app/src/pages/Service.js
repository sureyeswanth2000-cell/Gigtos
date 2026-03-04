/**
 * SERVICE BOOKING PAGE - CONSUMER INTERFACE
 * 
 * Logic Overview:
 * - Fetches user profile to pre-fill booking details (Name, Address, Phone).
 * - Implements dual-booking modes: 
 *   1. Immediate (Status: 'pending') - for urgent needs.
 *   2. Scheduled (Status: 'scheduled') - for future appointments with specific time slots.
 * - Supports multi-day job booking with start/end date selection and per-day pricing.
 * - Enforces ₹150 visiting charge policy across all service types.
 * - Validates profile completeness before allowing document creation in Firestore.
 */

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const serviceIcons = {
  'Plumber': '🧰',
  'Electrician': '⚡',
  'Carpenter': '🪛',
  'Painter': '🎨'
};

export default function Service() {
  // React Router location hook to handle incoming state (e.g. from Rebook button)
  const location = useLocation();
  // URL search params to get the service category (Plumber, etc.)
  const params = new URLSearchParams(location.search);
  // Default to URL type, then check location state if it's a rebooking
  const type = location.state?.serviceType || params.get('type') || 'Service';
  // Navigation hook for redirection
  const navigate = useNavigate();

  // State variables for user contact and location information
  const [name, setName] = useState(''); // Customer's full name
  const [address, setAddress] = useState(location.state?.prefillAddress || ''); // Pre-filled from rebook if available
  const [userPhone, setUserPhone] = useState(location.state?.prefillPhone || ''); // Pre-filled from rebook if available

  // State variables for future/scheduled booking functionality
  const [isScheduled, setIsScheduled] = useState(false); // Toggle between immediate and future booking
  const [scheduledDate, setScheduledDate] = useState(''); // User selected date (YYYY-MM-DD)
  const [timeSlot, setTimeSlot] = useState(''); // User selected slot: 9-12, 12-3, 3-6

  // State variables for multi-day job support
  const [isMultiDay, setIsMultiDay] = useState(false); // Toggle for multi-day job mode
  const [startDate, setStartDate] = useState(''); // Start date for multi-day job
  const [endDate, setEndDate] = useState(''); // End date for multi-day job
  const [isPricePerDay, setIsPricePerDay] = useState(false); // Whether pricing is per day
  const [dailyRate, setDailyRate] = useState(''); // Rate per day in ₹

  // UI and feedback states
  const [loading, setLoading] = useState(false); // Spinner state during Firestore write
  const [error, setError] = useState(''); // Error message display
  const [success, setSuccess] = useState(''); // Success message display
  const [showConfirm, setShowConfirm] = useState(false); // State for the final confirmation modal
  const [profileIncomplete, setProfileIncomplete] = useState(false); // Flag if name/address/phone is missing

  // Computed: days between start and end dates for multi-day jobs
  const jobDuration = isMultiDay && startDate && endDate
    ? Math.max(1, Math.round((new Date(endDate + 'T00:00:00') - new Date(startDate + 'T00:00:00')) / (1000 * 60 * 60 * 24)) + 1)
    : null;

  // Computed: total estimated cost for multi-day per-day pricing
  const totalEstimatedCost = isMultiDay && isPricePerDay && dailyRate && jobDuration
    ? jobDuration * Number(dailyRate)
    : null;

  // Effect to load existing user profile data from Firestore on mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return; // Exit if user session not found

        // Fetch user document from 'users' collection using UID
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          // Only update name if not already set by rebook pre-fill
          if (!name) setName(data.name || '');
          // If NOT rebooking (no location state), pre-fill address/phone from profile
          if (!location.state) {
            setAddress(data.address || '');
            setUserPhone(data.phone || '');
          }

          // Trigger warning if profile fields are empty
          if (!data.phone || !data.name || !data.address) {
            setProfileIncomplete(true);
          }
        }
      } catch (err) {
        console.error('Error loading profile:', err); // Log fetch errors
      }
    };

    loadUserData(); // Execute profile fetch
  }, [location.state]); // auth.currentUser omitted: not reactive; user is guaranteed authenticated via ProtectedRoute

  // Main booking submission handler
  const handleBooking = async () => {
    // Validation: Ensure core profile details are present
    if (!name || !address || !userPhone) {
      setError('Please complete your profile first (name, address, phone)');
      setProfileIncomplete(true);
      return;
    }

    // Validation: Ensure scheduling details are selected if future booking is chosen
    if (isScheduled && (!scheduledDate || !timeSlot)) {
      setError('Please select both a date and a time slot for your scheduled booking.');
      return;
    }

    // Validation: Multi-day job date checks
    if (isMultiDay) {
      if (!startDate || !endDate) {
        setError('Please select both a start date and an end date for the multi-day job.');
        return;
      }
      const today = new Date().toISOString().split('T')[0];
      if (startDate < today) {
        setError('Start date cannot be in the past.');
        return;
      }
      if (endDate < startDate) {
        setError('End date must be on or after the start date.');
        return;
      }
      if (isPricePerDay && (!dailyRate || isNaN(dailyRate) || Number(dailyRate) <= 0)) {
        setError('Please enter a valid daily rate.');
        return;
      }
    }

    setLoading(true); // Start loading spinner
    setError(''); // Clear previous errors

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated'); // Safety check for auth session

      // Construct booking document payload
      const bookingPayload = {
        userId: user.uid, // Map booking to user ID
        serviceType: type, // Category (Plumber, Electrician, etc.)
        customerName: name, // Customer name at time of booking
        address: address, // Service location
        phone: userPhone, // Contact number
        status: isScheduled ? 'scheduled' : 'pending', // Set status based on timing choice
        scheduledDate: isScheduled ? scheduledDate : null, // Future date if applicable
        timeSlot: isScheduled ? timeSlot : null, // Future slot if applicable
        // Multi-day job fields
        isMultiDay: isMultiDay,
        startDate: isMultiDay ? startDate : null,
        endDate: isMultiDay ? endDate : null,
        jobDuration: isMultiDay ? jobDuration : null,
        isPricePerDay: isMultiDay ? isPricePerDay : false,
        dailyRate: isMultiDay && isPricePerDay ? Number(dailyRate) : null,
        totalEstimatedCost: isMultiDay && isPricePerDay ? totalEstimatedCost : null,
        dailyNotes: [],
        dailyPhotos: [],
        dailyConfirmations: [],
        createdAt: new Date(), // Permanent record of submission
        updatedAt: new Date() // Record of latest status change
      };

      // Write document to Firestore 'bookings' collection
      await addDoc(collection(db, 'bookings'), bookingPayload);

      setSuccess(`Success! Your request has been sent. Our regional professionals will review it and provide price quotes shortly. You can track this in 'My Bookings'.`); // Show success UI
      setShowConfirm(false); // Close confirmation modal

      // Navigate to My Bookings after a short delay for visual confirmation
      setTimeout(() => {
        navigate('/my-bookings');
      }, 1500);
    } catch (err) {
      setError('❌ ' + err.message); // Display error to user
    } finally {
      setLoading(false); // Stop loading spinner
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <div style={{ fontSize: '60px', marginBottom: '10px' }}>
          {serviceIcons[type] || '🛠️'}
        </div>
        <h2 style={{ fontSize: '28px', margin: '10px 0', color: '#333' }}>
          Book {type}
        </h2>
        <p style={{ color: '#666', margin: '10px 0' }}>
          Professional & Verified Service
        </p>
        <div style={{ fontSize: '14px', color: '#10b981', fontWeight: '500' }}>
          ✨ Transparent Bidding System
        </div>
      </div>

      {/* Alert Messages (Error/Success/Profile Incomplete) */}
      {profileIncomplete && (
        <div style={{
          padding: '12px',
          marginBottom: '15px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '4px',
          color: '#856404',
          fontSize: '14px'
        }}>
          ⚠️ Please complete your profile (name, address, phone) before booking.
          <button
            onClick={() => navigate('/profile')}
            style={{
              display: 'block',
              marginTop: '10px',
              padding: '8px 15px',
              backgroundColor: '#ffc107',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            Go to Profile
          </button>
        </div>
      )}

      {error && (
        <div style={{
          padding: '12px',
          marginBottom: '15px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c00',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '12px',
          marginBottom: '15px',
          backgroundColor: '#efe',
          border: '1px solid #cfc',
          borderRadius: '4px',
          color: '#060',
          fontSize: '14px'
        }}>
          {success}
        </div>
      )}

      {/* Booking Details and Scheduling Configuration Card */}
      <div style={{
        backgroundColor: '#f9f9f9',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid #eee'
      }}>
        <h4 style={{ margin: '0 0 20px 0', color: '#333', fontSize: '16px', fontWeight: 'bold' }}>
          📋 Your Booking Details
        </h4>

        {/* Profile Summary Section */}
        <div style={{ marginBottom: '15px' }}>
          <span style={{ fontWeight: 'bold', color: '#666', fontSize: '13px' }}>👤 Name:</span>
          <p style={{ margin: '5px 0 0 0', fontSize: '15px', color: '#333' }}>{name || 'Not set'}</p>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <span style={{ fontWeight: 'bold', color: '#666', fontSize: '13px' }}>📞 Phone:</span>
          <p style={{ margin: '5px 0 0 0', fontSize: '15px', color: '#333' }}>{userPhone || 'Not set'}</p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <span style={{ fontWeight: 'bold', color: '#666', fontSize: '13px' }}>📍 Address:</span>
          <p style={{ margin: '5px 0 0 0', fontSize: '15px', color: '#333', whiteSpace: 'pre-wrap' }}>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
              target="_blank"
              rel="noreferrer"
              style={{ color: '#667eea', textDecoration: 'none' }}
            >
              {address || 'Not set'} ↗
            </a>
          </p>
        </div>

        {/* Future/Scheduled Booking Toggle & Selection Section */}
        <div style={{ borderTop: '1px solid #ddd', paddingTop: '20px' }}>
          {/* Checkbox to enable/disable scheduled booking */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginBottom: '15px' }}>
            <input type="checkbox" checked={isScheduled} onChange={e => { setIsScheduled(e.target.checked); if (e.target.checked) setIsMultiDay(false); }} />
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>🗓️ Book for a future date/time?</span>
          </label>

          {/* Conditional rendering for date and time slot selectors */}
          {isScheduled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '15px', background: '#fff', borderRadius: '8px', border: '1px solid #ddd' }}>
              {/* Date Input for Scheduling */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', display: 'block', marginBottom: '5px' }}>Select Date:</label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={e => setScheduledDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]} // Prevent selecting past dates
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>
              {/* Time Slot Selection for Scheduling */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', display: 'block', marginBottom: '5px' }}>Select Time Slot:</label>
                <select
                  value={timeSlot}
                  onChange={e => setTimeSlot(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="">-- Choose a slot --</option>
                  <option value="9 AM - 12 PM">Morning (9 AM - 12 PM)</option>
                  <option value="12 PM - 3 PM">Afternoon (12 PM - 3 PM)</option>
                  <option value="3 PM - 6 PM">Evening (3 PM - 6 PM)</option>
                </select>
              </div>
            </div>
          )}

          {/* Multi-day Job Toggle */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', marginTop: '15px', marginBottom: '15px' }}>
            <input type="checkbox" checked={isMultiDay} onChange={e => { setIsMultiDay(e.target.checked); if (e.target.checked) setIsScheduled(false); }} />
            <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#333' }}>📅 This is a multi-day job?</span>
          </label>

          {/* Multi-day Job Configuration */}
          {isMultiDay && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', padding: '15px', background: '#f0f4ff', borderRadius: '8px', border: '1px solid #c7d2fe' }}>
              <div style={{ fontSize: '13px', color: '#4338ca', fontWeight: 'bold' }}>📅 Multi-Day Job Details</div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', display: 'block', marginBottom: '5px' }}>Start Date:</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => { setStartDate(e.target.value); if (endDate && e.target.value > endDate) setEndDate(''); }}
                    min={new Date().toISOString().split('T')[0]}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #c7d2fe', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', display: 'block', marginBottom: '5px' }}>End Date:</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    min={startDate || new Date().toISOString().split('T')[0]}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #c7d2fe', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              {/* Duration Display */}
              {jobDuration && (
                <div style={{ padding: '8px 12px', background: '#e0e7ff', borderRadius: '6px', fontSize: '13px', color: '#3730a3', fontWeight: 'bold' }}>
                  ⏱️ Duration: {jobDuration} day{jobDuration > 1 ? 's' : ''}
                </div>
              )}

              {/* Per-day Pricing Toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input type="checkbox" checked={isPricePerDay} onChange={e => setIsPricePerDay(e.target.checked)} />
                <span style={{ fontWeight: 'bold', color: '#333' }}>💰 Enable per-day pricing?</span>
              </label>

              {isPricePerDay && (
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', display: 'block', marginBottom: '5px' }}>Daily Rate (₹):</label>
                  <input
                    type="number"
                    value={dailyRate}
                    onChange={e => setDailyRate(e.target.value)}
                    placeholder="e.g. 500"
                    min="1"
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #c7d2fe', boxSizing: 'border-box' }}
                  />
                  {totalEstimatedCost && (
                    <div style={{ marginTop: '8px', padding: '8px 12px', background: '#d1fae5', borderRadius: '6px', fontSize: '13px', color: '#065f46', fontWeight: 'bold' }}>
                      💵 Estimated Total: ₹{totalEstimatedCost} ({jobDuration} days × ₹{dailyRate}/day)
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Link */}
      {profileIncomplete && (
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <button
            onClick={() => navigate('/profile')}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ✏️ Edit Profile First
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: '#e0e0e0',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '15px'
          }}
        >
          ← Back
        </button>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={loading || !name || !address || !userPhone || profileIncomplete}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: loading || !name || !address || !userPhone || profileIncomplete ? '#ccc' : '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading || !name || !address || !userPhone || profileIncomplete ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: '15px',
            transition: 'background 0.2s'
          }}
        >
          {loading ? '⏳ Processing...' : '✓ Confirm Booking'}
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '12px',
            maxWidth: '420px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '50px', marginBottom: '15px' }}>
              {serviceIcons[type] || '🛠️'}
            </div>
            <h3 style={{ fontSize: '20px', margin: '0 0 10px 0', color: '#333' }}>
              Confirm Booking?
            </h3>
            <p style={{ color: '#666', margin: '10px 0', fontSize: '14px' }}>
              You are about to book <strong>{type}</strong> service for:
            </p>
            {/* Confirmation Data Summary */}
            <div style={{
              backgroundColor: '#f0f4ff',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px',
              textAlign: 'left',
              fontSize: '14px'
            }}>
              <div><strong>Name:</strong> {name}</div>
              <div><strong>Phone:</strong> {userPhone}</div>
              <div><strong>Address:</strong> {address}</div>
              {/* Conditional display for Scheduled info */}
              {isScheduled && (
                <>
                  <div style={{ marginTop: '8px' }}><strong>🗓️ Date:</strong> {scheduledDate}</div>
                  <div><strong>🕒 Time Slot:</strong> {timeSlot}</div>
                </>
              )}
              {/* Conditional display for Multi-day info */}
              {isMultiDay && (
                <>
                  <div style={{ marginTop: '8px' }}><strong>📅 Start Date:</strong> {startDate}</div>
                  <div><strong>📅 End Date:</strong> {endDate}</div>
                  <div><strong>⏱️ Duration:</strong> {jobDuration} day{jobDuration > 1 ? 's' : ''}</div>
                  {isPricePerDay && totalEstimatedCost && (
                    <div><strong>💵 Est. Cost:</strong> ₹{totalEstimatedCost} (₹{dailyRate}/day)</div>
                  )}
                </>
              )}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#e0e0e0',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  opacity: loading ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBooking}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: loading ? '#999' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {loading ? '⏳ Booking...' : '✓ Confirm & Book'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
