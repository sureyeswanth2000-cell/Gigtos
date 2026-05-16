import React from 'react';
import { Link } from 'react-router-dom';
import { getRecruitableServices, getLaunchServices, SERVICE_ICON_LABELS } from '../utils/serviceCatalog';
import { formatPriceBand, getSuggestedPriceBand } from '../utils/priceIntelligence';
import './ServiceCatalog.css';

export default function ServiceCatalog() {
  const [query, setQuery] = React.useState('');
  const launchIds = new Set(getLaunchServices().map((service) => service.id));
  const services = getRecruitableServices().filter((service) => {
    const value = query.trim().toLowerCase();
    if (!value) return true;
    return service.name.toLowerCase().includes(value) || service.category.toLowerCase().includes(value);
  });

  return (
    <div className="service-catalog-page">
      <section className="service-catalog-hero">
        <div>
          <span>Service marketplace</span>
          <h1>Services marketplace</h1>
          <p>
            Search once, book fast. Launch focus is maid/helper, cleaning, and electrician; all recruitable services appear as supply grows.
          </p>
        </div>
        <div className="service-catalog-search">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search all services"
            aria-label="Search all services"
          />
          <span>{services.length} found</span>
        </div>
      </section>

      <section className="service-catalog-grid">
        {services.map((service) => {
          const band = getSuggestedPriceBand({ serviceType: service.name });
          return (
            <article key={service.id} className="service-catalog-card">
              <div className="service-catalog-card-top">
                <div>
                  <span>{SERVICE_ICON_LABELS[service.icon] || service.category}</span>
                  <strong>{service.name}</strong>
                </div>
                <em className={launchIds.has(service.id) ? 'launch' : ''}>
                  {launchIds.has(service.id) ? 'MVP' : 'Recruit'}
                </em>
              </div>
              <div className="service-catalog-meta">
                <span>{service.category}</span>
                <span>{service.matchingScope}</span>
              </div>
              <div className="service-catalog-price">
                <span>Suggested fair range</span>
                <strong>{formatPriceBand(band)}</strong>
              </div>
              <Link to={`/service?type=${encodeURIComponent(service.name)}`}>
                Book service
              </Link>
            </article>
          );
        })}
      </section>
    </div>
  );
}
