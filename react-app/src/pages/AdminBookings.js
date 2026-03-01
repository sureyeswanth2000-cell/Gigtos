import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, doc, query, where, orderBy } from 'firebase/firestore';
import { auth, db } from '../firebase';

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [workers, setWorkers] = useState([]);

  useEffect(() => {
    // listen to all bookings (admins can see all)
    const unsub = onSnapshot(
      query(collection(db, 'bookings'), orderBy('createdAt', 'desc')),
      snap => {
        setBookings(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );
    return unsub;
  }, []);

  useEffect(() => {
    // load active workers belonging to this admin
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(
      collection(db, 'gig_workers'),
      where('adminId', '==', uid),
      where('status', '==', 'active')
    );
    const unsub = onSnapshot(q, snap => {
      setWorkers(snap.docs.map(d => ({ id: d.id, ...d.data() })));   
    });
    return unsub;
  }, []);

  const toggleCancel = async (b) => {
    if (b.status === 'pending') {
      await updateDoc(doc(db, 'bookings', b.id), {
        status: 'cancelled',
        updatedAt: new Date()
      });
    } else {
      await updateDoc(doc(db, 'bookings', b.id), {
        status: 'pending',
        adminId: null,
        assignedWorkerId: null,
        updatedAt: new Date()
      });
    }
  };

  const assignWorker = async (b, workerId) => {
    await updateDoc(doc(db, 'bookings', b.id), {
      assignedWorkerId: workerId,
      adminId: auth.currentUser.uid,
      status: 'assigned',
      updatedAt: new Date()
    });
  };

  return (
    <div style={{padding:20}}>
      <h2>Booking Management</h2>
      {bookings.length === 0 && <p>No bookings available.</p>}
      {bookings.map(b => (
        <div key={b.id} style={{border:'1px solid #ddd',padding:10,marginBottom:10,borderRadius:4}}>
          <p><strong>{b.serviceType}</strong> by {b.customerName} ({b.phone})</p>
          <p>Status: {b.status}</p>
          <p>Address: {b.address}</p>
          <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
            <button onClick={()=>toggleCancel(b)}>
              {b.status==='pending' ? 'Cancel' : 'Reopen'}
            </button>
            <select
              value={b.assignedWorkerId || ''}
              onChange={e => assignWorker(b, e.target.value)}
            >
              <option value="">--assign worker--</option>
              {workers.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.gigType})</option>
              ))}
            </select>
          </div>
        </div>
      ))}
    </div>
  );
}