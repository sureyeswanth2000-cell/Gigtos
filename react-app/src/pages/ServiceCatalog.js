import React from 'react';
import { Link } from 'react-router-dom';
import { getLaunchServices, getRecruitableServices, SERVICE_ICON_LABELS } from '../utils/serviceCatalog';
import { formatPriceBand, getSuggestedPriceBand } from '../utils/priceIntelligence';
import './ServiceCatalog.css';

const SERVICE_IMAGES = {
  'home-helper': 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80',
  'kitchen-help': 'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80',
  'house-cleaning': 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=900&q=80',
  'kitchen-cleaning': 'https://images.unsplash.com/photo-1556911073-38141963c9e0?auto=format&fit=crop&w=900&q=80',
  'bathroom-cleaning': 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=900&q=80',
  'bedroom-cleaning': 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=80',
  'full-house-cleaning': 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=900&q=80',
  electrician: 'https://images.unsplash.com/photo-1621905251918-48416bd8575a?auto=format&fit=crop&w=900&q=80',
  plumber: 'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=900&q=80',
  carpenter: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=900&q=80',
  painter: 'https://images.unsplash.com/photo-1562259949-e8e7689d7828?auto=format&fit=crop&w=900&q=80',
};

const CATEGORY_LABELS = {
  maid: 'Maid Help',
  cleaning: 'Cleaning',
  repair: 'Repair',
};

export default function ServiceCatalog() {
  const [query, setQuery] = React.useState('');
  const [activeCategory, setActiveCategory] = React.useState('all');
  const launchIds = new Set(getLaunchServices().map((service) => service.id));
  const allServices = getRecruitableServices();
  const categories = ['all', ...Array.from(new Set(allServices.map((service) => service.category)))];

  const services = allServices.filter((service) => {
    const value = query.trim().toLowerCase();
    const categoryMatches = activeCategory === 'all' || service.category === activeCategory;
    if (!categoryMatches) return false;
    if (!value) return true;
    return service.name.toLowerCase().includes(value) || service.category.toLowerCase().includes(value);
  });

  return (
    <div className="service-catalog-page">
      <section className="service-catalog-hero">
        <div>
          <span className="catalog-eyebrow">Verified service marketplace</span>
          <h1>Available Experts</h1>
          <p>
            Find maid help, cleaners, electricians, and rare services from verified workers near your area.
            Gigtos keeps price guidance clear while workers keep freedom over their work.
          </p>
        </div>
        <form className="service-catalog-search" onSubmit={(event) => event.preventDefault()}>
          <span aria-hidden="true">⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search services..."
            aria-label="Search all services"
          />
        </form>
      </section>

      <section className="service-catalog-layout">
        <aside className="service-filter-panel" aria-label="Service filters">
          <div className="service-filter-block">
            <h2>Category</h2>
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                className={activeCategory === category ? 'active' : ''}
                onClick={() => setActiveCategory(category)}
              >
                <span>{activeCategory === category ? '✓' : ''}</span>
                {category === 'all' ? 'All Services' : CATEGORY_LABELS[category] || category}
              </button>
            ))}
          </div>

          <div className="service-filter-block">
            <h2>Availability</h2>
            <p>Show services by 10 km worker radius first, then city-wide supply for rarer skills.</p>
          </div>

          <div className="service-help-card">
            <strong>Need help choosing?</strong>
            <p>Start with area services for same-day work. City-wide services are better for rare or planned jobs.</p>
          </div>
        </aside>

        <div className="service-results">
          <div className="service-results-toolbar">
            <div>
              <h2>{services.length} Services Found</h2>
              <p>Sort: Best match • SocioScore and price intelligence ready</p>
            </div>
            <button type="button">Show Map</button>
          </div>

          <div className="service-catalog-grid">
            {services.map((service) => {
              const band = getSuggestedPriceBand({ serviceType: service.name });
              const isLaunch = launchIds.has(service.id);
              return (
                <article key={service.id} className="service-catalog-card">
                  <div className="service-card-image">
                    <img src={SERVICE_IMAGES[service.id]} alt="" loading="lazy" />
                    <span>{SERVICE_ICON_LABELS[service.icon] || service.category}</span>
                    <em>Verified</em>
                  </div>
                  <div className="service-card-body">
                    <div className="service-catalog-card-top">
                      <div>
                        <span>{CATEGORY_LABELS[service.category] || service.category}</span>
                        <strong>{service.name}</strong>
                      </div>
                      <em className={isLaunch ? 'launch' : ''}>
                        {isLaunch ? 'Area ready' : 'City-wide'}
                      </em>
                    </div>
                    <div className="service-catalog-meta">
                      <span>{service.matchingScope === 'area_10km' ? '10 km matching' : 'City-wide matching'}</span>
                      <span>{service.requiresBeforeAfterPhotos ? 'Photo proof' : 'Standard proof'}</span>
                    </div>
                    <div className="service-catalog-price">
                      <span>Suggested fair range</span>
                      <strong>{formatPriceBand(band)}</strong>
                    </div>
                    <Link to={`/service?type=${encodeURIComponent(service.name)}`}>
                      Book service
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          <section className="catalog-trust-band">
            <span>Trust & Safety Guarantee</span>
            <h2>Every booking is secured and every worker action can be verified.</h2>
            <p>Before/after photos, consumer feedback, SocioScore history, and payment records create a cleaner path than hidden commission pressure.</p>
          </section>
        </div>
      </section>
    </div>
  );
}
