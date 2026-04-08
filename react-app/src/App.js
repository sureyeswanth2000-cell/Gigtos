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
import WorkerDashboard from './pages/WorkerDashboard';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import UserProfile from './pages/UserProfile';
import UserDashboard from './pages/UserDashboard';
import WorkerMap from './pages/WorkerMap';
import WorkerOpenWork from './pages/WorkerOpenWork';
import WorkerHistory from './pages/WorkerHistory';
import WorkerProfile from './pages/WorkerProfile';
import WorkerFutureWork from './pages/WorkerFutureWork';
import WorkerSupport from './pages/WorkerSupport';
import MasonDashboard from './pages/MasonDashboard';
import NotFound from './pages/NotFound';

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
    <BrowserRouter basename="/Gigtos">
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
          <Route path="/worker/dashboard" element={<ProtectedRoute><WorkerDashboard /></ProtectedRoute>} />
          <Route path="/worker/map" element={<ProtectedRoute><WorkerMap /></ProtectedRoute>} />
          <Route path="/worker/open-work" element={<ProtectedRoute><WorkerOpenWork /></ProtectedRoute>} />
          <Route path="/worker/history" element={<ProtectedRoute><WorkerHistory /></ProtectedRoute>} />
          <Route path="/worker/profile" element={<ProtectedRoute><WorkerProfile /></ProtectedRoute>} />
          <Route path="/worker/future-work" element={<ProtectedRoute><WorkerFutureWork /></ProtectedRoute>} />
          <Route path="/worker/support" element={<ProtectedRoute><WorkerSupport /></ProtectedRoute>} />

          {/* Public Job Routes */}
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:jobId" element={<JobDetail />} />

          {/* Protected User Routes (new) */}
          <Route path="/user/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />
          <Route path="/user/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />

          {/* Protected Mason Route */}
          <Route path="/mason/dashboard" element={<ProtectedRoute requireAdmin><MasonDashboard /></ProtectedRoute>} />

          {/* Redirect legacy paths */}
          <Route path="/login" element={<Navigate to="/auth" />} />
          <Route path="/register" element={<Navigate to="/auth?mode=user" />} />
          <Route path="/worker/register" element={<Navigate to="/auth?mode=worker" />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />

          {/* Protected SuperAdmin Route */}
          <Route path="/admin/super" element={<ProtectedRoute requireSuperAdmin><SuperAdmin /></ProtectedRoute>} />
        </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  );
}

export default App;
