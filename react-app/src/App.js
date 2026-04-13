import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import Header from './components/Header';
import Footer from './components/Footer';
import Auth from './pages/Auth';
import CompleteProfilePhone from './pages/CompleteProfilePhone';
import Home from './pages/Home';
import Service from './pages/Service';
import MyBookings from './pages/MyBookings';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Workers from './pages/Workers';
import AdminBookings from './pages/AdminBookings';
import Chat from './pages/Chat';
import SuperAdmin from './pages/SuperAdmin';
import RegionLeadDashboard from './pages/RegionLeadDashboard';
import WorkerDashboard from './pages/worker/WorkerDashboard';
import { LocationProvider } from './context/LocationContext';

function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isRegionLead, setIsRegionLead] = useState(false);
  const [isWorker, setIsWorker] = useState(false);
  const [adminRole, setAdminRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
        const workerDoc = await getDoc(doc(db, 'gig_workers', currentUser.uid));
        const isAdminUser = adminDoc.exists();
        let isWorkerUser = false;
        if (workerDoc.exists()) {
          const workerData = workerDoc.data();
          if (workerData.approvalStatus === 'approved') {
            isWorkerUser = true;
          }
        }
        const role = adminDoc.data()?.role;
        setIsAdmin(isAdminUser);
        setIsWorker(isWorkerUser);
        setAdminRole(role);
        setIsSuperAdmin(isAdminUser && role === 'superadmin');
        setIsRegionLead(isAdminUser && role === 'regionLead');
      } else {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setIsRegionLead(false);
        setIsWorker(false);
        setAdminRole(null);
      }
      setLoading(false); // Only set loading false once ALL checks are complete
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        color: '#666'
      }}>
        ⏳ Loading...
      </div>
    );
  }

  const ProtectedRoute = ({ children, requireAdmin = false, requireSuperAdmin = false, requireWorker = false }) => {
    if (!user) return <Navigate to="/auth" />;
    if (requireSuperAdmin && !isSuperAdmin) return <Navigate to="/" />;
    if (requireAdmin && !isAdmin) return <Navigate to="/" />;
    if (requireWorker && !isWorker) return <Navigate to="/" />; // Secure the worker route
    return children;
  };

  // Determine redirect path based on role
  const getAdminRedirect = () => {
    if (isSuperAdmin) return "/admin/super";
    if (isRegionLead) return "/admin/region-lead";
    return "/admin/bookings";
  };

  const getPostLoginRedirect = () => {
    if (isAdmin) return getAdminRedirect();
    if (isWorker) return '/worker/dashboard';
    return '/';
  };

  return (
    <BrowserRouter basename="/Gigtos">
      <LocationProvider>
        <Header />
        <main style={{ minHeight: '70vh' }}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={user ? (isAdmin || isWorker ? <Navigate to={getPostLoginRedirect()} /> : <Home />) : <Home />} />
            <Route path="/auth" element={user ? <Navigate to={getPostLoginRedirect()} /> : <Auth />} />

            {/* Protected User Routes */}
            <Route path="/service" element={<ProtectedRoute><Service /></ProtectedRoute>} />
            <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/complete-profile-phone" element={<ProtectedRoute><CompleteProfilePhone /></ProtectedRoute>} />

            {/* Protected Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
            <Route path="/admin/workers" element={<ProtectedRoute requireAdmin><Workers /></ProtectedRoute>} />
            <Route path="/admin/bookings" element={<ProtectedRoute requireAdmin><AdminBookings /></ProtectedRoute>} />
            <Route path="/admin/region-lead" element={<ProtectedRoute requireAdmin><RegionLeadDashboard /></ProtectedRoute>} />

            {/* Protected Worker Route */}
            <Route path="/worker/dashboard" element={<ProtectedRoute requireWorker><WorkerDashboard /></ProtectedRoute>} />

            {/* Protected SuperAdmin Route */}
            <Route path="/admin/super" element={<ProtectedRoute requireSuperAdmin><SuperAdmin /></ProtectedRoute>} />
          </Routes>
        </main>
        <Footer />
      </LocationProvider>
    </BrowserRouter>
  );
}

export default App;
