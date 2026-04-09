import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import ConsumerAiAssistant from '../components/ConsumerAiAssistant';
import { SERVICE_CATALOG } from '../utils/aiAssistant';
import { getSpecialJob } from '../config/specialJobs';
import { ALL_JOBS } from '../utils/jobListBuilder';
import { useLocation } from '../context/LocationContext';
import { getHeroCTAText } from '../utils/abTest';
import './Home.css';

const GEO_RADIUS_KM = 20;

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

  useEffect(() => {
    if (!location) return;

    const { lat, lng } = location;
    setAvailableJobIds(null);

    fetch(`/api/available-jobs?lat=${lat}&lng=${lng}&radius=${GEO_RADIUS_KM}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch available jobs');
        return res.json();
      })
      .then((data) => {
        const ids = Array.isArray(data) ? data : data.jobs || data.jobIds || [];
        setAvailableJobIds(new Set(ids.map(String)));
      })
      .catch(() => {
        // If API is unavailable, show all jobs as available (graceful degradation)
        setAvailableJobIds(new Set(ALL_JOBS.map((j) => j.id)));
      });
  }, [location]);

  const trustPillars = [
    'Verified professionals with identity checks',
    'Transparent quote-based pricing before approval',
    'Fast support and on-time service updates',
  ];
  const steps = [
    {
      title: 'Tell us your problem',
      description: 'Describe the job in plain language and add photos if needed.',
    },
    {
      title: 'Compare quotes',
      description: `Receive quotes from local, verified workers near you.`,
    },
    {
      title: 'Book with confidence',
      description: 'Confirm your preferred worker and track updates in one place.',
    },
  ];
  const testimonials = [
    {
      name: 'Sravani M.',
      text: 'Gigtos found me a plumber in under an hour. The quote was clear and fair.',
    },
    {
      name: 'Ravi Kumar',
      text: 'I loved comparing options before booking. The process felt safe and simple.',
    },
  ];

  // Handle service selection and login check
  const handleBookService = (job) => {
    // Block booking for services not available in the user's area
    const isAvailable = availableJobIds === null || availableJobIds.has(String(job.id));
    if (!isAvailable) return;

    // If not logged in, redirect to auth with user mode
    if (!auth.currentUser) {
      navigate('/auth?mode=user');
      return;
    }
    // Set selected job and show confirmation/subtype modal
    setSelectedService(job);
    setSelectedSubtype(null);
    setShowModal(true);
  };

  // Confirm selection and navigate to the detailed booking page
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
      <section className="hero-shell" id="discover">
        <div className="hero-intro">
          <p className="eyebrow">{cityName} local network</p>
          <h1>Trusted home services, booked in minutes.</h1>
          <p className="hero-subtext">
            From urgent repairs to planned upgrades, Gigtos helps you find verified professionals with transparent quotes.
          </p>
          <div className="hero-actions">
            <button className="primary-btn" onClick={() => scrollToSection('services')} aria-label="Get started with Gigtos">{getHeroCTAText()}</button>
            <button className="secondary-btn" onClick={() => scrollToSection('how-it-works')}>How It Works</button>
          </div>
          <div className="trust-row">
            {trustPillars.map((pillar) => (
              <span key={pillar} className="trust-pill">{pillar}</span>
            ))}
          </div>
        </div>

        <div className="hero-assistant-panel">
          <h2>Ask Gito AI</h2>
          <p>Try specific prompts for faster results:</p>
          <div className="query-list">
            {[
              'Fix a leaky kitchen tap today',
              'Paint a 2BHK apartment next week',
              'Need an electrician for fan and switchboard',
            ].map((query) => (
              <button key={query} onClick={() => setAssistantPrompt(query)}>
                {query}
              </button>
            ))}
          </div>
          <small>Gito AI will open automatically with your selected query.</small>
        </div>
      </section>

      <section className="services-section" id="services">
        <div className="section-header-row">
          <div>
            <p className="eyebrow">Popular in {cityName}</p>
            <h2>Popular Services in {cityName}</h2>
          </div>
          <p className="section-caption">Verified pro availability updates daily</p>
        </div>

        <div className="services-tools">
          <input
            type="text"
            value={serviceSearch}
            onChange={(event) => setServiceSearch(event.target.value)}
            placeholder="Search services (plumber, electrician, painting...)"
            aria-label="Search services"
          />
        </div>

        <div className="services-grid">
          {visibleServices.map((job) => {
            const isAvailable = availableJobIds === null || availableJobIds.has(String(job.id));
            const isCheckingAvailability = availableJobIds === null && location;

            return (
              <article key={job.id} className={`service-card${!isAvailable ? ' service-card--disabled' : ''}`}>
                <div className="service-top">
                  <span className="service-icon" role="img" aria-label={job.name}>{job.icon || '🔧'}</span>
                  {!isAvailable ? (
                    <span className="coming-soon-chip">Coming Soon</span>
                  ) : (
                    <span className="verified-chip">{job.isUpcoming ? 'Coming Soon' : 'Verified Pro'}</span>
                  )}
                </div>
                <h3>{job.name}</h3>
                <p>{job.desc}</p>
                {!isAvailable && (
                  <span className="coming-soon-area-label">🚀 Coming soon in your area</span>
                )}
                <div className="service-card-actions">
                  {!isAvailable ? (
                    <button className="primary-btn" disabled>
                      Coming Soon
                    </button>
                  ) : (
                    <button className="primary-btn" onClick={() => handleBookService(job)} disabled={isCheckingAvailability}>
                      {isCheckingAvailability ? 'Checking…' : job.isSpecial ? 'View Options' : 'Book Service'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        {visibleServices.length === 0 && (
          <div className="no-services-note">
            No services found for "{serviceSearch}". Try another keyword or ask Gito AI.
          </div>
        )}
      </section>

      <section className="steps-section" id="how-it-works">
        <div className="section-header-row">
          <h2>Seamless in 3 steps</h2>
          <p className="section-caption">Built for quick decisions and safer bookings</p>
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

      <section className="testimonials-section" id="trust">
        <div className="section-header-row">
          <h2>Customer confidence, every booking</h2>
          <p className="section-caption">Real reviews from local households</p>
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

      <section className="why-section">
        <h2>Why choose Gigtos?</h2>
        <div className="why-grid">
          <div>
            <h3>Local-first matching</h3>
            <p>We prioritize professionals who actively service your neighborhood in {cityName}.</p>
          </div>
          <div>
            <h3>Transparent quotes</h3>
            <p>Approve only when the quote, timeline, and worker details look right for your job.</p>
          </div>
          <div>
            <h3>Reliable support</h3>
            <p>Need help with re-scheduling or follow-up? Our support flow is built into your booking journey.</p>
          </div>
        </div>
      </section>

      <ConsumerAiAssistant
        services={SERVICE_CATALOG}
        onBookService={handleBookService}
        externalPrompt={assistantPrompt}
        onPromptConsumed={() => setAssistantPrompt('')}
      />

      {/* Booking / Subtype Selection Modal */}
      {showModal && selectedService && (
        <div className="booking-modal-overlay">
          <div className="booking-modal-card">
            <div className="booking-modal-head">
              <span className="service-icon" role="img" aria-label={selectedService.name}
                style={{ fontSize: '38px', width: 'auto', height: 'auto' }}>{selectedService.icon || '🔧'}</span>
              <h2>{selectedService.isSpecial ? selectedService.name : `Book ${selectedService.name}`}</h2>
              <p>{selectedService.desc}</p>
            </div>

            {selectedService.isSpecial ? (
              <>
                <div className="query-list">
                  {(getSpecialJob(selectedService.id)?.subtypes || []).map((subtype) => (
                    <button
                      key={subtype.id}
                      onClick={() => setSelectedSubtype(subtype)}
                      style={selectedSubtype?.id === subtype.id ? { borderColor: 'var(--color-brand-600)', borderStyle: 'solid', background: '#fff' } : {}}
                    >
                      {subtype.icon} {subtype.label} — {subtype.desc}
                    </button>
                  ))}
                </div>

                <div className="modal-actions">
                  <button onClick={() => setShowModal(false)} className="cancel-btn">
                    Cancel
                  </button>
                  <button
                    onClick={confirmBooking}
                    className="primary-btn"
                    disabled={!selectedSubtype}
                  >
                    {selectedSubtype ? `Book ${selectedSubtype.label} →` : 'Select an option'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="modal-benefits">
                  <p>
                    ✓ Verified worker profiles<br />
                    ✓ Quote-based approval flow<br />
                    ✓ Flexible time-slot booking<br />
                    ✓ Real-time update tracking
                  </p>
                </div>

                <div className="modal-actions">
                  <button onClick={() => setShowModal(false)} className="cancel-btn">
                    Cancel
                  </button>
                  <button onClick={confirmBooking} className="primary-btn">
                    Proceed to Book
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
