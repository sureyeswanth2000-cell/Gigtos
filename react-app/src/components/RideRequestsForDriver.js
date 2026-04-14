import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';

// This component is for drivers to see and accept nearby ride requests
const RideRequestsForDriver = () => {
  const [rideRequests, setRideRequests] = useState([]);
  const [accepting, setAccepting] = useState(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    // Listen for pending ride requests for this driver type
    const q = query(
      collection(db, 'rideRequests'),
      where('status', '==', 'pending'),
      where('driverType', 'in', ['bike', 'auto', 'car']) // Filter for ride types only
    );
    const unsub = onSnapshot(q, (snap) => {
      setRideRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  const handleAccept = async (rideId) => {
    setAccepting(rideId);
    try {
      await updateDoc(doc(db, 'rideRequests', rideId), {
        status: 'accepted',
        driverId: auth.currentUser.uid,
        acceptedAt: new Date(),
      });
      alert('Ride accepted!');
    } catch (err) {
      alert('Failed to accept ride.');
    }
    setAccepting(null);
  };

  return (
    <section>
      <h2>Nearby Ride Requests</h2>
      {rideRequests.length === 0 && <div>No ride requests nearby.</div>}
      <ul>
        {rideRequests.map(r => (
          <li key={r.id} style={{marginBottom:12}}>
            <strong>{r.driverType.toUpperCase()}</strong> ride from <b>{r.pickup.address}</b> to <b>{r.drop.address}</b>
            <br/>
            <button disabled={accepting===r.id} onClick={() => handleAccept(r.id)}>
              {accepting===r.id ? 'Accepting...' : 'Accept Ride'}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default RideRequestsForDriver;
