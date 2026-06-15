import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import Header from './components/Header';
import Footer from './components/Footer';
import Auth from './pages/Auth';
import CompleteProfilePhone from './pages/CompleteProfilePhone';
import Home from './pages/Home';
import Service from './pages/Service';
import ServiceCatalog from './pages/ServiceCatalog';
import WorkerLanding from './pages/WorkerLanding';
import MyBookings from './pages/MyBookings';
import Profile from './pages/Profile';
import UserDashboard from './pages/UserDashboard';
import Admin from './pages/Admin';
import Workers from './pages/Workers';
import AdminBookings from './pages/AdminBookings';
import Chat from './pages/Chat';
import SuperAdmin from './pages/SuperAdmin';
import FieldOperator from './pages/FieldOperator';
import RegionLeadDashboard from './pages/RegionLeadDashboard';
import MasonDashboardPage from './pages/MasonDashboardPage';
import WorkerDashboard from './pages/worker/WorkerDashboard';
import OpenWork from './pages/worker/OpenWork';
import FutureWork from './pages/worker/FutureWork';
import WorkerProfile from './pages/worker/WorkerProfile';
import WorkerSupport from './pages/worker/WorkerSupport';
import WorkerMap from './pages/worker/WorkerMap';
import WorkHistory from './pages/worker/WorkHistory';
import Jobs from './pages/Jobs';
import JobDetail from './pages/JobDetail';
import SocialLanding from './pages/SocialLanding';
import PrivacyPolicy from './pages/PrivacyPolicy';
import { LocationProvider } from './context/LocationContext';
import { ToastProvider } from './context/ToastContext';
import { LanguageProvider } from './context/LanguageContext';
import { getDevBypassUserFromSearch, isDevBypassEnabled } from './utils/devBypass';
import { captureFrontendException, setSentryUser } from './utils/sentryMonitoring';

const PROJECT_BASE_PATH = '/Gigtos';

function normalizeProjectRouteForHashRouter() {
  if (typeof window === 'undefined') return;
  const { pathname, search, hash } = window.location;
  if (hash && hash.startsWith('#/')) return;
  const basePath = PROJECT_BASE_PATH;
  const isProjectPath = pathname === basePath || pathname === `${basePath}/` || pathname.startsWith(`${basePath}/`);
  if (!isProjectPath) return;
  const routePath = pathname.slice(basePath.length) || '/';
  if (routePath === '/' && !search) return;
  window.history.replaceState(null, '', `${basePath}/#${routePath}${search}`);
}

function App() {
  normalizeProjectRouteForHashRouter();
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isRegionLead, setIsRegionLead] = useState(false);
  const [isWorker, setIsWorker] = useState(false);
  const [adminRole, setAdminRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDevBypassEnabled()) {
      try {
        const devUser = getDevBypassUserFromSearch();
        if (devUser) {
          setUser(devUser);
          setIsAdmin(devUser.role === 'superadmin' || devUser.role === 'field_operator');
          setIsWorker(devUser.role === 'worker');
          setAdminRole(devUser.role === 'superadmin' ? 'superadmin' : devUser.role === 'field_operator' ? 'field_operator' : null);
          setIsSuperAdmin(devUser.role === 'superadmin');
          setIsRegionLead(false);
          setSentryUser(devUser, devUser.role);
          setLoading(false);
          return undefined;
        }
      } catch {
        // Fall back to Firebase auth when the local bypass URL is malformed.
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        try {
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
          setSentryUser(currentUser, role || (isWorkerUser ? 'worker' : 'consumer'));
        } catch (error) {
          captureFrontendException(error, { source: 'auth_role_lookup' });
          setSentryUser(currentUser, 'unknown');
          setIsAdmin(false);
          setIsSuperAdmin(false);
          setIsRegionLead(false);
          setIsWorker(false);
          setAdminRole(null);
        }
      } else {
        setSentryUser(null);
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
    if (adminRole === 'field_operator') return "/operator";
    if (isRegionLead) return "/admin/region-lead";
    return "/admin/bookings";
  };

  const getPostLoginRedirect = () => {
    if (isAdmin) return getAdminRedirect();
    if (isWorker) return '/worker/dashboard';
    return '/';
  };

  const AppContent = () => {
    const location = useLocation();
    const isAuthRoute = location.pathname === '/auth';

    return (
      <>
        {!isAuthRoute && <Header />}
        <main style={{ minHeight: isAuthRoute ? '100vh' : '70vh' }}>
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={user ? (isAdmin || isWorker ? <Navigate to={getPostLoginRedirect()} /> : <Home />) : <Home />} />
              <Route path="/auth" element={user ? <Navigate to={getPostLoginRedirect()} /> : <Auth />} />
              <Route path="/services" element={<ServiceCatalog />} />
              <Route path="/workers" element={<WorkerLanding />} />
              <Route path="/social" element={<SocialLanding />} />
              <Route path="/join" element={<SocialLanding />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />

              {/* Protected User Routes */}
              <Route path="/service" element={<ProtectedRoute><Service /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><UserDashboard /></ProtectedRoute>} />
              <Route path="/my-bookings" element={<ProtectedRoute><MyBookings /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
              <Route path="/complete-profile-phone" element={<ProtectedRoute><CompleteProfilePhone /></ProtectedRoute>} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/jobs/:jobId" element={<JobDetail />} />
              {/* Ride vertical is disabled for MVP until driver app, rules, and assignment flow are complete. */}
              <Route path="/ride-booking" element={<Navigate to="/services" replace />} />
              <Route path="/ride-tracking/:rideId" element={<Navigate to="/services" replace />} />

              {/* Protected Admin Routes */}
              <Route path="/admin" element={<ProtectedRoute requireAdmin><Admin /></ProtectedRoute>} />
              <Route path="/admin/workers" element={<ProtectedRoute requireAdmin><Workers /></ProtectedRoute>} />
              <Route path="/admin/bookings" element={<ProtectedRoute requireAdmin><AdminBookings /></ProtectedRoute>} />
              <Route path="/admin/region-lead" element={<ProtectedRoute requireAdmin><RegionLeadDashboard /></ProtectedRoute>} />
              <Route path="/mason/dashboard" element={<ProtectedRoute requireAdmin><MasonDashboardPage /></ProtectedRoute>} />
              <Route path="/operator" element={<ProtectedRoute requireAdmin><FieldOperator /></ProtectedRoute>} />

              {/* Protected Worker Route */}
              <Route path="/worker/dashboard" element={<ProtectedRoute requireWorker><WorkerDashboard /></ProtectedRoute>} />
              <Route path="/worker/open-work" element={<ProtectedRoute requireWorker><OpenWork /></ProtectedRoute>} />
              <Route path="/worker/future-work" element={<ProtectedRoute requireWorker><FutureWork /></ProtectedRoute>} />
              <Route path="/worker/profile" element={<ProtectedRoute requireWorker><WorkerProfile /></ProtectedRoute>} />
              <Route path="/worker/support" element={<ProtectedRoute requireWorker><WorkerSupport /></ProtectedRoute>} />
              <Route path="/worker/map" element={<ProtectedRoute requireWorker><WorkerMap /></ProtectedRoute>} />
              <Route path="/worker/history" element={<ProtectedRoute requireWorker><WorkHistory /></ProtectedRoute>} />

              {/* Protected SuperAdmin Route */}
              <Route path="/admin/super" element={<ProtectedRoute requireSuperAdmin><SuperAdmin /></ProtectedRoute>} />
            </Routes>
        </main>
        {!isAuthRoute && <Footer />}
      </>
    );
  };

  return (
    <HashRouter>
      <ToastProvider>
        <LanguageProvider>
          <LocationProvider>
            <AppContent />
          </LocationProvider>
        </LanguageProvider>
      </ToastProvider>
    </HashRouter>
  );
}

export default App;
