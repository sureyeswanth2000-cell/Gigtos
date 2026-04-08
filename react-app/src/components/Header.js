import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useLocation } from '../context/LocationContext';

export default function Header() {
  const navigate = useNavigate();
  const [user, setUser] = React.useState(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = React.useState(false);
  const [isRegionLead, setIsRegionLead] = React.useState(false);
  const [isWorker, setIsWorker] = React.useState(false);
  const [adminRole, setAdminRole] = React.useState(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const { location, detecting, detect } = useLocation() || {};

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        Promise.all([
          getDoc(doc(db, 'admins', currentUser.uid)),
          getDoc(doc(db, 'worker_auth', currentUser.uid))
        ]).then(([d, workerDoc]) => {
          const role = d.data()?.role;
          setIsAdmin(d.exists());
          setIsWorker(workerDoc.exists());
          setAdminRole(role);
          setIsSuperAdmin(d.exists() && role === 'superadmin');
          setIsRegionLead(d.exists() && role === 'regionLead');
        }).catch(() => { });
      } else {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setIsRegionLead(false);
        setIsWorker(false);
        setAdminRole(null);
      }
    });
    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
    setMenuOpen(false);
  };

  const locationLabel = detecting
    ? '📍 Detecting...'
    : location?.display
      ? `📍 ${location.display}`
      : '📍 Set Location';

  return (
    <header style={{
      padding: '12px 20px',
      background: 'linear-gradient(90deg, #A259FF 0%, #7C3AED 100%)',
      color: '#fff',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 2px 8px rgba(162,89,255,0.3)',
      position: 'relative'
    }}>
      {/* Logo */}
      <Link to="/" style={{ textDecoration: 'none' }}>
        <div style={{
          fontWeight: 'bold',
          fontSize: '22px',
          color: '#fff',
          cursor: 'pointer'
        }}>
          🏠 Gigtos
        </div>
      </Link>

      {/* Location pill */}
      <button
        onClick={() => detect && detect()}
        title="Refresh location"
        style={{
          background: 'rgba(255,255,255,0.18)',
          border: '1px solid rgba(255,255,255,0.4)',
          color: '#fff',
          borderRadius: 999,
          padding: '4px 12px',
          fontSize: '12px',
          cursor: 'pointer',
          fontWeight: 500,
          maxWidth: 200,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {locationLabel}
      </button>

      {/* Navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        {user ? (
          <>
            {/* Desktop Quick Nav */}
            <nav className="desktop-nav" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>Home</Link>

              {/* Show Admin Dashboard instead of My Bookings for admins */}
              {isSuperAdmin ? (
                <Link to="/admin/super" style={{ color: '#fff', textDecoration: 'none', fontSize: '14px', fontWeight: '500', backgroundColor: 'rgba(255,200,0,0.3)', padding: '6px 12px', borderRadius: '4px', border: '1px solid rgba(255,200,0,0.5)' }}>
                  🛡️ SuperAdmin Dash
                </Link>
              ) : isRegionLead ? (
                <Link to="/admin/region-lead" style={{ color: '#fff', textDecoration: 'none', fontSize: '14px', fontWeight: '500', backgroundColor: 'rgba(100,200,255,0.3)', padding: '6px 12px', borderRadius: '4px', border: '1px solid rgba(100,200,255,0.5)' }}>
                  📍 Region Lead Dash
                </Link>
              ) : isAdmin ? (
                <Link to="/admin" style={{ color: '#fff', textDecoration: 'none', fontSize: '14px', fontWeight: '500', backgroundColor: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '4px' }}>
                  👨‍💼 Admin Dash
                </Link>
              ) : isWorker ? (
                <Link to="/worker/dashboard" style={{ color: '#fff', textDecoration: 'none', fontSize: '14px', fontWeight: '500', backgroundColor: 'rgba(16,185,129,0.35)', padding: '6px 12px', borderRadius: '4px' }}>
                  👷 Worker Dash
                </Link>
              ) : (
                <Link to="/my-bookings" style={{ color: '#fff', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>My Bookings</Link>
              )}
            </nav>

            {/* Universal Hamburger Menu */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  fontSize: '24px',
                  cursor: 'pointer',
                  padding: '5px'
                }}
              >
                {menuOpen ? '✕' : '☰'}
              </button>

              {menuOpen && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '10px',
                  backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  zIndex: 1000, minWidth: '200px', overflow: 'hidden'
                }}>
                  <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #eee', color: '#475569', fontSize: '13px', fontWeight: 'bold' }}>
                    👤 {user.email?.split('@')[0]}
                  </div>

                  {/* Mobile-only visible links in menu */}
                  <div className="mobile-only-menu">
                    <Link to="/" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '12px 16px', color: '#333', textDecoration: 'none', borderBottom: '1px solid #eee', fontSize: '14px' }}>
                      🏠 Home
                    </Link>
                    {(isAdmin || isSuperAdmin || isRegionLead) ? (
                      <>
                        <Link to="/my-bookings" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '12px 16px', color: '#333', textDecoration: 'none', borderBottom: '1px solid #eee', fontSize: '14px' }}>
                          📅 My Bookings
                        </Link>
                        <Link to={isSuperAdmin ? "/admin/super" : isRegionLead ? "/admin/region-lead" : "/admin"} onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '12px 16px', color: '#333', textDecoration: 'none', borderBottom: '1px solid #eee', fontSize: '14px' }}>
                          {isSuperAdmin ? "🛡️ SuperAdmin Dash" : isRegionLead ? "📍 Region Lead Dash" : "👨‍💼 Admin Dash"}
                        </Link>
                      </>
                    ) : (
                      <>
                        {isWorker ? (
                          <Link to="/worker/dashboard" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '12px 16px', color: '#333', textDecoration: 'none', borderBottom: '1px solid #eee', fontSize: '14px' }}>
                            👷 Worker Dashboard
                          </Link>
                        ) : (
                          <Link to="/my-bookings" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '12px 16px', color: '#333', textDecoration: 'none', borderBottom: '1px solid #eee', fontSize: '14px' }}>
                            📅 My Bookings
                          </Link>
                        )}
                      </>
                    )}
                  </div>

                  <Link to="/profile" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '12px 16px', color: '#333', textDecoration: 'none', borderBottom: '1px solid #eee', fontSize: '14px' }}>
                    ✏️ Edit Profile
                  </Link>
                  <div onClick={handleLogout} style={{ padding: '12px 16px', color: '#f44336', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
                    🚪 Logout
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <button
            onClick={() => navigate('/auth')}
            style={{
              padding: '8px 16px', backgroundColor: 'rgba(255,255,255,0.3)',
              color: '#fff', border: '2px solid white', borderRadius: '6px',
              cursor: 'pointer', fontWeight: 'bold', fontSize: '14px'
            }}
          >
            🔐 Login
          </button>
        )}
      </div>

      <style>{`
        .mobile-only-menu { display: none; }
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-only-menu { display: block; }
        }
      `}</style>
    </header>
  );
}
