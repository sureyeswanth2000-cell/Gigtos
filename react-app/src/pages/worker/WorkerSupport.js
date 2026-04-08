import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import ChatInterface from '../../components/worker/ChatInterface';
import WorkerBottomNav from '../../components/worker/WorkerBottomNav';
import '../../styles/worker-dashboard.css';

export default function WorkerSupport() {
  const [workerName, setWorkerName] = useState('');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) return;
      try {
        const snap = await getDoc(doc(db, 'worker_auth', u.uid));
        if (snap.exists()) setWorkerName(snap.data().name || '');
      } catch {}
    });
    return () => unsub();
  }, []);

  return (
    <div className="worker-page">
      <div className="worker-container" style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexShrink: 0 }}>
          <Link to="/worker/dashboard" style={{ color: '#A259FF', textDecoration: 'none', fontSize: 20 }}>←</Link>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#1F1144' }}>💬 Chat with Support</h2>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ChatInterface workerName={workerName} />
        </div>
      </div>
      <WorkerBottomNav />
    </div>
  );
}
