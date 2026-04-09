import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from '../context/LocationContext';
import { geocodeCity } from '../context/LocationContext';

/**
 * LocationBar – persistent bar below the header showing the user's city
 * with an inline search to change location by city name.
 */
export default function LocationBar() {
  const { location, locationLoading, locationError, setManualLocation, detectLocation } = useLocation();
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  // Debounced city search
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      const hits = await geocodeCity(query.trim());
      setResults(hits || []);
      setSearching(false);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSelect = (place) => {
    setManualLocation({ lat: place.lat, lng: place.lng, city: place.city });
    setEditing(false);
    setQuery('');
    setResults([]);
  };

  const handleDetect = () => {
    detectLocation();
    setEditing(false);
    setQuery('');
    setResults([]);
  };

  const cityLabel = location?.city || (location ? `${location.lat.toFixed(2)}, ${location.lng.toFixed(2)}` : null);

  return (
    <div className="location-bar">
      <div className="location-bar-inner">
        {locationLoading ? (
          <span className="location-bar-detecting">
            <span className="location-bar-dot">📍</span> Detecting location…
          </span>
        ) : locationError && !location ? (
          <span className="location-bar-error">
            ⚠️ Location unavailable
            <button className="location-bar-btn" onClick={handleDetect}>Retry</button>
            <button className="location-bar-btn" onClick={() => setEditing(true)}>Set manually</button>
          </span>
        ) : (
          <>
            <span className="location-bar-city" onClick={() => setEditing(true)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setEditing(true); } }} role="button" tabIndex={0} aria-label="Change location">
              <span className="location-bar-dot">📍</span>
              <span className="location-bar-name">{cityLabel}</span>
              <span className="location-bar-change">▾</span>
            </span>
            {!editing && (
              <span className="location-bar-radius">Workers within 20 km</span>
            )}
          </>
        )}

        {editing && (
          <div className="location-bar-search">
            <input
              ref={inputRef}
              type="text"
              className="location-bar-input"
              placeholder="Search city or area…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search city or area"
            />
            <button className="location-bar-btn" onClick={handleDetect} title="Use my current location">
              📍 Detect
            </button>
            <button className="location-bar-btn location-bar-btn--close" onClick={() => { setEditing(false); setQuery(''); setResults([]); }}>
              ✕
            </button>

            {searching && <div className="location-bar-dropdown"><div className="location-bar-item">Searching…</div></div>}

            {!searching && results.length > 0 && (
              <div className="location-bar-dropdown">
                {results.map((place, i) => (
                  <button
                    key={i}
                    className="location-bar-item"
                    onClick={() => handleSelect(place)}
                  >
                    📍 {place.displayName}
                  </button>
                ))}
              </div>
            )}

            {!searching && query.trim().length >= 2 && results.length === 0 && (
              <div className="location-bar-dropdown">
                <div className="location-bar-item location-bar-item--empty">No results found</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
