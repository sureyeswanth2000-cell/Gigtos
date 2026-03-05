import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export default function Header() {
  const navigate = useNavigate();
  const [user, setUser] = React.useState(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        getDoc(doc(db, 'admins', currentUser.uid)).then(d => {
          setIsAdmin(d.exists());
          setIsSuperAdmin(d.exists() && d.data()?.role === 'superadmin');
        }).catch(() => { });
      } else {
        setIsAdmin(false);
        setIsSuperAdmin(false);
      }
    });
    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    navigate('/');
    setMenuOpen(false);
  };

  return (
    <header style={{
      padding: '12px 20px',
      background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
      color: '#fff',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
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
          🏠 Gigto
        </div>
      </Link>

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
              ) : isAdmin ? (
                <Link to="/admin" style={{ color: '#fff', textDecoration: 'none', fontSize: '14px', fontWeight: '500', backgroundColor: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '4px' }}>
                  👨‍💼 Admin Dash
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
                    {(isAdmin || isSuperAdmin) ? (
                      <>
                        <Link to="/my-bookings" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '12px 16px', color: '#333', textDecoration: 'none', borderBottom: '1px solid #eee', fontSize: '14px' }}>
                          📅 My Bookings
                        </Link>
                        <Link to={isSuperAdmin ? "/admin/super" : "/admin"} onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '12px 16px', color: '#333', textDecoration: 'none', borderBottom: '1px solid #eee', fontSize: '14px' }}>
                          {isSuperAdmin ? "🛡️ SuperAdmin Dash" : "👨‍💼 Admin Dash"}
                        </Link>
                      </>
                    ) : (
                      <Link to="/my-bookings" onClick={() => setMenuOpen(false)} style={{ display: 'block', padding: '12px 16px', color: '#333', textDecoration: 'none', borderBottom: '1px solid #eee', fontSize: '14px' }}>
                        📅 My Bookings
                      </Link>
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
