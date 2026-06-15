import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { getFunctions, httpsCallable } from 'firebase/functions';
import app, { auth, db } from '../firebase';
import { getDevBypassUserFromSearch, isDevBypassEnabled } from '../utils/devBypass';
import { getServiceByName, getServiceOptions } from '../utils/serviceCatalog';
import { formatPriceBand, getSuggestedPriceBand } from '../utils/priceIntelligence';
import {
  inferCityAndArea,
  isQuoteExpired,
  requestMvpDemandQuote,
  startSmartQueueForBooking,
  toMvpServiceId,
} from '../utils/mvpQuoteClient';
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

const formatInr = (value) => `INR ${Number(value || 0).toLocaleString('en-IN')}`;

function getDemandLabel(quote) {
  const demandLevel = String(quote?.demandLevel || '').toLowerCase();
  if (demandLevel === 'peak') return 'Peak demand now';
  if (demandLevel === 'high') return 'High demand now';
  if (demandLevel === 'low') return 'Low area demand';
  return 'Normal area price';
}

function buildConsumerPriceReasons(quote, serviceName) {
  if (!quote) {
    return ['Final price is locked by Firebase backend rules before booking.'];
  }

  const reasons = [
    `${getDemandLabel(quote)} for ${serviceName}.`,
    'Worker receives the full customer price during launch.',
  ];

  const source = String(quote.priceSource || '');
  if (source.includes('stale') || source.includes('missing')) {
    reasons.push('Demand data was not fresh enough, so the quote used a safe normal-area price.');
  } else if (quote.demandLevel === 'peak') {
    reasons.push('Nearby worker supply is tight, so the backend used the configured peak cap.');
  } else if (quote.demandLevel === 'high') {
    reasons.push('Few open workers are available nearby, so the backend used the high-demand range.');
  } else {
    reasons.push('The quote uses the local service rule, worker price, and current area demand label.');
  }

  if (quote.priceLockedUntil) {
    reasons.push(`Price is locked until ${new Date(quote.priceLockedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`);
  }

  return reasons;
}

function isValidIndianPhone(value) {
  return value.replace(/\D/g, '').slice(-10).length === 10;
}

async function requestMvpDemandQuoteWithRetry(payload, retries = 1) {
  try {
    return await requestMvpDemandQuote(payload);
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise(resolve => setTimeout(resolve, 700));
    return requestMvpDemandQuoteWithRetry(payload, retries - 1);
  }
}

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
  const [profileCity, setProfileCity] = useState('');
  const [profileArea, setProfileArea] = useState('');
  const [lockedQuote, setLockedQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  const [bargainPrice, setBargainPrice] = useState('');
  const activeQuoteRequestKeyRef = useRef('');

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
          setProfileCity(devUser.city || '');
          setProfileArea(devUser.area || '');
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
          setProfileCity(data.locationCity || data.city || '');
          setProfileArea(data.locationArea || data.area || '');
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
    setLockedQuote(null);
    setBargainPrice('');
    activeQuoteRequestKeyRef.current = '';
    setQuoteError('');
  }, [selectedType, issueDetails, estimatedDays]);

  useEffect(() => {
    setLockedQuote(null);
    setBargainPrice('');
    activeQuoteRequestKeyRef.current = '';
    setQuoteError('');
  }, [address, profileCity, profileArea]);

  const minAllowedBargainPrice = useMemo(() => {
    if (!lockedQuote?.finalConsumerPrice) return 0;
    return Math.round(Number(lockedQuote.finalConsumerPrice) * 0.85); // Up to 15% discount
  }, [lockedQuote]);

  const isBargainValid = useMemo(() => {
    if (!bargainPrice) return true;
    const priceNum = Number(bargainPrice);
    return !Number.isNaN(priceNum) && priceNum >= minAllowedBargainPrice && priceNum <= (lockedQuote?.finalConsumerPrice || 0);
  }, [bargainPrice, minAllowedBargainPrice, lockedQuote]);

  const finalPriceToCharge = useMemo(() => {
    if (lockedQuote && bargainPrice && isBargainValid) {
      return Number(bargainPrice);
    }
    return lockedQuote?.finalConsumerPrice || 0;
  }, [lockedQuote, bargainPrice, isBargainValid]);

  const finalWorkerReceivable = useMemo(() => {
    if (lockedQuote && bargainPrice && isBargainValid) {
      return Number(bargainPrice);
    }
    return lockedQuote?.workerReceivable || 0;
  }, [lockedQuote, bargainPrice, isBargainValid]);

  const consumerPriceReasons = useMemo(
    () => buildConsumerPriceReasons(lockedQuote, lockedQuote?.quoteContext?.serviceType || selectedType),
    [lockedQuote, selectedType]
  );

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const storage = getStorage();
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Not authenticated');
      const path = `bookings/requested/${uid}/${Date.now()}_${file.name}`;
      const snap = await uploadBytes(storageRef(storage, path), file, { contentType: file.type });
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
    if (!isValidIndianPhone(userPhone)) {
      setError('Enter a valid 10-digit phone number before booking.');
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
    if (!lockedQuote?.quoteId || isQuoteExpired(lockedQuote)) {
      setError('Price quote expired or missing. Please review again to get a locked backend price.');
      setShowConfirm(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = devUser?.role === 'consumer' ? devUser : auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      const quoteContext = lockedQuote.quoteContext || {
        serviceType: selectedType,
        serviceId: selectedQuoteServiceId,
        location: selectedQuoteLocation,
        smartMatch,
        issueDetails,
      };

      const bookingPayload = {
        userId: user.uid,
        serviceType: quoteContext.serviceType,
        serviceId: quoteContext.serviceId,
        city: quoteContext.location.city,
        userLocationCity: quoteContext.location.city,
        areaId: quoteContext.location.areaId,
        customerName: name,
        address,
        phone: userPhone,
        status: isScheduled ? 'scheduled' : 'pending',
        statusUpdatedAt: new Date(),
        scheduledDate: isScheduled ? scheduledDate : null,
        timeSlot: isScheduled ? timeSlot : null,
        estimatedDays: Number(estimatedDays),
        issueDetails: (quoteContext.issueDetails || '').trim(),
        aiSmartMatch: quoteContext.smartMatch,
        matchingScope: quoteContext.smartMatch?.matchingScope || '',
        suggestedPriceBand: quoteContext.smartMatch?.priceBand || null,
        priceQuoteId: lockedQuote.quoteId,
        quoteId: lockedQuote.quoteId,
        quoteStatus: 'locked',
        finalConsumerPrice: finalPriceToCharge,
        workerReceivable: finalWorkerReceivable,
        bargainRequestedPrice: bargainPrice && isBargainValid ? Number(bargainPrice) : null,
        bargainStatus: bargainPrice && isBargainValid ? 'pending' : null,
        completedWorkDays: 0,
        remainingWorkDays: Number(estimatedDays),
        isMultiDay: Number(estimatedDays) > 1,
        requestedPhotos: requestedPhoto ? [{ url: requestedPhoto, label: 'User Requested', uploadedAt: new Date() }] : [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (devUser?.role === 'consumer') {
        bookingPayload.id = 'dev-booking-preview';
        setSuccess("Booking request sent (DEV MODE). Smart Queue is finding an open verified worker.");
        setShowConfirm(false);
        setTimeout(() => {
          navigate('/my-bookings');
        }, 1500);
      } else {
        const functionsAsia = getFunctions(app, 'asia-south1');
        const createRazorpayOrder = httpsCallable(functionsAsia, 'createRazorpayOrder');
        const verifyRazorpayPayment = httpsCallable(functionsAsia, 'verifyRazorpayPayment');

        const orderResponse = await createRazorpayOrder({ amount: finalPriceToCharge });
        const { orderId } = orderResponse.data;

        const options = {
          key: process.env.REACT_APP_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
          amount: Math.round(Number(finalPriceToCharge) * 100),
          currency: 'INR',
          name: 'Gigtos Home Services',
          description: `Booking for ${selectedType}`,
          order_id: orderId,
          handler: async function (response) {
            try {
              setLoading(true);
              const verificationResult = await verifyRazorpayPayment({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature
              });

              if (verificationResult.data.valid) {
                bookingPayload.paymentId = response.razorpay_payment_id;
                bookingPayload.paymentStatus = 'paid';
                
                const bookingRef = await addDoc(collection(db, 'bookings'), bookingPayload);
                await startSmartQueueForBooking({
                  bookingId: bookingRef.id,
                  quoteId: lockedQuote.quoteId,
                });

                setSuccess("Payment successful! Smart Queue is finding an open verified worker.");
                setShowConfirm(false);
                setTimeout(() => navigate('/my-bookings'), 1500);
              }
            } catch (err) {
              console.error(err);
              setError("Payment verification failed.");
              setLoading(false);
            }
          },
          prefill: {
            name: name,
            contact: userPhone
          },
          theme: {
            color: '#A259FF'
          },
          modal: {
            ondismiss: function() {
              setLoading(false);
              setError("Payment was cancelled.");
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.on('payment.failed', function (response) {
          setLoading(false);
          setError("Payment failed: " + response.error.description);
        });
        rzp.open();
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const selectedService = getServiceByName(selectedType);
  const selectedQuoteServiceId = toMvpServiceId(selectedService);
  const selectedQuoteLocation = inferCityAndArea({
    address,
    profileCity,
    profileArea,
    fallbackCity: devUser?.city || 'Bangalore',
  });

  const prepareLockedQuote = async () => {
    if (!name || !address || !userPhone) {
      setError('Please complete name, address, and phone before booking.');
      setProfileIncomplete(true);
      return;
    }
    if (!isValidIndianPhone(userPhone)) {
      setError('Enter a valid 10-digit phone number before booking.');
      setProfileIncomplete(true);
      return;
    }
    if (isScheduled && (!scheduledDate || !timeSlot)) {
      setError('Please select both date and time for a future booking.');
      return;
    }
    setQuoteLoading(true);
    setQuoteError('');
    setError('');
    try {
      const quoteRequestKey = [
        selectedType,
        selectedQuoteServiceId,
        selectedQuoteLocation.city,
        selectedQuoteLocation.areaId,
        issueDetails,
        Number(estimatedDays) || 1,
      ].join('|');
      activeQuoteRequestKeyRef.current = quoteRequestKey;
      if (devUser?.role === 'consumer') {
        const quoteContext = {
          serviceType: selectedType,
          serviceId: selectedQuoteServiceId,
          location: selectedQuoteLocation,
          smartMatch,
          issueDetails,
        };
        const devQuote = {
          quoteId: 'dev-locked-quote',
          finalConsumerPrice: smartMatch.priceBand.fairMin,
          workerReceivable: smartMatch.priceBand.fairMin,
          demandLevel: 'normal',
          explanationConsumer: 'Normal area price. Worker receives full amount during launch.',
          priceLockedUntil: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          confidence: 'medium',
          quoteContext,
        };
        setLockedQuote(devQuote);
        setShowConfirm(true);
        return;
      }

      const quoteContext = {
        serviceType: selectedType,
        serviceId: selectedQuoteServiceId,
        location: selectedQuoteLocation,
        smartMatch,
        issueDetails,
      };
      const quote = await requestMvpDemandQuoteWithRetry({
        serviceId: selectedQuoteServiceId,
        city: selectedQuoteLocation.city,
        areaId: selectedQuoteLocation.areaId,
        quantity: Number(estimatedDays) || 1,
      });
      if (activeQuoteRequestKeyRef.current !== quoteRequestKey) {
        return;
      }
      setLockedQuote({ ...quote, quoteContext });
      setShowConfirm(true);
    } catch (err) {
      const message = err?.message || 'Backend quote is unavailable right now. Please try again shortly.';
      setQuoteError(message);
      setError(message);
    } finally {
      setQuoteLoading(false);
    }
  };

  const serviceOptions = getServiceOptions();
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
              <div><IndianRupee size={16} /><span>{lockedQuote ? 'Locked price' : 'Fair range'}</span><strong>{lockedQuote ? `INR ${Number(lockedQuote.finalConsumerPrice).toLocaleString('en-IN')}` : smartMatch.budgetRange}</strong></div>
            </div>

            <div className="booking-locked-quote">
              <strong>{lockedQuote ? 'Backend price locked' : 'Backend price required before booking'}</strong>
              <span>
                {lockedQuote
                  ? `${getDemandLabel(lockedQuote)}. Platform fee: ${formatInr(lockedQuote.platformFee || 0)}. Worker receives: ${formatInr(lockedQuote.workerReceivable || (lockedQuote.finalConsumerPrice - (lockedQuote.platformFee || 0)))}.`
                  : 'Final booking price will come from Firebase backend rules, not this screen.'}
              </span>
              {lockedQuote && (
                <div className="booking-price-explainer" aria-label="Why this price?">
                  <strong>Why this price?</strong>
                  <ul>
                    {consumerPriceReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                </div>
              )}
              {quoteError && <small>{quoteError}</small>}
            </div>

            {lockedQuote && (
              <div className="booking-locked-quote" style={{ marginTop: 16, padding: '16px 20px', background: 'var(--bg-soft)', border: '1px dashed var(--border-light)', borderRadius: 14 }}>
                <strong style={{ display: 'block', marginBottom: 6 }}>Request a launch discount (Optional)</strong>
                <span style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 12 }}>
                  You can propose a lower price (bargain) up to 15% discount. Verified workers can choose to accept or reject your offer before match confirmation.
                </span>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="number"
                    placeholder={`Enter offer (Min INR ${minAllowedBargainPrice})`}
                    className="input-field"
                    style={{ margin: 0, flex: 1, padding: '10px 14px' }}
                    value={bargainPrice}
                    onChange={(e) => setBargainPrice(e.target.value)}
                  />
                  {bargainPrice && (
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{ padding: '12px 18px', whiteSpace: 'nowrap', borderRadius: 8 }}
                      onClick={() => setBargainPrice('')}
                    >
                      Reset
                    </button>
                  )}
                </div>
                {!isBargainValid && (
                  <small style={{ color: 'var(--error)', marginTop: 6, display: 'block', fontWeight: 700 }}>
                    Discount request cannot exceed 15% (Min allowed: INR {minAllowedBargainPrice}).
                  </small>
                )}
                {bargainPrice && isBargainValid && (
                  <small style={{ color: 'var(--success)', marginTop: 6, display: 'block', fontWeight: 700 }}>
                    Proposing target price of INR {finalPriceToCharge} to open workers.
                  </small>
                )}
              </div>
            )}

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
            <button type="button" disabled={!canReview || loading || quoteLoading || !isBargainValid} onClick={prepareLockedQuote}>
              {quoteLoading ? 'Locking price...' : loading ? 'Booking...' : 'Review and book'} <ArrowRight size={18} />
            </button>
          </section>
        </main>
      </section>

      {showConfirm && (
        <div className="booking-modal-backdrop">
          <div className="booking-modal">
            <h3>Confirm booking</h3>
            <p>{lockedQuote?.quoteContext?.serviceType || selectedType} for {name || 'consumer'}.</p>
            <div className="booking-modal-summary">
              <span>Phone: {userPhone}</span>
              <span>Address: {address}</span>
              <span>Time: {scheduleText}</span>
              <span>Locked price: {formatInr(lockedQuote?.finalConsumerPrice)}</span>
              {bargainPrice && isBargainValid ? (
                <>
                  <span style={{ color: 'var(--success)' }}>Requested discount price: {formatInr(finalPriceToCharge)}</span>
                  <span>Platform fee: {formatInr(0)} (Waived for bargain offer)</span>
                  <span>Worker receives: {formatInr(finalWorkerReceivable)}</span>
                </>
              ) : (
                <>
                  <span>Platform fee: {formatInr(lockedQuote?.platformFee || 0)}</span>
                  <span>Worker receives: {formatInr(lockedQuote?.workerReceivable || (lockedQuote?.finalConsumerPrice - (lockedQuote?.platformFee || 0)))}</span>
                </>
              )}
              <span>Price reason: {getDemandLabel(lockedQuote)}</span>
              <span>Price lock: {lockedQuote?.priceLockedUntil ? new Date(lockedQuote.priceLockedUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Missing'}</span>
            </div>
            <div className="booking-modal-price-note">
              <strong>Why this price?</strong>
              <ul>
                {consumerPriceReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
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
