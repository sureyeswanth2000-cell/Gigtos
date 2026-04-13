import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from 'firebase/storage';
import { auth, db } from '../firebase';
import { useLocation as useUserLocation } from '../context/LocationContext';
import { suggestBudgetForUser, formatBudgetRange } from '../utils/aiBudgetSuggestion';
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
  { id: 1, label: 'Account' },
  { id: 2, label: 'Problem' },
  { id: 3, label: 'Schedule' },
  { id: 4, label: 'Review' },
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

  const budgetSuggestion = useMemo(() => {
    if (currentStep !== 4) return null;
    return suggestBudgetForUser({
      serviceType: type,
      description: `${issueTitle} ${jobDetails}`.trim(),
      estimatedDays,
    });
  }, [currentStep, type, issueTitle, jobDetails, estimatedDays]);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (!userDoc.exists()) return;

        const data = userDoc.data();
        setName((p) => p || data.name || '');
        if (!location.state?.prefillAddress) setAddress((p) => p || data.address || '');
        if (!location.state?.prefillPhone) setUserPhone((p) => p || data.phone || '');
        setUserLocationCity(data.locationCity || '');

        if (!data.phone || !data.name) {
          setProfileIncomplete(true);
        }
      } catch {
        /* Profile load fail */
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
    } catch {
      setError('Photo upload failed. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const validateStep = (step) => {
    if (step === 1) {
       if (!name.trim() || !address.trim() || !userPhone.trim()) {
        setError('Please complete your profile details to proceed.');
        setProfileIncomplete(true);
        return false;
      }
    }
    if (step === 2) {
      if (!issueTitle.trim()) {
        setError('Please provide a brief title for your request.');
        return false;
      }
    }
    if (step === 3) {
      if (isScheduled && (!scheduledDate || !timeSlot)) {
        setError('Please select a date and time slot.');
        return false;
      }
    }
    return true;
  };

  const goNext = () => {
    setError('');
    if (validateStep(currentStep)) {
      setCurrentStep((p) => Math.min(4, p + 1));
    }
  };

  const goBack = () => {
    setError('');
    setCurrentStep((p) => Math.max(1, p - 1));
  };

  const handleBooking = async () => {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) return;
    setLoading(true);
    setError('');

    try {
      const user = auth.currentUser;
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
          ? { id: selectedProfessional.id, name: selectedProfessional.name, rating: selectedProfessional.rating }
          : null,
        requestedPhotos: requestedPhoto ? [{ url: requestedPhoto, label: 'Customer Photo', uploadedAt: new Date() }] : [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addDoc(collection(db, 'bookings'), bookingPayload);
      setSuccess('Great! Your booking is being shared with local pros.');
      setTimeout(() => navigate('/my-bookings'), 1500);
    } catch (err) {
      setError('Booking failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="service-page">
      <div className="service-shell">
        <header className="service-header">
          <span className="service-badge">Secure Booking</span>
          <h1>{serviceIcons[type] || '🛠️'} {type} in {cityName}</h1>
          <p>Get accurate quotes from top-rated {type}s nearby.</p>
        </header>

        <nav className="stepper">
          {steps.map((s) => (
            <div key={s.id} className={`step-item ${currentStep === s.id ? 'active' : ''} ${currentStep > s.id ? 'done' : ''}`}>
              <span>{currentStep > s.id ? '✓' : s.id}</span>
              <p>{s.label}</p>
            </div>
          ))}
        </nav>

        {error && <div className="alert-message error">{error}</div>}
        {success && <div className="alert-message success">{success}</div>}

        <main className="step-content">
          {currentStep === 1 && (
            <section className="step-layout">
              <h2>Contact & Location</h2>
              <p className="step-note">Confirm your details for the service visit.</p>
              <div className="summary-card" onClick={() => navigate('/profile')}>
                <div className="detail-chip">
                   <div className="chip-icon">👤</div>
                   <div className="chip-text">
                     <span className="chip-label">Name</span>
                     <span className="chip-value">{name || 'Set Name'}</span>
                   </div>
                </div>
                <div className="detail-chip">
                   <div className="chip-icon">📱</div>
                   <div className="chip-text">
                     <span className="chip-label">Phone</span>
                     <span className="chip-value">{userPhone || 'Set Phone'}</span>
                   </div>
                </div>
                <div className="detail-chip">
                   <div className="chip-icon">🏠</div>
                   <div className="chip-text">
                     <span className="chip-label">Address</span>
                     <span className="chip-value">{address || 'Set Address'}</span>
                   </div>
                </div>
                <div className="detail-chip">
                   <div className="chip-icon">📍</div>
                   <div className="chip-text">
                     <span className="chip-label">City</span>
                     <span className="chip-value">{userLocationCity || cityName}</span>
                   </div>
                </div>
              </div>
              {profileIncomplete && (
                <button className="btn-secondary w-full" onClick={() => navigate('/profile')}>Update Profile first</button>
              )}
            </section>
          )}

          {currentStep === 2 && (
            <section className="step-layout">
              <h2>Describe the Job</h2>
              <p className="step-note">Be as detailed as possible for better quotes.</p>
              <div className="form-grid">
                <label>
                  Problem Title
                  <input 
                    value={issueTitle} 
                    onChange={e => setIssueTitle(e.target.value)} 
                    placeholder="e.g. Broken faucet, Wiring fix..." 
                  />
                </label>
                <label>
                  Service Snapshot (Optional)
                  <input type="file" accept="image/*" onChange={e => handlePhotoUpload(e.target.files[0])} disabled={uploadingPhoto} />
                  <small>{uploadingPhoto ? 'Processing...' : requestedPhoto ? 'Photo ready' : 'Photos help pros understand the scale'}</small>
                </label>
                <label>
                  Specific Instructions
                  <textarea 
                    rows={4} 
                    value={jobDetails} 
                    onChange={e => setJobDetails(e.target.value)} 
                    placeholder="Tell us about the issue, access notes etc." 
                  />
                </label>
              </div>
            </section>
          )}

          {currentStep === 3 && (
            <section className="step-layout">
              <h2>Schedule & Preferences</h2>
              <p className="step-note">When should the professional arrive?</p>
              
              <div className="mode-toggle">
                <button className={!isScheduled ? 'active' : ''} onClick={() => setIsScheduled(false)}>Now</button>
                <button className={isScheduled ? 'active' : ''} onClick={() => setIsScheduled(true)}>Later</button>
              </div>

              {isScheduled && (
                <div className="form-grid two-col">
                  <label>Date <input type="date" value={scheduledDate} min={new Date().toISOString().split('T')[0]} onChange={e => setScheduledDate(e.target.value)} /></label>
                  <label>Slot 
                    <select value={timeSlot} onChange={e => setTimeSlot(e.target.value)}>
                      <option value="">Any time</option>
                      <option value="9 AM - 12 PM">Morning</option>
                      <option value="12 PM - 3 PM">Afternoon</option>
                      <option value="3 PM - 6 PM">Evening</option>
                    </select>
                  </label>
                </div>
              )}

              <label className="mt-4">
                Expected Work Duration
                <select value={estimatedDays} onChange={e => setEstimatedDays(Number(e.target.value))}>
                  {[1,2,3,4,5].map(d => <option key={d} value={d}>{d} Day{d>1?'s':''}</option>)}
                </select>
              </label>

              <h3 className="subhead mt-6">Nominate a Pro (Optional)</h3>
              <div className="pro-grid">
                {professionals.map(pro => (
                  <button key={pro.id} className={`pro-card ${preferredProId === pro.id ? 'selected' : ''}`} onClick={() => setPreferredProId(p => p === pro.id ? '' : pro.id)}>
                    <strong>{pro.name}</strong>
                    <span>★ {pro.rating} • {pro.jobs} 💼</span>
                    <span>ETA: {pro.eta}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {currentStep === 4 && (
            <section className="step-layout">
              <h2>Review Booking</h2>
              <div className="confirm-summary">
                <div className="confirm-row"><span className="row-icon">{serviceIcons[type]||'🛠️'}</span><div className="row-text"><span className="row-label">Category</span><span className="row-value">{type}</span></div></div>
                <div className="confirm-row"><span className="row-icon">📝</span><div className="row-text"><span className="row-label">Request</span><span className="row-value">{issueTitle}</span></div></div>
                <div className="confirm-row"><span className="row-icon">📅</span><div className="row-text"><span className="row-label">Timing</span><span className="row-value">{isScheduled ? `${scheduledDate} (${timeSlot})` : 'Immediate'}</span></div></div>
                <div className="confirm-row"><span className="row-icon">🏠</span><div className="row-text"><span className="row-label">Destination</span><span className="row-value">{address}</span></div></div>
              </div>

              {budgetSuggestion && (
                <div className="budget-suggestion-card">
                  <h4>💡 Gito AI Price Anchor</h4>
                  <div className="budget-suggestion-range">{formatBudgetRange(budgetSuggestion)}</div>
                  <p>{budgetSuggestion.explanation}</p>
                </div>
              )}

              <div className="next-steps">
                <h4>What's next?</h4>
                <p>Pros will review your details and send quotes. You only pay after you're satisfied with the work.</p>
              </div>
            </section>
          )}
        </main>

        <footer className="service-actions">
           <button className="btn-secondary" onClick={currentStep === 1 ? () => navigate('/') : goBack}>
             {currentStep === 1 ? 'Cancel' : 'Back'}
           </button>
           <button className="btn-primary" onClick={currentStep === 4 ? handleBooking : goNext} disabled={loading}>
             {loading ? 'Processing...' : currentStep === 4 ? 'Confirm Booking' : 'Continue'}
           </button>
        </footer>
      </div>
    </div>
  );
}

