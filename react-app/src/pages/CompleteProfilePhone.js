import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, storage } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { detectCurrentLocation } from '../context/LocationContext';

export default function CompleteProfilePhone() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationArea, setLocationArea] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [locationLat, setLocationLat] = useState(null);
  const [locationLng, setLocationLng] = useState(null);
  const [photoFile, setPhotoFile] = useState(null);
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
      setLocationArea(loc.displayName ? loc.displayName.split(',')[0].trim() : '');
      setLocationLat(loc.lat);
      setLocationLng(loc.lng);
    } catch {
      setError('Could not detect location. Please enter your city manually or allow location access and try again.');
    } finally {
      setDetectingLocation(false);
    }
  };

  const uploadProfilePhoto = async (uid) => {
    if (!photoFile) return auth.currentUser?.photoURL || '';
    if (!photoFile.type.startsWith('image/')) {
      throw new Error('Profile photo must be an image file.');
    }
    if (photoFile.size > 10 * 1024 * 1024) {
      throw new Error('Profile photo must be under 10 MB.');
    }
    const safeName = photoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
    const photoRef = ref(storage, `users/${uid}/profile/photo-${Date.now()}-${safeName}`);
    await uploadBytes(photoRef, photoFile, { contentType: photoFile.type });
    return getDownloadURL(photoRef);
  };

  const handleComplete = async (e) => {
    e.preventDefault();

    if (!name || !phone || !locationCity) {
      setError('Please enter your name, phone number, and city.');
      return;
    }

    if (phone.replace(/[^\d]/g, '').length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = auth.currentUser;
      if (!user) {
        navigate('/auth');
        return;
      }

      const photoURL = await uploadProfilePhoto(user.uid);
      const updateData = {
        name,
        displayName: name,
        phone,
        email: user.email || '',
        locationCity,
        locationArea,
        state,
        postalCode,
        photoURL,
        updatedAt: new Date(),
      };
      if (locationLat && locationLng) {
        updateData.locationLat = locationLat;
        updateData.locationLng = locationLng;
      }

      await setDoc(doc(db, 'users', user.uid), updateData, { merge: true });
      navigate('/my-bookings');
    } catch (err) {
      setError(err.message || 'Could not complete profile.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '10px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontSize: '14px',
    boxSizing: 'border-box',
  };

  return (
    <div style={{
      maxWidth: '460px',
      margin: '50px auto',
      padding: '30px',
      border: '1px solid #ddd',
      borderRadius: '8px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
      fontFamily: 'Arial, sans-serif',
    }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>
        Complete Your Profile
      </h1>

      <p style={{ color: '#666', marginBottom: '20px', textAlign: 'center', fontSize: '14px' }}>
        Save the details needed for faster, safer bookings.
      </p>

      {error && (
        <div style={{
          padding: '12px',
          marginBottom: '15px',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '4px',
          color: '#c00',
          fontSize: '14px',
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleComplete}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Profile photo
          </label>
          <input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] || null)} style={inputStyle} />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Full name
          </label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your full name" style={inputStyle} />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Phone number
          </label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Enter your 10-digit phone number" style={inputStyle} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
            Location
          </label>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '10px',
            background: '#f3e8ff',
            borderRadius: '8px',
            border: '1px solid #c4b5fd',
          }}>
            <input
              type="text"
              value={locationCity}
              onChange={(e) => setLocationCity(e.target.value)}
              placeholder="City"
              style={{ ...inputStyle, border: '1px solid #c4b5fd', borderRadius: '6px' }}
            />
            <button
              type="button"
              onClick={handleDetectLocation}
              disabled={detectingLocation}
              style={{
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                background: detectingLocation ? '#c4b5fd' : '#7c3aed',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: detectingLocation ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {detectingLocation ? 'Detecting...' : 'Detect'}
            </button>
          </div>

          <input
            type="text"
            value={locationArea}
            onChange={(e) => setLocationArea(e.target.value)}
            placeholder="Area / locality"
            style={{ ...inputStyle, marginTop: '10px' }}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
            <input type="text" value={state} onChange={(e) => setState(e.target.value)} placeholder="State" style={inputStyle} />
            <input
              type="text"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
              placeholder="Postal code"
              inputMode="numeric"
              style={inputStyle}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: loading ? '#ccc' : '#16a34a',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
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
        color: '#666',
      }}>
        <p style={{ margin: '0' }}>
          You can update your details anytime in your Profile page.
        </p>
      </div>
    </div>
  );
}
