import React, { useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import './SocialLanding.css';

// ── Floating particle data ───────────────────────────────────
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  size: Math.random() * 6 + 3,
  left: Math.random() * 100,
  delay: Math.random() * 12,
  duration: Math.random() * 14 + 10,
  color: i % 3 === 0 ? '#ff6b35' : i % 3 === 1 ? '#7c3aed' : '#10b981',
}));

// ── Fee cards ────────────────────────────────────────────────
const FEE_CARDS = [
  {
    icon: '🚫',
    title: 'No Platform Fee',
    desc: 'We never charge consumers any hidden platform or booking fee.',
    badge: 'INR 0',
  },
  {
    icon: '✂️',
    title: 'No Commission Cut',
    desc: 'Workers keep 100% of what they earn. We take zero cut.',
    badge: 'Zero %',
  },
  {
    icon: '🔓',
    title: 'No Extra Charges',
    desc: 'The price you see is the price you pay. No surprises.',
    badge: 'Transparent',
  },
  {
    icon: '🎁',
    title: 'First Month Free',
    desc: 'Workers get full platform access free for the first month. No card needed.',
    badge: 'Launch Offer',
  },
];

// ── Worker perks ─────────────────────────────────────────────
const WORKER_PERKS = [
  'Keep 100% of your job earnings',
  'Verified profile + GigScore badge',
  'Smart Queue delivers jobs to you',
  'First month completely free access',
  'No exclusivity — work anywhere',
];

// ── Consumer perks ───────────────────────────────────────────
const CONSUMER_PERKS = [
  'Verified, experienced workers only',
  'Honest price — no surprise charges',
  'Pay after work is done (COD/UPI)',
  'Real-time worker arrival tracking',
  'Dispute support if anything goes wrong',
];

// ── Stats ────────────────────────────────────────────────────
const STATS = [
  { num: '₹0', label: 'Platform fee for consumers' },
  { num: '0%', label: 'Commission taken from workers' },
  { num: '100%', label: 'Worker earnings kept' },
  { num: 'Free', label: 'First month for workers' },
];

// ── Testimonials ─────────────────────────────────────────────
const TESTIMONIALS = [
  {
    stars: '★★★★★',
    quote: '"Finally a platform that doesn\'t eat my earnings. I charged ₹800 for a kitchen cleaning — I got ₹800. That\'s it. No deductions."',
    name: 'Ravi K.',
    role: 'Maid / Cleaning Professional · Bangalore',
    avatar: '👷',
    bg: 'rgba(124,58,237,0.12)',
  },
  {
    stars: '★★★★★',
    quote: '"The worker arrived on time, did a great job, and I paid exactly what was shown. No hidden charges. Gigtos is how it should be."',
    name: 'Priya M.',
    role: 'Consumer · Hyderabad',
    avatar: '👩',
    bg: 'rgba(255,107,53,0.1)',
  },
];

export default function SocialLanding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const ref = searchParams.get('ref') || '';
  const heroRef = useRef(null);

  // Scroll-triggered animation observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('sl-animate');
          }
        });
      },
      { threshold: 0.12 }
    );
    const els = document.querySelectorAll('[data-animate]');
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // Track ref param for analytics (console only for now; hook Sentry/analytics here later)
  useEffect(() => {
    if (ref) {
      // analytics.track('social_landing_visit', { ref });
      console.log('[Gigtos] Social landing visit from ref:', ref);
    }
  }, [ref]);

  const handleWorkerJoin = () => navigate('/auth?mode=worker&phase=signup');
  const handleBookService = () => navigate('/services');

  const shareOnWhatsApp = () => {
    const msg = encodeURIComponent(
      '🔥 Gigtos — India\'s Fairest Home Services App!\n\n✅ No platform fee\n✅ No commission\n✅ Workers keep 100% earnings\n✅ First month FREE for workers\n\nBook a service or join as a worker 👇\nhttps://gigtos.com'
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank', 'noopener');
  };

  return (
    <div className="sl-root">
      {/* Animated background */}
      <div className="sl-bg" aria-hidden="true" />

      {/* Floating particles */}
      <div className="sl-particles" aria-hidden="true">
        {PARTICLES.map((p) => (
          <span
            key={p.id}
            className="sl-particle"
            style={{
              width: p.size,
              height: p.size,
              left: `${p.left}%`,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>

      <div className="sl-content">
        {/* ── Top Bar ─────────────────────────────────────── */}
        <header className="sl-topbar" role="banner">
          <Link to="/" className="sl-topbar-brand" aria-label="Gigtos home">Gigtos</Link>
          <div className="sl-topbar-actions">
            <button className="sl-btn-ghost" onClick={handleWorkerJoin} id="sl-topbar-join-btn">
              Join as Worker
            </button>
            <button className="sl-btn-primary" onClick={handleBookService} id="sl-topbar-book-btn">
              Book a Service
            </button>
          </div>
        </header>

        {/* ── Hero ────────────────────────────────────────── */}
        <section className="sl-hero" aria-labelledby="sl-hero-headline" ref={heroRef}>
          <div className="sl-hero-kicker" role="note">
            <span className="sl-hero-kicker-dot" aria-hidden="true" />
            India's Fairest Home Services Platform · Bangalore & Hyderabad
          </div>

          <h1 id="sl-hero-headline">
            Earn <span className="sl-accent-orange">100%</span> of what you charge.{' '}
            <span className="sl-accent-purple">No cuts. Ever.</span>
          </h1>

          <p className="sl-hero-sub">
            Gigtos connects verified home service workers with consumers who need them.
            Workers keep every rupee they earn. Consumers pay only after work is done.
            No hidden charges. No platform fee. No nonsense.
          </p>

          <div className="sl-hero-ctas">
            <button
              className="sl-btn-hero-primary"
              onClick={handleBookService}
              id="sl-hero-book-btn"
              aria-label="Book a home service"
            >
              🏠 Book a Service
            </button>
            <button
              className="sl-btn-hero-secondary"
              onClick={handleWorkerJoin}
              id="sl-hero-join-btn"
              aria-label="Join Gigtos as a worker"
            >
              👷 Join as Worker →
            </button>
          </div>

          <div className="sl-hero-trust" aria-label="Trust indicators">
            {['Verified workers only', 'Pay after work done', '100% worker earnings', 'Free first month'].map((item) => (
              <div key={item} className="sl-hero-trust-item">
                <span className="sl-check" aria-hidden="true">✓</span>
                {item}
              </div>
            ))}
          </div>
        </section>

        {/* ── No Fees Strip ───────────────────────────────── */}
        <section
          className="sl-fees-strip"
          aria-labelledby="sl-fees-heading"
          data-animate
          style={{ opacity: 0 }}
        >
          <h2 id="sl-fees-heading" className="sl-section-label">Our Promise to You</h2>
          <div className="sl-fees-strip-inner">
            {FEE_CARDS.map((card) => (
              <article key={card.title} className="sl-fee-card">
                <span className="sl-fee-icon" aria-hidden="true">{card.icon}</span>
                <h3 className="sl-fee-title">{card.title}</h3>
                <p className="sl-fee-desc">{card.desc}</p>
                <span className="sl-fee-badge">{card.badge}</span>
              </article>
            ))}
          </div>
        </section>

        {/* ── Stats ───────────────────────────────────────── */}
        <section
          className="sl-stats"
          aria-label="Key platform numbers"
          data-animate
          style={{ opacity: 0 }}
        >
          {STATS.map((s) => (
            <div key={s.label} className="sl-stat-card">
              <span className="sl-stat-num">{s.num}</span>
              <span className="sl-stat-label">{s.label}</span>
            </div>
          ))}
        </section>

        {/* ── Worker + Consumer Split ──────────────────────── */}
        <section
          className="sl-split"
          aria-label="For workers and consumers"
          data-animate
          style={{ opacity: 0 }}
        >
          {/* Worker card */}
          <article className="sl-split-card sl-worker">
            <span className="sl-split-tag">For Workers 👷</span>
            <span className="sl-split-emoji" aria-hidden="true">💰</span>
            <h2>You earn 100%.<br />We take zero.</h2>
            <p>
              Join Gigtos as a verified home service worker. No commission, no exclusivity,
              no pressure. Work where you want, when you want. Your earnings are yours alone.
            </p>
            <div className="sl-split-perks" aria-label="Worker benefits">
              {WORKER_PERKS.map((perk) => (
                <div key={perk} className="sl-split-perk">
                  <span className="sl-perk-dot" aria-hidden="true">✓</span>
                  {perk}
                </div>
              ))}
            </div>
            <button
              className="sl-split-cta"
              onClick={handleWorkerJoin}
              id="sl-worker-cta-btn"
            >
              🚀 Join as Worker — First Month Free
            </button>
          </article>

          {/* Consumer card */}
          <article className="sl-split-card sl-consumer">
            <span className="sl-split-tag">For Consumers 🏠</span>
            <span className="sl-split-emoji" aria-hidden="true">🛡️</span>
            <h2>Trusted workers.<br />Honest prices.</h2>
            <p>
              Book verified, experienced workers for maid service, cleaning, electrical, and more.
              The price you see is the final price. Pay only after the work is done — in cash or UPI.
            </p>
            <div className="sl-split-perks" aria-label="Consumer benefits">
              {CONSUMER_PERKS.map((perk) => (
                <div key={perk} className="sl-split-perk">
                  <span className="sl-perk-dot" aria-hidden="true">✓</span>
                  {perk}
                </div>
              ))}
            </div>
            <button
              className="sl-split-cta"
              onClick={handleBookService}
              id="sl-consumer-cta-btn"
            >
              🏠 Book a Service Now
            </button>
          </article>
        </section>

        {/* ── Testimonials ────────────────────────────────── */}
        <section
          className="sl-social-proof"
          aria-labelledby="sl-testimonials-heading"
          data-animate
          style={{ opacity: 0 }}
        >
          <h2 id="sl-testimonials-heading" className="sl-section-label">What People Are Saying</h2>
          <div className="sl-testimonials">
            {TESTIMONIALS.map((t) => (
              <blockquote key={t.name} className="sl-testimonial">
                <div className="sl-testimonial-stars" aria-label="5 stars">{t.stars}</div>
                <p className="sl-testimonial-quote">{t.quote}</p>
                <footer className="sl-testimonial-author">
                  <span
                    className="sl-testimonial-avatar"
                    style={{ background: t.bg }}
                    aria-hidden="true"
                  >
                    {t.avatar}
                  </span>
                  <div>
                    <div className="sl-testimonial-name">{t.name}</div>
                    <div className="sl-testimonial-role">{t.role}</div>
                  </div>
                </footer>
              </blockquote>
            ))}
          </div>
        </section>

        {/* ── Final CTA ───────────────────────────────────── */}
        <section
          className="sl-final-cta"
          aria-labelledby="sl-final-heading"
          data-animate
          style={{ opacity: 0 }}
        >
          <div className="sl-final-cta-card">
            <h2 id="sl-final-heading">
              Ready to experience{' '}
              <span style={{ color: 'var(--sl-orange)' }}>fair</span>{' '}
              home services?
            </h2>
            <p>
              Join thousands of workers and consumers already on Gigtos.
              Share with a friend and help build India's most ethical gig platform.
            </p>
            <div className="sl-final-btns">
              <button
                className="sl-btn-whatsapp"
                onClick={shareOnWhatsApp}
                id="sl-whatsapp-share-btn"
                aria-label="Share Gigtos on WhatsApp"
              >
                <span aria-hidden="true">💬</span>
                Share on WhatsApp
              </button>
              <button
                className="sl-btn-hero-primary"
                onClick={handleWorkerJoin}
                id="sl-final-worker-btn"
                style={{ padding: '14px 28px', fontSize: '15px' }}
              >
                Join as Worker
              </button>
              <button
                className="sl-btn-hero-secondary"
                onClick={handleBookService}
                id="sl-final-consumer-btn"
                style={{ padding: '14px 28px', fontSize: '15px' }}
              >
                Book a Service
              </button>
            </div>
          </div>
        </section>

        {/* ── Footer ──────────────────────────────────────── */}
        <footer className="sl-footer" role="contentinfo">
          <div className="sl-footer-brand">Gigtos</div>
          <p className="sl-footer-tagline">
            India's fairest home services marketplace · Bangalore & Hyderabad
          </p>
          <nav className="sl-footer-links" aria-label="Footer navigation">
            <Link to="/services" className="sl-footer-link">Book a Service</Link>
            <Link to="/workers" className="sl-footer-link">Join as Worker</Link>
            <Link to="/auth" className="sl-footer-link">Sign In</Link>
            <a href="https://gigtos.com/privacy-policy" className="sl-footer-link" target="_blank" rel="noopener noreferrer">Privacy Policy</a>
            <a href="https://gigtos.com/terms" className="sl-footer-link" target="_blank" rel="noopener noreferrer">Terms</a>
          </nav>
          <p className="sl-footer-copy">
            © {new Date().getFullYear()} Gigtos · Workers keep 100% of their earnings · No platform fee for consumers
          </p>
        </footer>
      </div>
    </div>
  );
}
