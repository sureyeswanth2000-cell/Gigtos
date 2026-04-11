import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { LocationProvider } from './context/LocationContext';
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
import WorkerDashboard from './pages/WorkerDashboard';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import UserProfile from './pages/UserProfile';
import UserDashboard from './pages/UserDashboard';
import WorkerJobSelection from './pages/WorkerJobSelection';
import MasonDashboardPage from './pages/MasonDashboardPage';
import NotFound from './pages/NotFound';
import ErrorBoundary from './components/ErrorBoundary';
import LiveTrackingBanner from './components/LiveTrackingBanner';
import WorkerMapPage from './pages/worker/WorkerMap';
import OpenWork from './pages/worker/OpenWork';
import WorkHistory from './pages/worker/WorkHistory';
import WorkerProfilePage from './pages/worker/WorkerProfile';
import FutureWork from './pages/worker/FutureWork';
import WorkerSupportPage from './pages/worker/WorkerSupport';

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
      setLoading(true);
      if (currentUser) {
        const adminDoc = await getDoc(doc(db, 'admins', currentUser.uid));
        const workerDoc = await getDoc(doc(db, 'worker_auth', currentUser.uid));
        const isAdminUser = adminDoc.exists();
        const isWorkerUser = workerDoc.exists();
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
      setUser(currentUser);
      setLoading(false);
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

  const ProtectedRoute = ({ children, requireAdmin = false, requireSuperAdmin = false }) => {
    if (!user) return <Navigate to="/auth" />;
    if (requireSuperAdmin && !isSuperAdmin) return <Navigate to="/" />;
    if (requireAdmin && !isAdmin) return <Navigate to="/" />;
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
    <ErrorBoundary>
    <LocationProvider>
    <BrowserRouter basename="/Gigtos">
      <Header />
      <main style={{ minHeight: '70vh' }}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={user ? (isAdmin || isWorker ? <Navigate to={getPostLoginRedirect()} /> : <Home />) : <Home />} />
          <Route path="/auth" element={user ? <Navigate to={getPostLoginRedirect()} /> : <Auth />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:jobId" element={<JobDetail />} />

          {/* Protected User Routes */}
          <Route path="/service" element={<ProtectedRoute><Service /></ProtectedRoute>} />
          <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/user/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
          <Route path="/user/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/complete-profile-phone" element={<ProtectedRoute><CompleteProfilePhone /></ProtectedRoute>} />

          {/* Protected Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
          <Route path="/admin/workers" element={<ProtectedRoute requireAdmin><Workers /></ProtectedRoute>} />
          <Route path="/admin/bookings" element={<ProtectedRoute requireAdmin><AdminBookings /></ProtectedRoute>} />
          <Route path="/admin/region-lead" element={<ProtectedRoute requireAdmin><RegionLeadDashboard /></ProtectedRoute>} />

          {/* Protected Worker Routes */}
          <Route path="/worker/dashboard" element={<ProtectedRoute><WorkerDashboard /></ProtectedRoute>} />
          <Route path="/worker/map" element={<ProtectedRoute><WorkerMapPage /></ProtectedRoute>} />
          <Route path="/worker/open-work" element={<ProtectedRoute><OpenWork /></ProtectedRoute>} />
          <Route path="/worker/history" element={<ProtectedRoute><WorkHistory /></ProtectedRoute>} />
          <Route path="/worker/profile" element={<ProtectedRoute><WorkerProfilePage /></ProtectedRoute>} />
          <Route path="/worker/future-work" element={<ProtectedRoute><FutureWork /></ProtectedRoute>} />
          <Route path="/worker/support" element={<ProtectedRoute><WorkerSupportPage /></ProtectedRoute>} />
          <Route path="/worker/job-selection" element={<ProtectedRoute><WorkerJobSelection /></ProtectedRoute>} />

          {/* Mason Dashboard */}
          <Route path="/mason/dashboard" element={<ProtectedRoute requireAdmin><MasonDashboardPage /></ProtectedRoute>} />

          {/* Protected SuperAdmin Route */}
          <Route path="/admin/super" element={<ProtectedRoute requireSuperAdmin><SuperAdmin /></ProtectedRoute>} />

          {/* Legacy Redirects */}
          <Route path="/login" element={<Navigate to="/auth" replace />} />
          <Route path="/register" element={<Navigate to="/auth?mode=user" replace />} />
          <Route path="/worker/register" element={<Navigate to="/auth?mode=worker" replace />} />

          {/* 404 Catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <LiveTrackingBanner />
      <Footer />
    </BrowserRouter>
    </LocationProvider>
    </ErrorBoundary>
  );
}

export default App;
