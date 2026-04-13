import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, getDoc, doc } from 'firebase/firestore';
import './Chat.css';

const QUICK_REPLIES = [
  'On my way, ETA 15 mins.',
  'Please share one clear photo of the issue.',
  'I have reached your location.',
  'Work completed. Please review when free.',
];

function formatMsgTime(ts) {
  if (!ts) return '';
  const ms = ts?.seconds ? ts.seconds * 1000 : Date.now();
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function Chat() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const bookingId = params.get('bookingId');

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
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

  const sendMessage = async (presetText) => {
    const message = (presetText || text).trim();
    if (!message || !bookingId) return;
    const user = auth.currentUser;
    try {
      setSending(true);
      await addDoc(collection(db, 'bookings', bookingId, 'chat'), {
        senderId: user.uid,
        message,
        createdAt: serverTimestamp(),
      });
      setText('');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="chat-page-shell">Loading chat...</div>;
  }

  if (!booking) {
    return <div className="chat-page-shell">Booking not found.</div>;
  }

  return (
    <div className="chat-page-shell">
      <div className="chat-head">
        <button className="chat-back-btn" onClick={() => navigate(-1)}>
          Back
        </button>
        <div>
          <h3>Live Chat - {booking.serviceType}</h3>
          <p>Professional support for booking #{booking.id.slice(0, 8)}</p>
        </div>
      </div>

      <div className="chat-quick-replies">
        {QUICK_REPLIES.map((reply) => (
          <button key={reply} onClick={() => sendMessage(reply)} disabled={sending}>
            {reply}
          </button>
        ))}
      </div>

      <div className="chat-stream">
        {messages.map(m => (
          <div key={m.id} className={`chat-row ${m.senderId === auth.currentUser?.uid ? 'mine' : 'other'}`}>
            <div className="chat-bubble">
              <div>{m.message}</div>
              <div className="chat-meta">
                {formatMsgTime(m.createdAt)}
                {m.senderId === auth.currentUser?.uid ? '  Delivered' : ''}
              </div>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="chat-composer">
        <input
          value={text}
          onChange={e=>setText(e.target.value)}
          placeholder="Type a message..."
          onKeyDown={e=>{if(e.key==='Enter') sendMessage();}}
        />
        <button onClick={() => sendMessage()} disabled={sending || !text.trim()}>
          {sending ? 'Sending...' : 'Send'}
        </button>
      </div>
    </div>
  );
}