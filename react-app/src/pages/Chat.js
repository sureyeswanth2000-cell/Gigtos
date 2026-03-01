import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDoc, doc } from 'firebase/firestore';

export default function Chat() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const bookingId = params.get('bookingId');

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const endRef = useRef(null);

  useEffect(() => {
    const loadBooking = async () => {
      if (!bookingId) return;
      const docSnap = await getDoc(doc(db, 'bookings', bookingId));
      if (docSnap.exists()) {
        setBooking({ id: docSnap.id, ...docSnap.data() });
      }
    };
    loadBooking();

    if (!bookingId) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'bookings', bookingId, 'chat'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = [];
      snap.forEach(doc => msgs.push({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
      setLoading(false);
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });

    return () => unsub();
  }, [bookingId]);

  const sendMessage = async () => {
    if (!text.trim() || !bookingId) return;
    const user = auth.currentUser;
    await addDoc(collection(db, 'bookings', bookingId, 'chat'), {
      senderId: user.uid,
      message: text.trim(),
      createdAt: serverTimestamp(),
    });
    setText('');
  };

  if (loading) {
    return <div style={{padding:20}}>Loading chat...</div>;
  }

  if (!booking) {
    return <div style={{padding:20}}>Booking not found.</div>;
  }

  return (
    <div style={{maxWidth:700, margin:'20px auto', padding:20}}>
      <h3>Chat about {booking.serviceType}</h3>
      <div style={{border:'1px solid #ddd',borderRadius:8,height:400,overflowY:'auto',padding:12,background:'#fafafa'}}>
        {messages.map(m => (
          <div key={m.id} style={{margin:'8px 0',display:'flex',justifyContent:m.senderId===auth.currentUser?.uid?'flex-end':'flex-start'}}>
            <div style={{
              padding:8,
              borderRadius:8,
              backgroundColor:m.senderId===auth.currentUser?.uid?'#667eea':'#eee',
              color:m.senderId===auth.currentUser?.uid?'white':'#333',
              maxWidth:'70%'
            }}>
              {m.message}
            </div>
          </div>
        ))}
        <div ref={endRef}></div>
      </div>
      <div style={{display:'flex',marginTop:12,gap:8}}>
        <input
          value={text}
          onChange={e=>setText(e.target.value)}
          placeholder="Type a message..."
          style={{flex:1,padding:10,border:'1px solid #ccc',borderRadius:6}}
          onKeyDown={e=>{if(e.key==='Enter') sendMessage();}}
        />
        <button onClick={sendMessage} style={{padding:'10px 16px',background:'#667eea',color:'white',border:'none',borderRadius:6}}>Send</button>
      </div>
    </div>
  );
}