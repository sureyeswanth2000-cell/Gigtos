import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import TrackingMap from './TrackingMap';

const RideTracking = () => {
  const { rideId } = useParams();
  const [ride, setRide] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRide = async () => {
      const docRef = doc(db, 'rideRequests', rideId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setRide(docSnap.data());
      }
      setLoading(false);
    };
    fetchRide();
  }, [rideId]);

  if (loading) return <div>Loading ride details…</div>;
  if (!ride) return <div>Ride not found.</div>;

  return (
    <section>
      <h2>Live Ride Tracking</h2>
      <TrackingMap
        bookingId={rideId}
        consumerLat={ride.pickup.lat}
        consumerLng={ride.pickup.lng}
      />
      <div style={{marginTop:16}}>
        <strong>Pickup:</strong> {ride.pickup.address}<br/>
        <strong>Drop:</strong> {ride.drop.address}<br/>
        <strong>Status:</strong> {ride.status}
      </div>
    </section>
  );
};

export default RideTracking;
