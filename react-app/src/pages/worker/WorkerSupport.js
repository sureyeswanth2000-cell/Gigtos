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
        <div className="worker-page-topbar" style={{ flexShrink: 0 }}>
          <Link to="/worker/dashboard" className="worker-back-link" aria-label="Back to worker dashboard">←</Link>
          <h2 className="worker-page-title">Chat with Support</h2>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <ChatInterface workerName={workerName} />
        </div>
      </div>
      <WorkerBottomNav />
    </div>
  );
}
