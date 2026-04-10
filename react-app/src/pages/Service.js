import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from 'firebase/storage';
import { auth, db } from '../firebase';
import { useLocation as useUserLocation } from '../context/LocationContext';
import { suggestBudget, formatBudgetRange } from '../utils/aiBudgetSuggestion';
import './Service.css';

const serviceIcons = {
  Plumber: '🧰',
  Electrician: '⚡',
  Carpenter: '🪛',
  Painter: '🎨',
};

const professionalDirectory = {
  Plumber: [
    { id: 'pl-1', name: 'Rakesh Plumbing', rating: 4.8, jobs: 122, eta: '45 mins' },
    { id: 'pl-2', name: 'AquaFix Team', rating: 4.7, jobs: 96, eta: '1 hour' },
  ],
  Electrician: [
    { id: 'el-1', name: 'VoltCare Pro', rating: 4.8, jobs: 110, eta: '50 mins' },
    { id: 'el-2', name: 'SafeWire Services', rating: 4.6, jobs: 82, eta: '1.5 hours' },
  ],
  Carpenter: [
    { id: 'ca-1', name: 'WoodCraft Studio', rating: 4.7, jobs: 76, eta: '55 mins' },
    { id: 'ca-2', name: 'FixFrame Carpentry', rating: 4.5, jobs: 64, eta: '1 hour' },
  ],
  Painter: [
    { id: 'pa-1', name: 'FreshCoat Painters', rating: 4.8, jobs: 88, eta: '2 hours' },
    { id: 'pa-2', name: 'ColorEdge Team', rating: 4.6, jobs: 73, eta: '2.5 hours' },
  ],
};

const steps = [
  { id: 1, label: 'Your Details' },
  { id: 2, label: 'Service Details' },
  { id: 3, label: 'Schedule & Pro' },
  { id: 4, label: 'Confirm & Next Steps' },
];

export default function Service() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const type = location.state?.serviceType || params.get('type') || 'Service';
  const { location: userLoc } = useUserLocation() || {};
  const cityName = userLoc?.city || 'your area';

  const [currentStep, setCurrentStep] = useState(1);

  const [name, setName] = useState('');
  const [address, setAddress] = useState(location.state?.prefillAddress || '');
  const [userPhone, setUserPhone] = useState(location.state?.prefillPhone || '');
  const [userLocationCity, setUserLocationCity] = useState('');

  const [issueTitle, setIssueTitle] = useState('');
  const [jobDetails, setJobDetails] = useState('');

  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [estimatedDays, setEstimatedDays] = useState(1);
  const [preferredProId, setPreferredProId] = useState('');

  const [requestedPhoto, setRequestedPhoto] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [profileIncomplete, setProfileIncomplete] = useState(false);

  const professionals = useMemo(() => professionalDirectory[type] || [], [type]);
  const selectedProfessional = professionals.find((pro) => pro.id === preferredProId);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return;

        const data = userDoc.data();
        setName((prev) => prev || data.name || '');
        if (!location.state?.prefillAddress) setAddress((prev) => prev || data.address || '');
        if (!location.state?.prefillPhone) setUserPhone((prev) => prev || data.phone || '');
        setUserLocationCity(data.locationCity || '');

        if (!data.phone || !data.name || !data.address) {
          setProfileIncomplete(true);
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      }
    };

    loadUserData();
  }, [location.state]);

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    setUploadingPhoto(true);
    setError('');

    try {
      const storage = getStorage();
      const path = `bookings/requested/${Date.now()}_${file.name}`;
      const snap = await uploadBytes(storageRef(storage, path), file);
      const url = await getDownloadURL(snap.ref);
      setRequestedPhoto(url);
    } catch (err) {
      console.error('Photo upload failed:', err);
      setError('Photo upload failed. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const validateStepOne = () => {
    // Step 1 is read-only profile display; only check if profile is filled
    if (!name.trim() || !address.trim() || !userPhone.trim()) {
      setError('Your profile is incomplete. Please update your profile first.');
      return false;
    }
    return true;
  };

  const validateStepTwo = () => {
    if (!issueTitle.trim()) {
      setError('Please add a short service request title.');
      return false;
    }

    return true;
  };

  const validateStepThree = () => {
    if (isScheduled && (!scheduledDate || !timeSlot)) {
      setError('Select a scheduled date and time slot to continue.');
      return false;
    }

    if (!estimatedDays || Number(estimatedDays) < 1) {
      setError('Estimated work days should be at least 1.');
      return false;
    }

    return true;
  };

  const goNext = () => {
    setError('');
    if (currentStep === 1 && !validateStepOne()) return;
    if (currentStep === 2 && !validateStepTwo()) return;
    if (currentStep === 3 && !validateStepThree()) return;
    setCurrentStep((prev) => Math.min(4, prev + 1));
  };

  const goBack = () => {
    setError('');
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  const handleBooking = async () => {
    setError('');

    if (!validateStepOne() || !validateStepTwo() || !validateStepThree()) {
      return;
    }

    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      const bookingPayload = {
        userId: user.uid,
        serviceType: type,
        customerName: name.trim(),
        address: address.trim(),
        phone: userPhone.trim(),
        issueTitle: issueTitle.trim(),
        jobDetails: jobDetails.trim(),
        status: isScheduled ? 'scheduled' : 'pending',
        statusUpdatedAt: new Date(),
        scheduledDate: isScheduled ? scheduledDate : null,
        timeSlot: isScheduled ? timeSlot : null,
        estimatedDays: Number(estimatedDays),
        completedWorkDays: 0,
        remainingWorkDays: Number(estimatedDays),
        isMultiDay: Number(estimatedDays) > 1,
        requestedProfessional: selectedProfessional
          ? {
              id: selectedProfessional.id,
              name: selectedProfessional.name,
              rating: selectedProfessional.rating,
            }
          : null,
        requestedPhotos: requestedPhoto ? [{ url: requestedPhoto, label: 'User Requested', uploadedAt: new Date() }] : [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addDoc(collection(db, 'bookings'), bookingPayload);

      setSuccess('Booking confirmed. You will receive quotes and next-step updates in My Bookings.');
      setTimeout(() => {
        navigate('/my-bookings');
      }, 1400);
    } catch (err) {
      setError(err.message || 'Failed to submit booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="service-page">
      <section className="service-shell">
        <header className="service-header">
          <div className="service-badge">Editorial Concierge Booking</div>
          <h1>
            <span aria-hidden="true">{serviceIcons[type] || '🛠️'}</span> Book {type} in {cityName}
          </h1>
          <p>
            A guided 3-step journey with verified professionals, transparent quotes, and clear next steps.
          </p>
          <div className="trust-signals">
            <span>Verified Pros</span>
            <span>Quote Approval</span>
            <span>Track in Real-Time</span>
          </div>
        </header>

        <div className="stepper" role="list" aria-label="Booking steps">
          {steps.map((step) => (
            <div
              key={step.id}
              role="listitem"
              className={`step-item ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'done' : ''}`}
            >
              <span>{step.id}</span>
              <p>{step.label}</p>
            </div>
          ))}
        </div>

        {error && <div className="alert error">{error}</div>}
        {success && <div className="alert success">{success}</div>}

        <section className="step-content">
          {currentStep === 1 && (
            <div className="step-layout">
              <h2>1. Your Details</h2>
              <p className="step-note">Review your profile information. To make changes, visit your profile page.</p>

              <div className="summary-card" onClick={() => navigate('/profile')} style={{ cursor: 'pointer' }} title="Click to edit your profile">
                <div><strong>Name:</strong> {name || <span style={{ color: '#9ca3af' }}>Not set</span>}</div>
                <div><strong>Phone:</strong> {userPhone || <span style={{ color: '#9ca3af' }}>Not set</span>}</div>
                <div><strong>Address:</strong> {address || <span style={{ color: '#9ca3af' }}>Not set</span>}</div>
                <div><strong>Location:</strong> {userLocationCity || cityName || <span style={{ color: '#9ca3af' }}>Not set</span>}</div>
              </div>

              {profileIncomplete && (
                <div className="alert warning" style={{ marginTop: '12px' }}>
                  Your profile is incomplete. Please update your profile before booking.
                  <button onClick={() => navigate('/profile')}>Edit Profile</button>
                </div>
              )}

              <p style={{ fontSize: '13px', color: '#6B7280', marginTop: '12px' }}>
                Click on the details above to update your profile.
              </p>
            </div>
          )}

          {currentStep === 2 && (
            <div className="step-layout">
              <h2>2. Service Selection & Details</h2>
              <p className="step-note">Tell us what you need so professionals can quote accurately.</p>

              <div className="form-grid two-col">
                <label>
                  Request Title
                  <input
                    value={issueTitle}
                    onChange={(e) => setIssueTitle(e.target.value)}
                    placeholder={`Example: ${type === 'Plumber' ? 'Leaky kitchen tap' : 'Service request details'}`}
                  />
                </label>
                <label>
                  Photo (Optional)
                  <input type="file" accept="image/*" onChange={(e) => handlePhotoUpload(e.target.files[0])} disabled={uploadingPhoto} />
                  <small>{uploadingPhoto ? 'Uploading image...' : requestedPhoto ? 'Photo attached successfully.' : 'A photo improves quote quality.'}</small>
                </label>
              </div>

              <label>
                Additional Instructions (Optional)
                <textarea
                  rows={3}
                  value={jobDetails}
                  onChange={(e) => setJobDetails(e.target.value)}
                  placeholder="Share issue details, apartment floor, preferred call time, or access notes"
                />
              </label>
            </div>
          )}

          {currentStep === 3 && (
            <div className="step-layout">
              <h2>3. Scheduling & Professional Selection</h2>
              <p className="step-note">Choose when you need service and optionally nominate a preferred verified professional.</p>

              <div className="mode-toggle">
                <button
                  className={!isScheduled ? 'active' : ''}
                  onClick={() => {
                    setIsScheduled(false);
                    setScheduledDate('');
                    setTimeSlot('');
                  }}
                >
                  Immediate Service
                </button>
                <button className={isScheduled ? 'active' : ''} onClick={() => setIsScheduled(true)}>
                  Schedule for Later
                </button>
              </div>

              {isScheduled && (
                <div className="form-grid two-col">
                  <label>
                    Preferred Date
                    <input
                      type="date"
                      value={scheduledDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setScheduledDate(e.target.value)}
                    />
                  </label>
                  <label>
                    Time Slot
                    <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)}>
                      <option value="">Choose a slot</option>
                      <option value="9 AM - 12 PM">Morning (9 AM - 12 PM)</option>
                      <option value="12 PM - 3 PM">Afternoon (12 PM - 3 PM)</option>
                      <option value="3 PM - 6 PM">Evening (3 PM - 6 PM)</option>
                    </select>
                  </label>
                </div>
              )}

              <label>
                Estimated Work Days
                <select value={estimatedDays} onChange={(e) => setEstimatedDays(Number(e.target.value))}>
                  <option value={1}>1 day</option>
                  <option value={2}>2 days</option>
                  <option value={3}>3 days</option>
                  <option value={4}>4 days</option>
                  <option value={5}>5+ days</option>
                </select>
              </label>

              <div>
                <h3 className="subhead">Preferred Verified Professional (Optional)</h3>
                <div className="pro-grid">
                  {professionals.map((pro) => (
                    <button
                      key={pro.id}
                      className={`pro-card ${preferredProId === pro.id ? 'selected' : ''}`}
                      onClick={() => setPreferredProId(preferredProId === pro.id ? '' : pro.id)}
                    >
                      <strong>{pro.name}</strong>
                      <span>★ {pro.rating} | {pro.jobs} jobs</span>
                      <span>Avg response: {pro.eta}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <div className="step-layout">
              <h2>4. Confirmation & Next Steps</h2>
              <p className="step-note">Review details before final submission.</p>

              <div className="summary-card">
                <div><strong>Service:</strong> {type}</div>
                <div><strong>Request:</strong> {issueTitle || 'Not provided'}</div>
                <div><strong>Customer:</strong> {name || 'Not provided'}</div>
                <div><strong>Phone:</strong> {userPhone || 'Not provided'}</div>
                <div><strong>Address:</strong> {address || 'Not provided'}</div>
                <div><strong>Booking Mode:</strong> {isScheduled ? 'Scheduled' : 'Immediate'}</div>
                {isScheduled && (
                  <>
                    <div><strong>Date:</strong> {scheduledDate}</div>
                    <div><strong>Time Slot:</strong> {timeSlot}</div>
                  </>
                )}
                <div><strong>Estimated Days:</strong> {estimatedDays}</div>
                <div><strong>Preferred Pro:</strong> {selectedProfessional ? selectedProfessional.name : 'No preference'}</div>
              </div>

              {(() => {
                const budgetSuggestion = suggestBudget({
                  serviceType: type,
                  description: `${issueTitle} ${jobDetails}`.trim(),
                  estimatedDays,
                });
                return (
                  <div className="ai-budget-suggestion" role="region" aria-label="AI Budget Suggestion">
                    <div className="ai-budget-suggestion__header">
                      <span role="img" aria-label="AI">🤖</span>
                      <strong>Gito AI Budget Suggestion</strong>
                      <span className={`ai-budget-suggestion__confidence ai-budget-suggestion__confidence--${budgetSuggestion.confidence}`}>
                        {budgetSuggestion.confidence === 'high' ? '🎯' : '📊'} {budgetSuggestion.confidence}
                      </span>
                    </div>
                    <div className="ai-budget-suggestion__range">
                      {formatBudgetRange(budgetSuggestion)}
                    </div>
                    <p className="ai-budget-suggestion__explain">{budgetSuggestion.explanation}</p>
                    <p className="ai-budget-suggestion__note">
                      This is an AI-estimated range. Actual quotes from workers may vary based on materials and site conditions.
                    </p>
                  </div>
                );
              })()}

              <div className="next-steps">
                <h3>What happens next</h3>
                <ul>
                  <li>Your request is shared with local verified professionals.</li>
                  <li>You receive one or more quotes in My Bookings.</li>
                  <li>You approve your preferred quote and track progress live.</li>
                </ul>
              </div>
            </div>
          )}
        </section>

        <footer className="service-actions">
          {currentStep > 1 ? (
            <button className="btn ghost" onClick={goBack}>
              Back
            </button>
          ) : (
            <button className="btn ghost" onClick={() => navigate('/')}>
              Cancel
            </button>
          )}

          {currentStep < 4 ? (
            <button className="btn primary" onClick={goNext}>
              Continue
            </button>
          ) : (
            <button className="btn primary" onClick={handleBooking} disabled={loading}>
              {loading ? 'Submitting...' : 'Confirm Booking'}
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
