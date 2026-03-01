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
  const [menuOpen, setMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        getDoc(doc(db, 'admins', currentUser.uid)).then(d => {
          setIsAdmin(d.exists());
        }).catch(()=>{});
      } else {
        setIsAdmin(false);
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
      boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
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
      {user ? (
        <nav style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {/* Desktop Menu */}
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
              Home
            </Link>
            <Link to="/my-bookings" style={{ color: '#fff', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
              My Bookings
            </Link>
            {isAdmin && (
              <Link to="/admin" style={{ color: '#fff', textDecoration: 'none', fontSize: '14px', fontWeight: '500', backgroundColor: 'rgba(255,255,255,0.2)', padding: '6px 12px', borderRadius: '4px' }}>
                👨‍💼 Admin
              </Link>
            )}
          </div>

          {/* User Menu Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                padding: '8px 12px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.4)',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              👤 {user.email?.split('@')[0]}
              <span>{menuOpen ? '▲' : '▼'}</span>
            </button>

            {menuOpen && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 1000,
                minWidth: '200px',
                overflow: 'hidden'
              }}>
                <Link to="/profile" style={{ textDecoration: 'none' }}>
                  <div style={{
                    padding: '12px 16px',
                    color: '#333',
                    borderBottom: '1px solid #eee',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }} onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'} onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}>
                    ✏️ Edit Profile
                  </div>
                </Link>
                <div
                  onClick={handleLogout}
                  style={{
                    padding: '12px 16px',
                    color: '#f44336',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#ffebee'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  🚪 Logout
                </div>
              </div>
            )}
          </div>
        </nav>
      ) : (
        <button
          onClick={() => navigate('/auth')}
          style={{
            padding: '8px 16px',
            backgroundColor: 'rgba(255,255,255,0.3)',
            color: '#fff',
            border: '2px solid white',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px',
            transition: 'background 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.5)'}
          onMouseLeave={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.3)'}
        >
          🔐 Login / Sign Up
        </button>
      )}
    </header>
  );
}
