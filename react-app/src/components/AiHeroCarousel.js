import React, { useState, useEffect, useCallback } from 'react';
import AiActivityMonitor from './AiActivityMonitor';
import './AiHeroCarousel.css';

const CYCLE_INTERVAL_MS = 6000;

/**
 * Merges the "Ask Gito AI" prompt panel and the "Nearby Workers" display into a
 * single location that alternates between the two views with a slide animation.
 *
 * Props:
 *  - onQuerySelect: (query: string) => void  — called when a prompt suggestion is clicked
 *  - onBookWorker:  (worker: object) => void  — called when a worker "Book Now" is clicked
 */
export default function AiHeroCarousel({ onQuerySelect, onBookWorker }) {
  const [activeView, setActiveView] = useState(0); // 0 = Ask AI, 1 = Nearby Workers
  const [paused, setPaused] = useState(false);

  // Auto-cycle between views
  useEffect(() => {
    if (paused) return;
    const timer = setInterval(() => {
      setActiveView((v) => (v === 0 ? 1 : 0));
    }, CYCLE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [paused]);

  const handleToggle = useCallback((index) => {
    setActiveView(index);
    // Pause auto-cycle for a while after manual switch
    setPaused(true);
  }, []);

  // Resume auto-cycle after manual interaction pause
  useEffect(() => {
    if (!paused) return;
    const resume = setTimeout(() => setPaused(false), CYCLE_INTERVAL_MS * 2);
    return () => clearTimeout(resume);
  }, [paused]);

  const queries = [
    'Fix a leaky kitchen tap today',
    'Paint a 2BHK apartment next week',
    'Need an electrician for fan and switchboard',
  ];

  return (
    <section className="ai-carousel" aria-label="Gito AI Hub">
      {/* Tab toggle */}
      <div className="ai-carousel__tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeView === 0}
          className={activeView === 0 ? 'active' : ''}
          onClick={() => handleToggle(0)}
        >
          💬 Ask Gito AI
        </button>
        <button
          role="tab"
          aria-selected={activeView === 1}
          className={activeView === 1 ? 'active' : ''}
          onClick={() => handleToggle(1)}
        >
          📍 Nearby Workers
        </button>
      </div>

      {/* Progress indicator */}
      <div className="ai-carousel__progress">
        <div
          className="ai-carousel__progress-fill"
          key={`${activeView}-${paused}`}
          style={{ animationDuration: paused ? '0s' : `${CYCLE_INTERVAL_MS}ms` }}
        />
      </div>

      {/* Sliding panels */}
      <div className="ai-carousel__viewport">
        <div
          className="ai-carousel__track"
          style={{ transform: `translateX(-${activeView * 100}%)` }}
        >
          {/* Panel 0: Ask Gito AI */}
          <div className="ai-carousel__panel" aria-hidden={activeView !== 0}>
            <div className="ai-ask-panel">
              <h2>Ask Gito AI</h2>
              <p>Try specific prompts for faster results:</p>
              <div className="query-list">
                {queries.map((query) => (
                  <button key={query} onClick={() => onQuerySelect?.(query)}>
                    {query}
                  </button>
                ))}
              </div>
              <small>Gito AI will open automatically with your selected query.</small>
            </div>
          </div>

          {/* Panel 1: Nearby Workers */}
          <div className="ai-carousel__panel" aria-hidden={activeView !== 1}>
            <AiActivityMonitor onBookWorker={onBookWorker} />
          </div>
        </div>
      </div>

      {/* Dots */}
      <div className="ai-carousel__dots">
        {[0, 1].map((i) => (
          <button
            key={i}
            className={`ai-carousel__dot${activeView === i ? ' active' : ''}`}
            onClick={() => handleToggle(i)}
            aria-label={i === 0 ? 'Show Ask Gito AI' : 'Show Nearby Workers'}
          />
        ))}
      </div>
    </section>
  );
}
