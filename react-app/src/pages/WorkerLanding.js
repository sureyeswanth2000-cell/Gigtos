import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  CheckCircle2,
  IndianRupee,
  MapPin,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { getLaunchServices } from '../utils/serviceCatalog';
import { useSeo, buildPageUrl } from '../utils/seo';
import './WorkerLanding.css';

const HERO_IMAGE = 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=1600&q=82';

const WORKER_PROMISES = [
  {
    icon: IndianRupee,
    title: 'Keep job earnings',
    text: 'During MVP launch, the worker receives the full customer job price. No job commission is taken from worker earnings.',
  },
  {
    icon: Sparkles,
    title: 'Launch access',
    text: 'First month is free. Strong GigScore performance can unlock extra free access while launch supply grows.',
  },
  {
    icon: ShieldCheck,
    title: 'Verified-worker trust',
    text: 'Experienced workers with prior platform proof, profile photo, service area, and clean conduct get priority.',
  },
  {
    icon: MapPin,
    title: 'Open-to-Work control',
    text: 'You receive Smart Queue offers only after you press Open to Work for the matching area and service.',
  },
];

const STEPS = [
  'Create worker account with phone, service, and area.',
  'Upload profile and previous-platform proof for review.',
  'Set your worker price inside local SuperAdmin caps.',
  'Press Open to Work when you are ready for nearby jobs.',
];

export default function WorkerLanding() {
  const launchServices = getLaunchServices();
  useSeo({
    title: 'Join Gigtos As A Verified Worker - No Commission Launch',
    description: 'Experienced maid, cleaning, electrician, and repair workers can join Gigtos, keep job earnings during launch, and receive Smart Queue offers only when Open to Work.',
    path: '/#/workers',
    keywords: 'join Gigtos worker, home service worker jobs India, maid jobs Bangalore, cleaning worker jobs Hyderabad, no commission worker platform',
    image: HERO_IMAGE,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Join Gigtos As A Verified Worker',
      url: buildPageUrl('/#/workers'),
      description: 'Worker landing page for experienced Indian home-service workers joining Gigtos.',
      mainEntity: {
        '@type': 'Service',
        name: 'Gigtos worker onboarding',
        areaServed: ['Bangalore', 'Hyderabad', 'India'],
        serviceType: launchServices.map((service) => service.name),
        provider: {
          '@type': 'Organization',
          name: 'Gigtos',
          url: buildPageUrl('/'),
        },
      },
    },
  });

  return (
    <div className="worker-landing-page">
      <section className="worker-landing-hero">
        <img src={HERO_IMAGE} alt="Verified home-service worker preparing cleaning tools" />
        <div className="worker-landing-hero__content">
          <span><BadgeCheck size={16} /> Experienced workers wanted</span>
          <h1>Join Gigtos as a verified home-service worker</h1>
          <p>
            Start with maid help, cleaning, electrician, and repair services. Keep your job earnings during launch,
            choose when you are open to work, and build trust through GigScore.
          </p>
          <div className="worker-landing-actions">
            <Link to="/auth?mode=worker&phase=signup">
              Start worker signup <ArrowRight size={18} />
            </Link>
            <Link to="/services" className="secondary">
              View launch services
            </Link>
          </div>
        </div>
      </section>

      <section className="worker-landing-promises" aria-label="Worker launch promises">
        {WORKER_PROMISES.map(({ icon: Icon, title, text }) => (
          <article key={title}>
            <Icon size={22} />
            <h2>{title}</h2>
            <p>{text}</p>
          </article>
        ))}
      </section>

      <section className="worker-landing-flow">
        <div>
          <span className="worker-landing-kicker">First 10 minutes</span>
          <h2>What you need before approval</h2>
          <p>
            Gigtos is strict in MVP because consumer trust is the marketplace. Bring clean profile details,
            service experience, and area availability before you ask for jobs.
          </p>
        </div>
        <ol>
          {STEPS.map((step) => (
            <li key={step}>
              <CheckCircle2 size={18} />
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="worker-landing-services">
        <div className="worker-landing-section-head">
          <span className="worker-landing-kicker">Launch services</span>
          <h2>Where worker supply is needed first</h2>
        </div>
        <div className="worker-landing-service-grid">
          {launchServices.map((service) => (
            <article key={service.id}>
              <strong>{service.name}</strong>
              <span>{service.matchingScope === 'area_10km' ? 'Area and 10 km matching' : 'City matching'}</span>
              <small>{service.requiresBeforeAfterPhotos ? 'Before/after photo proof' : 'Standard proof'}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="worker-landing-proof">
        <div>
          <Camera size={24} />
          <h2>Proof protects good workers</h2>
        </div>
        <p>
          Profile photo, service proof, arrival checks, and completion photos help consumers trust the right worker
          arrived and help support review disputes without automatic unfair penalties.
        </p>
        <Link to="/auth?mode=worker&phase=signup">
          Apply as worker <ArrowRight size={18} />
        </Link>
      </section>
    </div>
  );
}
