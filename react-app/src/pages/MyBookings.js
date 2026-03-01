import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';

const statusColors = {
  'pending': '#ff9800',
  'assigned': '#2196f3',
  'in_progress': '#9c27b0',
  'awaiting_confirmation': '#f44336',
  'completed': '#4caf50',
  'cancelled': '#757575'
};

const serviceIcons = {
  'Plumber': '🧰',
  'Electrician': '⚡',
  'Carpenter': '🪛',
  'Painter': '🎨'
};

export default function MyBookings(){
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [updating, setUpdating] = useState(false);

  useEffect(()=>{
    const unsubAuth = onAuthStateChanged(auth, (u)=>{
      setUser(u);
    });
    return ()=> unsubAuth();
  },[]);

  useEffect(()=>{
    if(!user) return;

    const q = query(collection(db,'bookings'), where('userId','==',user.uid));
    const unsub = onSnapshot(q, (snap)=>{
      const items = [];
      snap.forEach(d=> items.push({id:d.id, ...d.data()}));
      items.sort((a,b)=>{
        const ta = a.updatedAt?.seconds || 0;
        const tb = b.updatedAt?.seconds || 0;
        return tb - ta;
      });
      setBookings(items);
    }, (err)=>{
      console.error('snapshot error', err);
    });

    return ()=> unsub();
  },[user]);

  async function confirmCompletion(id){
    if (window.confirm('Confirm service completion?')) {
      try{
        await updateDoc(doc(db,'bookings',id),{
          status: 'completed',
          updatedAt: new Date()
        });
        alert('✓ Service completion confirmed!');
      }catch(e){
        console.error(e);
        alert('Failed to confirm completion: '+e.message);
      }
    }
  }

  async function cancelBooking(id){
    if (window.confirm('Cancel this booking?')) {
      try{
        await updateDoc(doc(db,'bookings',id),{
          status: 'cancelled',
          updatedAt: new Date()
        });
        alert('✓ Booking cancelled');
      }catch(e){
        alert('Failed: '+e.message);
      }
    }
  }

  async function saveEdit(id){
    setUpdating(true);
    try{
      await updateDoc(doc(db,'bookings',id),{
        address: editData.address,
        phone: editData.phone,
        updatedAt: new Date()
      });
      alert('✓ Booking updated!');
      setEditingId(null);
      setEditData({});
    }catch(e){
      alert('Failed: '+e.message);
    } finally {
      setUpdating(false);
    }
  }

  function startEdit(booking){
    setEditingId(booking.id);
    setEditData({
      address: booking.address,
      phone: booking.phone
    });
  }

  const active = bookings.filter(b=>['pending','assigned','in_progress','awaiting_confirmation'].includes(b.status));
  const completed = bookings.filter(b=>b.status==='completed');
  const cancelled = bookings.filter(b=>b.status==='cancelled');

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const ms = timestamp.seconds ? timestamp.seconds * 1000 : timestamp;
    return new Date(ms).toLocaleString();
  };

  const BookingCard = ({ booking, isActive }) => (
    <div key={booking.id} style={{
      background: 'white',
      padding: '16px',
      borderRadius: '8px',
      marginBottom: '12px',
      border: `2px solid ${statusColors[booking.status] || '#ccc'}`,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontSize: '32px' }}>
            {serviceIcons[booking.serviceType] || '🛠️'}
          </div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#333' }}>
              {(booking.serviceType || 'Service').toUpperCase()}
            </div>
            <div style={{ fontSize: '12px', color: '#999' }}>
              {formatDate(booking.createdAt)}
            </div>
          </div>
        </div>
        <div style={{
          padding: '6px 12px',
          backgroundColor: statusColors[booking.status] || '#ccc',
          color: 'white',
          borderRadius: '20px',
          fontSize: '12px',
          fontWeight: 'bold'
        }}>
          {(booking.status || '').replace(/_/g, ' ').toUpperCase()}
        </div>
      </div>

      {editingId === booking.id ? (
        // Edit Mode
        <div style={{ backgroundColor: '#f5f5f5', padding: '12px', borderRadius: '6px', marginBottom: '12px' }}>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontWeight: 'bold', fontSize: '12px', color: '#666' }}>Phone:</label>
            <input
              type="tel"
              value={editData.phone}
              onChange={(e) => setEditData({...editData, phone: e.target.value})}
              style={{
                width: '100%',
                padding: '8px',
                marginTop: '4px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontWeight: 'bold', fontSize: '12px', color: '#666' }}>Address:</label>
            <textarea
              value={editData.address}
              onChange={(e) => setEditData({...editData, address: e.target.value})}
              rows="3"
              style={{
                width: '100%',
                padding: '8px',
                marginTop: '4px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                boxSizing: 'border-box',
                fontFamily: 'Arial, sans-serif'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setEditingId(null)}
              disabled={updating}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: '#ccc',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '12px'
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => saveEdit(booking.id)}
              disabled={updating}
              style={{
                flex: 1,
                padding: '8px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '12px',
                opacity: updating ? 0.6 : 1
              }}
            >
              {updating ? '⏳ Saving...' : '✓ Save'}
            </button>
          </div>
        </div>
      ) : (
        // View Mode
        <div style={{ marginBottom: '12px' }}>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ fontWeight: 'bold', color: '#666', fontSize: '12px' }}>📞 Phone:</span>
            <p style={{ margin: '3px 0 0 0', color: '#333' }}>{booking.phone}</p>
          </div>
          <div style={{ marginBottom: '0' }}>
            <span style={{ fontWeight: 'bold', color: '#666', fontSize: '12px' }}>📍 Address:</span>
            <p style={{ margin: '3px 0 0 0', color: '#333', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {booking.address}
            </p>
          </div>
              {booking.rating && (
                <div style={{ marginTop: '10px', fontSize: '14px', color: '#333' }}>
                  <strong>Your Rating:</strong> {'★'.repeat(booking.rating)}{'☆'.repeat(5-booking.rating)}
                  {booking.review && (
                    <div style={{ marginTop: '4px', fontSize: '12px', color: '#555' }}>
                      "{booking.review}"
                    </div>
                  )}
                </div>
              )}
        </div>
      )}

      {booking.assignedWorker && (
        <div style={{ marginBottom: '12px', padding: '10px', backgroundColor: '#e8f5e9', borderRadius: '6px', fontSize: '13px' }}>
          <strong>👨‍🔧 Assigned Worker:</strong> {booking.assignedWorker}
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {isActive && booking.status === 'pending' && editingId !== booking.id && (
          <>
            <button
              onClick={() => startEdit(booking)}
              style={{
                flex: '1 0 auto',
                padding: '8px 12px',
                backgroundColor: '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '12px'
              }}
            >
              ✏️ Edit
            </button>
            <button
              onClick={() => cancelBooking(booking.id)}
              style={{
                flex: '1 0 auto',
                padding: '8px 12px',
                backgroundColor: '#f44336',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '12px'
              }}
            >
              ✕ Cancel
            </button>
          </>
        )}

        {booking.status === 'awaiting_confirmation' && (
          <button
            onClick={() => confirmCompletion(booking.id)}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#4caf50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '12px'
            }}
          >
            ✓ Confirm Completion
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h2 style={{ fontSize: '24px', marginBottom: '10px', color: '#333' }}>📦 My Bookings</h2>

      {!user && (
        <div style={{
          padding: '20px',
          textAlign: 'center',
          backgroundColor: '#fff3cd',
          borderRadius: '8px',
          color: '#856404'
        }}>
          Please login to view your bookings.
        </div>
      )}

      {user && (
        <>
          {/* Active Bookings */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '18px', color: '#333', marginBottom: '12px' }}>
              🟡 Active Bookings ({active.length})

                    {/* chat button available for any booking */}
                    <button
                      onClick={() => navigate(`/chat?bookingId=${booking.id}`)}
                      style={{
                        flex: '1 0 auto',
                        padding: '8px 12px',
                        backgroundColor: '#667eea',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '12px'
                      }}
                    >
                      💬 Chat
                    </button>
            </h3>
            {active.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f5f5f5', borderRadius: '8px', color: '#999' }}>
                No active bookings yet
              </div>
            ) : (
              active.map(b => <BookingCard key={b.id} booking={b} isActive={true} />)
            )}
          </div>

          {/* Completed Bookings */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '18px', color: '#333', marginBottom: '12px' }}>
              ✓ Completed ({completed.length})
            </h3>
            {completed.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', backgroundColor: '#f5f5f5', borderRadius: '8px', color: '#999' }}>
                No completed bookings yet
              </div>
            ) : (
                completed.map(b => (
                  <div key={b.id}>
                    <BookingCard booking={b} isActive={false} />
                    {/* rating/review section */}
                    {b.status === 'completed' && !b.rating && (
                      <div style={{ padding: '10px 15px', backgroundColor: '#f0f4ff', borderRadius: '6px', marginBottom: '12px' }}>
                        <small style={{ color: '#333' }}>Rate this service:</small>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                          {[1,2,3,4,5].map(star => (
                            <span key={star} onClick={async()=>{
                                try{ await updateDoc(doc(db,'bookings',b.id),{rating:star,review:''});
                                    alert('Thank you for rating!');
                                }catch(e){alert(e.message);} }}
                                  style={{cursor:'pointer',fontSize:'18px',color:'#ffb400'}}>
                              ★
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
            )}
          </div>

          {/* Cancelled Bookings */}
          {cancelled.length > 0 && (
            <div>
              <h3 style={{ fontSize: '18px', color: '#333', marginBottom: '12px' }}>
                ✕ Cancelled ({cancelled.length})
              </h3>
              {cancelled.map(b => <BookingCard key={b.id} booking={b} isActive={false} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
