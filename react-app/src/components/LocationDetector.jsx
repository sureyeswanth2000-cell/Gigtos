import React from 'react';
import { useLocation } from '../context/LocationContext';

/**
 * LocationDetector — shows current location status and a fallback input.
 * Renders inline (not a full page).
 */
export default function LocationDetector() {
  const {
    location,
    locationError,
    locationLoading,
    addressInput,
    setAddressInput,
    detectLocation,
    setManualLocation,
  } = useLocation();

  const handleAddressSubmit = (e) => {
    e.preventDefault();
    // Geocode the address using the open Nominatim API (no key required)
    const query = encodeURIComponent(addressInput.trim());
    fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`)
      .then((res) => res.json())
      .then((results) => {
        if (results && results.length > 0) {
          setManualLocation(parseFloat(results[0].lat), parseFloat(results[0].lon));
        } else {
          alert('Address not found. Please try a more specific location.');
        }
      })
      .catch(() => alert('Could not look up address. Please try again.'));
  };

  if (locationLoading) {
    return (
      <div style={styles.wrapper}>
        <span style={styles.spinner}>📍</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>Detecting your location…</span>
      </div>
    );
  }

  if (location) {
    return (
      <div style={{ ...styles.wrapper, color: 'var(--success)', fontSize: 13 }}>
        📍 Location detected —{' '}
        <button onClick={detectLocation} style={styles.relinkBtn}>
          refresh
        </button>
      </div>
    );
  }

  return (
    <div style={styles.errorWrapper}>
      <p style={{ margin: '0 0 8px', fontSize: 14, color: 'var(--text-dark)' }}>
        ⚠️ {locationError || 'Location unavailable.'}
      </p>
      <form onSubmit={handleAddressSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={addressInput}
          onChange={(e) => setAddressInput(e.target.value)}
          placeholder="Enter your city or address"
          required
          style={styles.input}
        />
        <button type="submit" style={styles.btn}>
          Go
        </button>
      </form>
      <button onClick={detectLocation} style={{ ...styles.relinkBtn, marginTop: 6 }}>
        Try auto-detect again
      </button>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 0',
  },
  spinner: {
    animation: 'pulse 1.4s infinite',
    fontSize: 16,
  },
  errorWrapper: {
    padding: '10px 14px',
    background: '#FFF7ED',
    border: '1px solid var(--warning)',
    borderRadius: 10,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    fontSize: 14,
    outline: 'none',
  },
  btn: {
    padding: '8px 16px',
    background: 'var(--primary-purple)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 14,
  },
  relinkBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--primary-purple)',
    cursor: 'pointer',
    fontSize: 13,
    textDecoration: 'underline',
    padding: 0,
  },
};
