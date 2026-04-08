import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import ConsumerAiAssistant from '../components/ConsumerAiAssistant';
import { SERVICE_CATALOG } from '../utils/aiAssistant';
import { useLocation } from '../context/LocationContext';
import './Home.css';

function ServiceIcon({ serviceName }) {
  const icons = {
    Plumber: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 3a3 3 0 0 0 3 3h1v2h-1a5 5 0 0 1-5-5h2zm-6 2v2H8a2 2 0 0 0-2 2v2H4V9a4 4 0 0 1 4-4h2zm-6 8h2v2h12v-2h2v2a2 2 0 0 1-2 2h-1v3h-2v-3H9v3H7v-3H6a2 2 0 0 1-2-2v-2z" fill="currentColor" />
      </svg>
    ),
    Electrician: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13 2L4 13h6l-1 9 9-11h-6l1-9z" fill="currentColor" />
      </svg>
    ),
    Carpenter: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 17.25V21h3.75l11-11-3.75-3.75-11 11zM20.71 7.04a1 1 0 0 0 0-1.41L18.37 3.3a1 1 0 0 0-1.41 0L15.13 5.13l3.75 3.75 1.83-1.84z" fill="currentColor" />
      </svg>
    ),
    Painter: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M18 3H6a3 3 0 0 0-3 3v5a3 3 0 0 0 3 3h5v4a3 3 0 0 0 6 0v-2h1a3 3 0 0 0 3-3V6a3 3 0 0 0-3-3zm-8 7H6V6h4v4zm8 0h-6V6h6v4z" fill="currentColor" />
      </svg>
    ),
  };

  return <span className="service-icon">{icons[serviceName] || icons.Plumber}</span>;
}

export default function Home() {
  const navigate = useNavigate();
  const [selectedService, setSelectedService] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const { location } = useLocation() || {};
  const cityName = location?.city || 'your area';

  const services = SERVICE_CATALOG;
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
  const handleBookService = (service) => {
    // If not logged in, redirect to auth with user mode
    if (!auth.currentUser) {
      navigate('/auth?mode=user');
      return;
    }
    // Set selected service and show confirmation modal
    setSelectedService(service);
    setShowModal(true);
  };

  // Confirm selection and navigate to the detailed booking page
  const confirmBooking = () => {
    if (selectedService) {
      // Pass service type as a query parameter
      navigate(`/service?type=${selectedService.name}`);
      setShowModal(false);
    }
  };

  const scrollToSection = (sectionId) => {
    const target = document.getElementById(sectionId);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const visibleServices = services.filter((service) => {
    const query = serviceSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      service.name.toLowerCase().includes(query)
      || service.desc.toLowerCase().includes(query)
      || service.keywords?.some((keyword) => keyword.toLowerCase().includes(query))
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
            <button className="primary-btn" onClick={() => scrollToSection('services')}>Book a Service</button>
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
          {visibleServices.map((service) => (
            <article key={service.id} className="service-card">
              <div className="service-top">
                <ServiceIcon serviceName={service.name} />
                <span className="verified-chip">Verified Pro</span>
              </div>
              <h3>{service.name}</h3>
              <p>{service.desc}</p>
              <div className="service-card-actions">
                <button className="primary-btn" onClick={() => handleBookService(service)}>Book Service</button>
              </div>
            </article>
          ))}
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
        services={services}
        onBookService={handleBookService}
        externalPrompt={assistantPrompt}
        onPromptConsumed={() => setAssistantPrompt('')}
      />

      {/* Booking Confirmation Modal */}
      {showModal && selectedService && (
        <div className="booking-modal-overlay">
          <div className="booking-modal-card">
            <div className="booking-modal-head">
              <ServiceIcon serviceName={selectedService.name} />
              <h2>Book {selectedService.name}</h2>
              <p>
                {selectedService.desc}
              </p>
            </div>

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
          </div>
        </div>
      )}
    </div>
  );
}
