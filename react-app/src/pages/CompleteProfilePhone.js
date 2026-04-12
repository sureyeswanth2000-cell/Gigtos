import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { detectCurrentLocation } from '../context/LocationContext';

export default function CompleteProfilePhone() {
  const [name, setName] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationLat, setLocationLat] = useState(null);
  const [locationLng, setLocationLng] = useState(null);
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) {
      navigate('/auth');
    }
  }, [navigate]);

  const handleDetectLocation = async () => {
    setDetectingLocation(true);
    setError('');
    try {
      const loc = await detectCurrentLocation();
      setLocationCity(loc.city || '');
      setLocationLat(loc.lat);
      setLocationLng(loc.lng);
    } catch {
      setError('Could not detect location. Please enter your city manually or allow location access and try again.');
    } finally {
      setDetectingLocation(false);
    }
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    
    if (!name || !locationCity) {
      setError('Please enter your name and location');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const uid = auth.currentUser.uid;
      
      // Update user profile in Firestore
      const updateData = {
        name: name,
        locationCity: locationCity,
        updatedAt: new Date()
      };
      if (locationLat && locationLng) {
        updateData.locationLat = locationLat;
        updateData.locationLng = locationLng;
      }
      await updateDoc(doc(db, 'users', uid), updateData);

      // Navigate to my bookings
      navigate('/my-bookings');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxWidth: '400px',
      margin: '50px auto',
      padding: '30px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{textAlign: 'center', marginBottom: '30px', color: '#333'}}>
        Complete Your Profile
      </h1>

      <p style={{color: '#666', marginBottom: '20px', textAlign: 'center', fontSize: '14px'}}>
        Just a few more details to get started!
      </p>

      {error && (
        <div style={{
          padding: '12px',
          marginBottom: '15px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c00',
          fontSize: '14px'
        }}>
          ⚠️ {error}
        </div>
      )}

      <form onSubmit={handleComplete}>
        <div style={{marginBottom: '15px'}}>
          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px'}}>
            Full Name:
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your full name"
            style={{
              width: '100%',
              padding: '10px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '14px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{marginBottom: '20px'}}>
          <label style={{display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px'}}>
            Location:
          </label>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '10px', background: '#f3e8ff', borderRadius: '8px',
            border: '1px solid #c4b5fd'
          }}>
            <input
              type="text"
              value={locationCity}
              onChange={(e) => setLocationCity(e.target.value)}
              placeholder="Enter your city"
              style={{
                flex: 1, fontSize: '14px', padding: '8px',
                border: '1px solid #c4b5fd', borderRadius: '6px',
                background: '#fff', color: '#1f2937',
                boxSizing: 'border-box'
              }}
            />
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={detectingLocation}
              style={{
                padding: '8px 14px', fontSize: '13px', fontWeight: 600,
                background: detectingLocation ? '#c4b5fd' : '#A259FF', color: '#fff', border: 'none',
                borderRadius: '6px', cursor: detectingLocation ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {detectingLocation ? '⏳ Detecting…' : '📍 Detect'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: loading ? '#ccc' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Completing...' : 'Continue to Bookings'}
        </button>
      </form>

      <div style={{
        marginTop: '20px',
        padding: '15px',
        backgroundColor: '#f0f0f0',
        borderRadius: '4px',
        fontSize: '13px',
        color: '#666'
      }}>
        <p style={{margin: '0'}}>
          💡 You can update your details anytime in your Profile page.
        </p>
      </div>
    </div>
  );
}
