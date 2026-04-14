import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UserLocationMap from './UserLocationMap';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { calculateRidePrice } from '../utils/ridePricing';

// Placeholder for map integration and ride booking logic
const RideBooking = () => {
  const [pickup, setPickup] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [drop, setDrop] = useState('');
  const [dropCoords, setDropCoords] = useState(null);
  const [driverType, setDriverType] = useState('bike');
  const [estimatedPrice, setEstimatedPrice] = useState(null);
  const [distanceKm, setDistanceKm] = useState(0);
  const [durationMin, setDurationMin] = useState(0);
  const navigate = useNavigate();



  // Haversine formula for distance
  function getDistanceKm(a, b) {
    if (!a || !b) return 0;
    const toRad = deg => deg * Math.PI / 180;
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const aa = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1-aa));
    return R * c;
  }

  // Estimate price when locations or type change
  React.useEffect(() => {
    if (pickupCoords && dropCoords) {
      const dist = getDistanceKm(pickupCoords, dropCoords);
      setDistanceKm(dist);
      // Assume 25km/h avg speed for duration
      const duration = dist > 0 ? Math.round((dist / 25) * 60) : 0;
      setDurationMin(duration);
      const price = calculateRidePrice({ driverType, distanceKm: dist, durationMin: duration });
      setEstimatedPrice(price);
    } else {
      setEstimatedPrice(null);
      setDistanceKm(0);
      setDurationMin(0);
    }
  }, [pickupCoords, dropCoords, driverType]);

  const handleBookRide = async (e) => {
    e.preventDefault();
    if (!pickupCoords || !dropCoords) {
      alert('Please select pickup and drop locations on the map.');
      return;
    }
    try {
      const user = auth.currentUser;
      if (!user) {
        alert('You must be logged in to book a ride.');
        return;
      }
      const docRef = await addDoc(collection(db, 'rideRequests'), {
        userId: user.uid,
        driverType,
        pickup: { ...pickupCoords, address: pickup },
        drop: { ...dropCoords, address: drop },
        status: 'pending',
        createdAt: serverTimestamp(),
        price: estimatedPrice,
        distanceKm,
        durationMin,
      });
      alert('Ride request created! Waiting for driver response.');
      // Optionally, navigate to live tracking or ride status page
      // navigate(`/ride-status/${docRef.id}`);
    } catch (err) {
      alert('Failed to create ride request. Please try again.');
      console.error(err);
    }
  };

  return (
    <section className="ride-booking">
      <h2>Book a Ride (Bike, Car, Auto)</h2>
      <form onSubmit={handleBookRide}>
        <label>
          Ride Type
          <select value={driverType} onChange={e => setDriverType(e.target.value)}>
            <option value="bike">Bike</option>
            <option value="auto">Auto</option>
            <option value="car">Car</option>
          </select>
        </label>
        <label>
          Pickup Location
          <input
            type="text"
            value={pickup}
            onChange={e => setPickup(e.target.value)}
            required
            placeholder="Enter pickup location"
          />
        </label>
        <UserLocationMap
          label="Select Pickup on Map"
          onLocationSelect={coords => setPickupCoords(coords)}
        />
        <label>
          Drop Location
          <input
            type="text"
            value={drop}
            onChange={e => setDrop(e.target.value)}
            required
            placeholder="Enter drop location"
          />
        </label>
        <UserLocationMap
          label="Select Drop on Map"
          onLocationSelect={coords => setDropCoords(coords)}
        />
        {estimatedPrice !== null && (
          <div style={{margin:'12px 0',fontWeight:600}}>
            Estimated Price: ₹{estimatedPrice} <span style={{color:'#888',fontWeight:400}}>(Distance: {distanceKm.toFixed(1)} km, Duration: {durationMin} min)</span>
          </div>
        )}
        <button type="submit">Book Ride</button>
      </form>
    </section>
  );
};

export default RideBooking;
