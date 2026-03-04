import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';

export default function Home() {
  const navigate = useNavigate();
  const [selectedService, setSelectedService] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Define available services with their metadata (icon, price, description)
  const services = [
    { id: 1, name: 'Plumber', icon: '🧰', price: 'Quote Based', desc: 'Pipe repairs, leak fixing, installation' },
    { id: 2, name: 'Electrician', icon: '⚡', price: 'Quote Based', desc: 'Wiring, repairs, switch installation' },
    { id: 3, name: 'Carpenter', icon: '🪛', price: 'Quote Based', desc: 'Furniture, doors, shelves, fixtures' },
    { id: 4, name: 'Painter', icon: '🎨', price: 'Quote Based', desc: 'Interior & exterior painting' }
  ];

  // Handle service selection and login check
  const handleBookService = (service) => {
    // If not logged in, redirect to auth with user mode
    if (!auth.currentUser) {
      navigate('/auth?mode=user');
      return;
    }
    // Set selected service and show confirmation modal
    setSelectedService(service);
    setShowModal(true);
  };

  // Confirm selection and navigate to the detailed booking page
  const confirmBooking = () => {
    if (selectedService) {
      // Pass service type as a query parameter
      navigate(`/service?type=${selectedService.name}`);
      setShowModal(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '20px' }}>
      {/* Visual Header Section */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', marginBottom: '10px', color: '#333' }}>
          🏠 Home Services in Kavali
        </h1>
        <p style={{ fontSize: '16px', color: '#666', marginBottom: '5px' }}>
          Book trusted professionals instantly
        </p>
        {/* Global visiting charge announcement */}
        <p style={{ fontSize: '14px', color: '#0284c7', fontWeight: 'bold' }}>
          ✨ Transparent Pricing | Pay only after approval
        </p>
      </div>

      {/* Services Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        {services.map(service => (
          <div
            key={service.id}
            style={{
              padding: '20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: '12px',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              color: 'white'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-5px)';
              e.currentTarget.style.boxShadow = '0 8px 12px rgba(0,0,0,0.2)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
            }}
          >
            <div style={{ fontSize: '40px', marginBottom: '10px' }}>{service.icon}</div>
            <h3 style={{ margin: '10px 0', fontSize: '20px', fontWeight: 'bold' }}>
              {service.name}
            </h3>
            <p style={{ fontSize: '13px', marginBottom: '12px', opacity: 0.9 }}>
              {service.desc}
            </p>
            {/* Price removed as per user feedback */}
            <button
              onClick={() => handleBookService(service)}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: 'rgba(255,255,255,0.3)',
                color: 'white',
                border: '2px solid white',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '14px',
                transition: 'background 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'rgba(255,255,255,0.5)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'rgba(255,255,255,0.3)';
              }}
            >
              Book Now
            </button>
          </div>
        ))}
      </div>

      {/* Booking Confirmation Modal */}
      {showModal && selectedService && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '12px',
            maxWidth: '400px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '60px', marginBottom: '15px' }}>
                {selectedService.icon}
              </div>
              <h2 style={{ margin: '0 0 10px 0', fontSize: '24px', color: '#333' }}>
                Book {selectedService.name}
              </h2>
              <p style={{ color: '#666', margin: '10px 0' }}>
                {selectedService.desc}
              </p>
              {/* Price removed as per user feedback */}
            </div>

            <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f0f4ff', borderRadius: '8px' }}>
              <p style={{ margin: '0', color: '#333', fontSize: '14px' }}>
                ✓ Quick booking process<br />
                ✓ Professional & verified workers<br />
                ✓ Easy payment options (coming soon)<br />
                ✓ Real-time tracking
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#e0e0e0',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmBooking}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                Proceed to Book
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
