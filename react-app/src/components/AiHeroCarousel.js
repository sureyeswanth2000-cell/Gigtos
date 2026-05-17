import React, { useState, useEffect, useCallback } from 'react';
import AiActivityMonitor from './AiActivityMonitor';
import './AiHeroCarousel.css';

const CYCLE_INTERVAL_MS = 6000;

const VIEWS = [
  {
    label: 'Ask Gito AI',
    eyebrow: 'Smart booking',
    meta: 'Fast quote guidance',
  },
  {
    label: 'Nearby Workers',
    eyebrow: 'Live supply',
    meta: '10 km availability',
  },
];

const QUERIES = [
  { label: 'Kitchen tap leak', query: 'Fix a leaky kitchen tap today', intent: 'Urgent repair' },
  { label: '2BHK painting', query: 'Paint a 2BHK apartment next week', intent: 'Planned work' },
  { label: 'Fan switchboard', query: 'Need an electrician for fan and switchboard', intent: 'Electrician' },
];

export default function AiHeroCarousel({ onQuerySelect, onBookWorker }) {
  const [activeView, setActiveView] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    const timer = setInterval(() => {
      setActiveView((v) => (v === 0 ? 1 : 0));
    }, CYCLE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [paused]);

  const handleToggle = useCallback((index) => {
    setActiveView(index);
    setPaused(true);
  }, []);

  useEffect(() => {
    if (!paused) return undefined;
    const resume = setTimeout(() => setPaused(false), CYCLE_INTERVAL_MS * 2);
    return () => clearTimeout(resume);
  }, [paused]);

  return (
    <section className="ai-carousel" aria-label="Gito AI Hub">
      <div className="ai-carousel__shell">
        <div className="ai-carousel__header">
          <div>
            <span className="ai-carousel__eyebrow">Gigtos command center</span>
            <h2>Book faster with AI and live worker supply</h2>
          </div>
          <span className="ai-carousel__status">Availability aware</span>
        </div>

        <div className="ai-carousel__tabs" role="tablist" aria-label="Gito AI panel views">
          {VIEWS.map((view, index) => (
            <button
              key={view.label}
              role="tab"
              aria-selected={activeView === index}
              className={activeView === index ? 'active' : ''}
              onClick={() => handleToggle(index)}
              type="button"
            >
              <span>{view.eyebrow}</span>
              <strong>{view.label}</strong>
              <small>{view.meta}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="ai-carousel__progress">
        <div
          className="ai-carousel__progress-fill"
          key={`${activeView}-${paused}`}
          style={{ animationDuration: paused ? '0s' : `${CYCLE_INTERVAL_MS}ms` }}
        />
      </div>

      <div className="ai-carousel__viewport">
        <div
          className="ai-carousel__track"
          style={{ transform: `translateX(-${activeView * 100}%)` }}
        >
          <div className="ai-carousel__panel" aria-hidden={activeView !== 0}>
            <div className="ai-ask-panel">
              <div className="ai-ask-panel__copy">
                <span>Quick start</span>
                <h3>Tell Gito the job. It will prepare the booking path.</h3>
                <p>Choose one, then edit details in the assistant if needed.</p>
              </div>
              <div className="query-list" aria-label="Suggested AI prompts">
                {QUERIES.map((query) => (
                  <button
                    key={query.query}
                    type="button"
                    onClick={() => onQuerySelect?.(query.query)}
                  >
                    <span>{query.intent}</span>
                    <strong>{query.label}</strong>
                    <small>{query.query}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="ai-carousel__panel" aria-hidden={activeView !== 1}>
            <AiActivityMonitor onBookWorker={onBookWorker} />
          </div>
        </div>
      </div>

      <div className="ai-carousel__dots">
        {[0, 1].map((i) => (
          <button
            key={i}
            className={`ai-carousel__dot${activeView === i ? ' active' : ''}`}
            onClick={() => handleToggle(i)}
            aria-label={i === 0 ? 'Show Ask Gito AI' : 'Show Nearby Workers'}
            type="button"
          />
        ))}
      </div>
    </section>
  );
}
