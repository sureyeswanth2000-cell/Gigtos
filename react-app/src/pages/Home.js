import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import ConsumerAiAssistant from '../components/ConsumerAiAssistant';
import AiHeroCarousel from '../components/AiHeroCarousel';
import NearbyWorkerNotification from '../components/NearbyWorkerNotification';
import InstantBookingModal from '../components/InstantBookingModal';
import { SERVICE_CATALOG } from '../utils/aiAssistant';
import { getSpecialJob } from '../config/specialJobs';
import { ALL_JOBS } from '../utils/jobListBuilder';
import { getHeroCTAText } from '../utils/abTest';
import { getServiceAvailability } from '../utils/availability';
import './Home.css';

const GEO_RADIUS_KM = 10;

export default function Home() {
  const navigate = useNavigate();
  const [selectedService, setSelectedService] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedSubtype, setSelectedSubtype] = useState(null);
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const { location } = useLocation() || {};
  const cityName = location?.city || 'your area';
  const [availableJobIds, setAvailableJobIds] = useState(null);
  const [instantWorker, setInstantWorker] = useState(null);
  const [userData, setUserData] = useState(null);

  // Load user data for instant booking
  useEffect(() => {
    if (!auth.currentUser) return;
    getDoc(doc(db, 'users', auth.currentUser.uid))
      .then((snap) => {
        if (snap.exists()) setUserData(snap.data());
      })
      .catch(() => { /* Firestore read failed */ });
  }, []);

  useEffect(() => {
    if (!location || !location.city) return;

    setAvailableJobIds(null);
    
    // Extract area from displayName if possible
    // e.g. "Indiranagar, Bengaluru, ..." -> "Indiranagar"
    const area = location.displayName ? location.displayName.split(',')[0].trim() : null;

    getServiceAvailability(location.city, area)
      .then((availabilityMap) => {
        setAvailableJobIds(availabilityMap);
      })
      .catch(() => {
        // Fallback: assume everything is available if check fails
        const fallback = {};
        ALL_JOBS.forEach(j => fallback[j.id] = 'city');
        setAvailableJobIds(fallback);
      });
  }, [location]);

  const trustPillars = [
    '🛡️ Identity Verified Pro\'s',
    '💰 Transparent Pre-quotes',
    '⚡ On-demand Response',
  ];

  const steps = [
    {
      title: 'Describe Your Task',
      description: 'Describe what you need help with in plain language. Add photos for more accurate quotes.',
    },
    {
      title: 'Compare Quotes',
      description: `Receive and compare fair quotes from top-rated, verified local professionals.`,
    },
    {
      title: 'Hassle-free Booking',
      description: 'Choose your pro, track their arrival, and pay securely after the job is done.',
    },
  ];

  const testimonials = [
    {
      name: 'Sravani M.',
      text: 'Gigtos found me a professional plumber in under 30 minutes. High quality and fair pricing.',
    },
    {
      name: 'Ravi Kumar',
      text: 'Comparing quotes before booking is a game changer. I felt in control of the pricing and quality.',
    },
  ];

  const handleBookService = (job) => {
    const isAvailable = availableJobIds && availableJobIds[String(job.id)] && availableJobIds[String(job.id)] !== 'none';
    if (!isAvailable) return;

    if (!auth.currentUser) {
      navigate('/auth?mode=user');
      return;
    }
    setSelectedService(job);
    setSelectedSubtype(null);
    setShowModal(true);
  };

  const confirmBooking = () => {
    if (selectedService) {
      if (selectedService.isSpecial && selectedSubtype) {
        navigate(`/service?type=${encodeURIComponent(selectedSubtype.label)}`);
      } else if (!selectedService.isSpecial) {
        navigate(`/service?type=${encodeURIComponent(selectedService.name)}`);
      }
      setShowModal(false);
    }
  };

  const scrollToSection = (sectionId) => {
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const visibleServices = ALL_JOBS.filter((job) => {
    const query = serviceSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      job.name.toLowerCase().includes(query)
      || job.desc.toLowerCase().includes(query)
      || (job.category || '').toLowerCase().includes(query)
      || (job.keywords || []).some((kw) => kw.toLowerCase().includes(query))
    );
  });

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-shell" id="discover">
        <div className="hero-intro">
          <span className="eyebrow">Local Network: {cityName}</span>
          <h1>Premium Home Services, Booked in Minutes.</h1>
          <p className="hero-subtext">
            Connecting you with top-tier verified professionals for any task, with instant transparent quotes.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => scrollToSection('services')}>{getHeroCTAText()}</button>
            <button className="btn-secondary" onClick={() => scrollToSection('how-it-works')}>See How it Works</button>
          </div>
          <div className="trust-row">
            {trustPillars.map((pillar) => (
              <span key={pillar} className="trust-pill">{pillar}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Dynamic AI Hero Carousel */}
      <AiHeroCarousel
        onQuerySelect={(query) => setAssistantPrompt(query)}
        onBookWorker={(w) => setInstantWorker(w)}
      />

      {/* Services Section */}
      <section className="services-section" id="services">
        <div className="section-header-row">
          <div>
            <span className="eyebrow">On-demand availability</span>
            <h2>Top Rated in {cityName}</h2>
          </div>
          <p className="section-caption">Verified pro availability updates every 60 seconds</p>
        </div>

        <div className="services-tools">
          <input
            type="text"
            value={serviceSearch}
            onChange={(event) => setServiceSearch(event.target.value)}
            placeholder="Search our 50+ services (e.g. plumber, cleaning...)"
            aria-label="Search services"
          />
        </div>

        <div className="services-grid">
          {visibleServices.map((job) => {
            const availLevel = availableJobIds ? availableJobIds[String(job.id)] : 'none';
            const isAvailable = availLevel === 'area' || availLevel === 'city';
            const isCheckingAvailability = availableJobIds === null && location;

            return (
              <article key={job.id} className={`service-card${!isAvailable ? ' service-card--disabled' : ''}`}>
                <div className="service-top">
                  <span className="service-icon" role="img" aria-label={job.name}>{job.icon || '🔧'}</span>
                  {!isAvailable ? (
                    <span className="coming-soon-chip">Coming Soon</span>
                  ) : (
                    <span className="verified-chip">
                      {availLevel === 'area' ? 'Near You' : 'Verified'}
                    </span>
                  )}
                </div>
                <h3>{job.name}</h3>
                <p>{job.desc}</p>
                <div className="service-card-actions">
                  <button 
                    className="btn-primary" 
                    onClick={() => handleBookService(job)} 
                    disabled={!isAvailable || isCheckingAvailability}
                    style={{
                      background: availLevel === 'area' ? 'linear-gradient(135deg, #10b981, #059669)' : ''
                    }}
                  >
                    {!isAvailable ? 'Notify Me' : (isCheckingAvailability ? 'Checking...' : (job.isSpecial ? 'Options' : 'Book Now'))}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {visibleServices.length === 0 && (
          <div className="no-services-note">
            No services found. Try asking our <strong>Gito AI</strong> for a custom quote.
          </div>
        )}
      </section>

      {/* How it Works Section */}
      <section className="steps-section" id="how-it-works">
        <div className="section-header-row">
          <h2>Seamless in 3 Easy Steps</h2>
          <p className="section-caption">Engineered for speed, built for reliability</p>
        </div>
        <div className="steps-grid">
          {steps.map((step, index) => (
            <div key={step.title} className="step-card">
              <span className="step-number">0{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials-section" id="trust">
        <div className="section-header-row">
          <h2>Customer Stories</h2>
          <p className="section-caption">Reviews from {cityName} households</p>
        </div>
        <div className="testimonial-grid">
          {testimonials.map((testimonial) => (
            <blockquote key={testimonial.name} className="testimonial-card">
              <p>“{testimonial.text}”</p>
              <footer>{testimonial.name}</footer>
            </blockquote>
          ))}
        </div>
      </section>

      {/* Why Gigtos */}
      <section className="why-section">
        <div className="section-header-row">
          <h2>Why Gigtos?</h2>
          <p className="section-caption">Setting the gold standard for the gig economy</p>
        </div>
        <div className="why-grid">
          <div>
            <h3>Hyper-Local Focus</h3>
            <p>We only show you pros who are currently active and nearby in {cityName}.</p>
          </div>
          <div>
            <h3>Fair Quote Guarantee</h3>
            <p>Compare multiple quotes instantly. No hidden fees or surprise upcharges.</p>
          </div>
          <div>
            <h3>Verified Security</h3>
            <p>Every worker undergoes detailed identity and background verification.</p>
          </div>
        </div>
      </section>

      {/* AI Assistant Hook */}
      <ConsumerAiAssistant
        services={SERVICE_CATALOG}
        onBookService={handleBookService}
        externalPrompt={assistantPrompt}
        onPromptConsumed={() => setAssistantPrompt('')}
      />

      {/* Overlays */}
      <NearbyWorkerNotification onBookWorker={(w) => setInstantWorker(w)} />

      {instantWorker && (
        <InstantBookingModal
          worker={instantWorker}
          userData={userData}
          onClose={() => setInstantWorker(null)}
          onBooked={() => {
            setInstantWorker(null);
            navigate('/my-bookings');
          }}
        />
      )}

      {showModal && selectedService && (
        <div className="booking-modal-overlay">
          <div className="booking-modal-card">
            <div className="booking-modal-head">
               <span className="service-icon">{selectedService.icon || '🔧'}</span>
              <h2>{selectedService.isSpecial ? selectedService.name : `Select ${selectedService.name}`}</h2>
              <p>{selectedService.desc}</p>
            </div>

            {selectedService.isSpecial ? (
              <div className="query-list">
                {(getSpecialJob(selectedService.id)?.subtypes || []).map((subtype) => {
                  const subAvail = availableJobIds ? availableJobIds[subtype.id] : 'none';
                  const isSubAvailable = subAvail === 'area' || subAvail === 'city';

                  return (
                    <button
                      key={subtype.id}
                      onClick={() => setSelectedSubtype(subtype)}
                      className={`${selectedSubtype?.id === subtype.id ? 'active' : ''}${!isSubAvailable ? ' disabled' : ''}`}
                      disabled={!isSubAvailable}
                      style={{
                        position: 'relative',
                        opacity: isSubAvailable ? 1 : 0.6
                      }}
                    >
                      <span className="subtype-icon">{subtype.icon}</span>
                      <div className="subtype-info">
                        <strong>{subtype.label}</strong>
                        <p>{subtype.desc}</p>
                        {!isSubAvailable && (
                          <span style={{ 
                            fontSize: '10px', 
                            color: 'var(--primary-purple)', 
                            fontWeight: 'bold',
                            display: 'block',
                            marginTop: '4px'
                          }}>
                            Coming Soon in {cityName}
                          </span>
                        )}
                        {subAvail === 'area' && (
                          <span style={{ 
                            fontSize: '10px', 
                            color: '#10b981', 
                            fontWeight: 'bold',
                            display: 'block',
                            marginTop: '4px'
                          }}>
                            ✓ Available Near You
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="modal-benefits">
                <p>✓ Transparent Bidding<br />✓ No Advanced Payment<br />✓ 24/7 Quality Support</p>
              </div>
            )}

            <div className="modal-actions">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button 
                onClick={confirmBooking} 
                className="btn-primary" 
                disabled={selectedService.isSpecial && !selectedSubtype}
              >
                Continue to Book
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

