import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const serviceIcons = {
  'Plumber': '🧰',
  'Electrician': '⚡',
  'Carpenter': '🪛',
  'Painter': '🎨'
};

export default function Service(){
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const type = params.get('type') || 'Service';
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [profileIncomplete, setProfileIncomplete] = useState(false);

  // Load user profile data
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setName(data.name || '');
          setAddress(data.address || '');
          setUserPhone(data.phone || '');

          if (!data.phone || !data.name || !data.address) {
            setProfileIncomplete(true);
          }
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      }
    };

    loadUserData();
  }, []);

  const handleBooking = async () => {
    if (!name || !address || !userPhone) {
      setError('Please complete your profile first (name, address, phone)');
      setProfileIncomplete(true);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const user = auth.currentUser;
      if (!user) throw new Error('Not authenticated');

      // Create booking in Firestore
      await addDoc(collection(db, 'bookings'), {
        userId: user.uid,
        serviceType: type,
        customerName: name,
        address: address,
        phone: userPhone,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      setSuccess('✓ Booking created successfully!');
      setShowConfirm(false);
      
      setTimeout(() => {
        navigate('/my-bookings');
      }, 1500);
    } catch (err) {
      setError('❌ ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <div style={{ fontSize: '60px', marginBottom: '10px' }}>
          {serviceIcons[type] || '🛠️'}
        </div>
        <h2 style={{ fontSize: '28px', margin: '10px 0', color: '#333' }}>
          Book {type}
        </h2>
        <p style={{ color: '#666', margin: '10px 0' }}>
          Professional & Verified Service
        </p>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#667eea', marginTop: '15px' }}>
          ₹200 Visiting Charge
        </div>
      </div>

      {/* Alert Messages */}
      {profileIncomplete && (
        <div style={{
          padding: '12px',
          marginBottom: '15px',
          backgroundColor: '#fff3cd',
          border: '1px solid #ffc107',
          borderRadius: '4px',
          color: '#856404',
          fontSize: '14px'
        }}>
          ⚠️ Please complete your profile (name, address, phone) before booking.
          <button
            onClick={() => navigate('/profile')}
            style={{
              display: 'block',
              marginTop: '10px',
              padding: '8px 15px',
              backgroundColor: '#ffc107',
              color: '#000',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '14px'
            }}
          >
            Go to Profile
          </button>
        </div>
      )}

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
          {error}
        </div>
      )}

      {success && (
        <div style={{
          padding: '12px',
          marginBottom: '15px',
          backgroundColor: '#efe',
          border: '1px solid #cfc',
          borderRadius: '4px',
          color: '#060',
          fontSize: '14px'
        }}>
          {success}
        </div>
      )}

      {/* Booking Details Card */}
      <div style={{
        backgroundColor: '#f9f9f9',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px',
        border: '1px solid #eee'
      }}>
        <h4 style={{ margin: '0 0 20px 0', color: '#333', fontSize: '16px', fontWeight: 'bold' }}>
          📋 Your Booking Details
        </h4>
        
        <div style={{ marginBottom: '15px' }}>
          <span style={{ fontWeight: 'bold', color: '#666', fontSize: '13px' }}>👤 Name:</span>
          <p style={{ margin: '5px 0 0 0', fontSize: '15px', color: '#333' }}>{name || 'Not set'}</p>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <span style={{ fontWeight: 'bold', color: '#666', fontSize: '13px' }}>📞 Phone:</span>
          <p style={{ margin: '5px 0 0 0', fontSize: '15px', color: '#333' }}>{userPhone || 'Not set'}</p>
        </div>

        <div style={{ marginBottom: '0' }}>
          <span style={{ fontWeight: 'bold', color: '#666', fontSize: '13px' }}>📍 Address:</span>
          <p style={{ margin: '5px 0 0 0', fontSize: '15px', color: '#333', whiteSpace: 'pre-wrap' }}>
            {address || 'Not set'}
          </p>
        </div>
      </div>

      {/* Edit Profile Link */}
      {profileIncomplete && (
        <div style={{ marginBottom: '20px', textAlign: 'center' }}>
          <button
            onClick={() => navigate('/profile')}
            style={{
              padding: '10px 20px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ✏️ Edit Profile First
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={() => navigate('/')}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: '#e0e0e0',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '15px'
          }}
        >
          ← Back
        </button>
        <button
          onClick={() => setShowConfirm(true)}
          disabled={loading || !name || !address || !userPhone || profileIncomplete}
          style={{
            flex: 1,
            padding: '12px',
            backgroundColor: loading || !name || !address || !userPhone || profileIncomplete ? '#ccc' : '#667eea',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: loading || !name || !address || !userPhone || profileIncomplete ? 'not-allowed' : 'pointer',
            fontWeight: 'bold',
            fontSize: '15px',
            transition: 'background 0.2s'
          }}
        >
          {loading ? '⏳ Processing...' : '✓ Confirm Booking'}
        </button>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '12px',
            maxWidth: '420px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '50px', marginBottom: '15px' }}>
              {serviceIcons[type] || '🛠️'}
            </div>
            <h3 style={{ fontSize: '20px', margin: '0 0 10px 0', color: '#333' }}>
              Confirm Booking?
            </h3>
            <p style={{ color: '#666', margin: '10px 0', fontSize: '14px' }}>
              You are about to book <strong>{type}</strong> service for:
            </p>
            <div style={{
              backgroundColor: '#f0f4ff',
              padding: '15px',
              borderRadius: '8px',
              marginBottom: '20px',
              textAlign: 'left',
              fontSize: '14px'
            }}>
              <div><strong>Name:</strong> {name}</div>
              <div><strong>Phone:</strong> {userPhone}</div>
              <div><strong>Address:</strong> {address}</div>
              <div style={{ marginTop: '10px', color: '#667eea', fontWeight: 'bold' }}>
                Service Charge: ₹200
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#e0e0e0',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold',
                  opacity: loading ? 0.6 : 1
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleBooking}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: loading ? '#999' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 'bold'
                }}
              >
                {loading ? '⏳ Booking...' : '✓ Confirm & Book'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
