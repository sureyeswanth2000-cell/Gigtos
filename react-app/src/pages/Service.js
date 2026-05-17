import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from 'firebase/storage';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Camera,
  CheckCircle2,
  Clock,
  IndianRupee,
  LocateFixed,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { auth, db } from '../firebase';
import { getDevBypassUserFromSearch, isDevBypassEnabled } from '../utils/devBypass';
import { getServiceByName, getServiceOptions } from '../utils/serviceCatalog';
import { formatPriceBand, getSuggestedPriceBand } from '../utils/priceIntelligence';
import './Service.css';

function getSmartMatchRecommendation(serviceType, details, estimatedDays) {
  const text = (details || '').toLowerCase();
  const isUrgent = /(urgent|asap|immediately|leak|sparking|short\s?circuit|burst)/.test(text);
  const complex = /(full|complete|renovation|rewire|repaint|replace|major)/.test(text) || Number(estimatedDays) > 2;
  const service = getServiceByName(serviceType);
  const urgency = isUrgent ? 'High' : complex ? 'Medium' : 'Normal';
  const visitWindow = isUrgent ? '30-90 mins' : '2-6 hours';
  const priceBand = getSuggestedPriceBand({ serviceType, urgency, estimatedDays });
  const budgetRange = formatPriceBand(priceBand);
  const confidence = isUrgent ? 92 : complex ? 87 : 81;
  const reasons = [
    `Matched to ${serviceType} based on your request details`,
    isUrgent ? 'Urgent keywords detected, so nearby availability is prioritized' : 'No emergency risk keywords found',
    complex ? 'Work may need multi-step scheduling' : 'Work looks suitable for quick-resolution assignment',
    service.rareService ? 'If local supply is sparse, matching can expand city-wide' : 'Area and 10 km matching is preferred',
  ];

  return {
    urgency,
    visitWindow,
    budgetRange,
    priceBand,
    matchingScope: service.matchingScope,
    confidence,
    reasons,
  };
}

const getScopeText = (scope) => (
  scope === 'city_when_sparse'
    ? 'Nearby first, city-wide fallback when supply is rare'
    : 'Nearby workers within service area and 10 km'
);

export default function Service() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const [selectedType, setSelectedType] = useState(location.state?.serviceType || params.get('type') || 'Home Helper');
  const [name, setName] = useState('');
  const [address, setAddress] = useState(location.state?.prefillAddress || '');
  const [userPhone, setUserPhone] = useState(location.state?.prefillPhone || '');
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [estimatedDays, setEstimatedDays] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);
  const [requestedPhoto, setRequestedPhoto] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [issueDetails, setIssueDetails] = useState('');
  const [smartMatch, setSmartMatch] = useState(() => getSmartMatchRecommendation(selectedType, '', 1));

  const devUser = useMemo(
    () => (isDevBypassEnabled() ? getDevBypassUserFromSearch(location.search) : null),
    [location.search]
  );

  useEffect(() => {
    const loadUserData = async () => {
      try {
        if (devUser?.role === 'consumer') {
          setName(devUser.name || '');
          setAddress(devUser.address || '');
          setUserPhone(devUser.phone || '');
          setProfileIncomplete(false);
          return;
        }

        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (!name) setName(data.name || '');
          if (!location.state) {
            setAddress(data.address || '');
            setUserPhone(data.phone || '');
          }
          setProfileIncomplete(!data.phone || !data.name || !data.address);
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      }
    };

    loadUserData();
  }, [devUser, location.state, name]);

  useEffect(() => {
    setSmartMatch(getSmartMatchRecommendation(selectedType, issueDetails, estimatedDays));
  }, [selectedType, issueDetails, estimatedDays]);

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    setUploadingPhoto(true);
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

  const handleBooking = async () => {
    if (!name || !address || !userPhone) {
      setError('Please complete name, address, and phone before booking.');
      setProfileIncomplete(true);
      return;
    }

    if (isScheduled && (!scheduledDate || !timeSlot)) {
      setError('Please select both date and time for a future booking.');
      return;
    }

    if (!estimatedDays || Number(estimatedDays) < 1) {
      setError('Estimated work days should be at least 1.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = devUser?.role === 'consumer' ? devUser : auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      const bookingPayload = {
        userId: user.uid,
        serviceType: selectedType,
        customerName: name,
        address,
        phone: userPhone,
        status: isScheduled ? 'scheduled' : 'pending',
        statusUpdatedAt: new Date(),
        scheduledDate: isScheduled ? scheduledDate : null,
        timeSlot: isScheduled ? timeSlot : null,
        estimatedDays: Number(estimatedDays),
        issueDetails: issueDetails.trim(),
        aiSmartMatch: smartMatch,
        matchingScope: smartMatch.matchingScope,
        suggestedPriceBand: smartMatch.priceBand,
        completedWorkDays: 0,
        remainingWorkDays: Number(estimatedDays),
        isMultiDay: Number(estimatedDays) > 1,
        requestedPhotos: requestedPhoto ? [{ url: requestedPhoto, label: 'User Requested', uploadedAt: new Date() }] : [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (devUser?.role === 'consumer') {
        bookingPayload.id = 'dev-booking-preview';
      } else {
        await addDoc(collection(db, 'bookings'), bookingPayload);
      }

      setSuccess("Booking request sent. Track worker assignment and status in My Bookings.");
      setShowConfirm(false);

      setTimeout(() => {
        navigate('/my-bookings');
      }, 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const serviceOptions = getServiceOptions();
  const selectedService = getServiceByName(selectedType);
  const canReview = Boolean(name && address && userPhone && (!isScheduled || (scheduledDate && timeSlot)));
  const scheduleText = isScheduled ? `${scheduledDate || 'Select date'} / ${timeSlot || 'Select time'}` : 'ASAP, nearest available worker';

  return (
    <div className="booking-redesign-page">
      <section className="booking-redesign-shell">
        <aside className="booking-redesign-aside">
          <button type="button" className="booking-back-link" onClick={() => navigate('/services')}>
            <ArrowLeft size={16} /> Services
          </button>
          <span className="booking-kicker"><ShieldCheck size={14} /> Fast booking</span>
          <h1>Book {selectedType}</h1>
          <p>Tell us the work, confirm location and time, then review. Clear enough for first-time users, detailed enough for serious jobs.</p>

          <div className="booking-trust-list">
            <span><CheckCircle2 size={16} /> Verified worker assignment</span>
            <span><IndianRupee size={16} /> Fair price range guidance</span>
            <span><LocateFixed size={16} /> Live tracking after assignment</span>
          </div>

          <div className="booking-supply-note">
            <strong>Supply rule</strong>
            <span>{getScopeText(selectedService.matchingScope)}</span>
          </div>
        </aside>

        <main className="booking-flow-panel">
          <div className="booking-step-tabs" aria-label="Booking steps">
            <span className="active">1 Work</span>
            <span className={address && userPhone ? 'active' : ''}>2 Location</span>
            <span className={canReview ? 'active' : ''}>3 Review</span>
          </div>

          {profileIncomplete && (
            <div className="booking-warning">
              <span>Complete name, phone, and address to book faster next time.</span>
              <button type="button" onClick={() => navigate('/profile')}>Open profile</button>
            </div>
          )}
          {error && <div className="booking-error">{error}</div>}
          {success && <div className="booking-success">{success}</div>}

          <section className="booking-panel-section">
            <div className="section-row">
              <div>
                <h2>Choose service</h2>
                <p>Switch services here if your request belongs in another category.</p>
              </div>
              <strong>{smartMatch.confidence}% match</strong>
            </div>

            <div className="service-choice-grid">
              {serviceOptions.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  className={selectedType === service.name ? 'selected' : ''}
                  onClick={() => setSelectedType(service.name)}
                >
                  <span>{service.iconLabel}</span>
                  <strong>{service.name}</strong>
                </button>
              ))}
            </div>

            <label className="booking-field">
              <span>Describe the work</span>
              <textarea
                value={issueDetails}
                onChange={(e) => setIssueDetails(e.target.value)}
                rows={4}
                placeholder="Describe your issue or work details. Example: urgent kitchen help needed immediately."
              />
            </label>

            <div className="booking-insight-grid">
              <div><Clock size={16} /><span>Urgency</span><strong>{smartMatch.urgency}</strong></div>
              <div><CalendarClock size={16} /><span>Visit</span><strong>{smartMatch.visitWindow}</strong></div>
              <div><IndianRupee size={16} /><span>Fair range</span><strong>{smartMatch.budgetRange}</strong></div>
            </div>

            <div className="booking-reason-list">
              {smartMatch.reasons.map((reason) => (
                <span key={reason}><Sparkles size={14} /> {reason}</span>
              ))}
            </div>

            <label className="photo-upload-card">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => handlePhotoUpload(e.target.files[0])}
                disabled={uploadingPhoto}
              />
              <Camera size={18} />
              <span>{requestedPhoto ? 'Photo attached' : uploadingPhoto ? 'Uploading photo...' : 'Add work photo'}</span>
              <small>Photos help workers quote correctly and support later quality checks.</small>
            </label>
          </section>

          <section className="booking-panel-section">
            <div className="section-row">
              <div>
                <h2>Location and time</h2>
                <p>Keep contact and address simple. Future bookings can be scheduled up to the allowed booking window.</p>
              </div>
            </div>

            <div className="booking-form-grid">
              <label className="booking-field">
                <span>Name</span>
                <div className="booking-input-icon"><User size={17} /><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></div>
              </label>
              <label className="booking-field">
                <span>Phone</span>
                <div className="booking-input-icon"><Phone size={17} /><input value={userPhone} onChange={(e) => setUserPhone(e.target.value)} placeholder="10-digit phone" /></div>
              </label>
              <label className="booking-field full">
                <span>Address</span>
                <div className="booking-input-icon textarea"><MapPin size={17} /><textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={3} placeholder="House, street, landmark, area" /></div>
              </label>
            </div>

            <div className="booking-profile-summary" aria-label="Booking profile summary">
              <div><span>Consumer</span><strong>{name || 'Name needed'}</strong></div>
              <div><span>Phone</span><strong>{userPhone || 'Phone needed'}</strong></div>
              <div><span>Area</span><strong>{address ? 'Saved address ready' : 'Address needed'}</strong></div>
            </div>

            <div className="booking-schedule-card">
              <button type="button" className={!isScheduled ? 'selected' : ''} onClick={() => setIsScheduled(false)}>Book now</button>
              <button type="button" className={isScheduled ? 'selected' : ''} onClick={() => setIsScheduled(true)}>Future booking</button>
            </div>

            {isScheduled && (
              <div className="booking-form-grid">
                <label className="booking-field">
                  <span>Date</span>
                  <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                </label>
                <label className="booking-field">
                  <span>Time slot</span>
                  <select value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)}>
                    <option value="">Choose time</option>
                    <option value="9 AM - 12 PM">9 AM - 12 PM</option>
                    <option value="12 PM - 3 PM">12 PM - 3 PM</option>
                    <option value="3 PM - 6 PM">3 PM - 6 PM</option>
                  </select>
                </label>
              </div>
            )}

            <label className="booking-field booking-days-field">
              <span>Estimated work days</span>
              <select value={estimatedDays} onChange={(e) => setEstimatedDays(Number(e.target.value))}>
                <option value={1}>1 day</option>
                <option value={2}>2 days</option>
                <option value={3}>3 days</option>
                <option value={4}>4 days</option>
                <option value={5}>5+ days</option>
              </select>
            </label>
          </section>

          <section className="booking-review-card">
            <div>
              <span>Review</span>
              <strong>{selectedType}</strong>
              <small>{scheduleText}</small>
            </div>
            <button type="button" disabled={!canReview || loading} onClick={() => setShowConfirm(true)}>
              {loading ? 'Booking...' : 'Review and book'} <ArrowRight size={18} />
            </button>
          </section>
        </main>
      </section>

      {showConfirm && (
        <div className="booking-modal-backdrop">
          <div className="booking-modal">
            <h3>Confirm booking</h3>
            <p>{selectedType} for {name || 'consumer'}.</p>
            <div className="booking-modal-summary">
              <span>Phone: {userPhone}</span>
              <span>Address: {address}</span>
              <span>Time: {scheduleText}</span>
              <span>Expected range: {smartMatch.budgetRange}</span>
            </div>
            <div className="booking-modal-actions">
              <button type="button" className="secondary" onClick={() => setShowConfirm(false)} disabled={loading}>Back</button>
              <button type="button" onClick={handleBooking} disabled={loading}>{loading ? 'Booking...' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
