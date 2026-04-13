import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import LocationBar from './LocationBar';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';

export default function Header() {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [user, setUser] = React.useState(null);
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = React.useState(false);
  const [isRegionLead, setIsRegionLead] = React.useState(false);
  const [isMason, setIsMason] = React.useState(false);
  const [isWorker, setIsWorker] = React.useState(false);
  const [adminRole, setAdminRole] = React.useState(null);
  const [menuOpen, setMenuOpen] = React.useState(false);

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
          setIsRegionLead(d.exists() && (role === 'regionLead' || role === 'region-lead'));
          setIsMason(d.exists() && role === 'mason');
        }).catch(() => {
          // Firestore read failed — use defaults
        });
      } else {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setIsRegionLead(false);
        setIsMason(false);
        setIsWorker(false);
        setAdminRole(null);
      }
    });
    return unsubscribe;
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      // Sign-out failed
    }
    navigate('/');
    setMenuOpen(false);
  };

  return (
    <>
    <header className="premium-header">
      {/* Logo */}
      <Link to="/" className="header-logo">
        <span className="logo-icon">🏠</span>
        <span className="logo-text">Gigtos</span>
      </Link>

      {/* Navigation & Theme */}
      <div className="header-actions">
        <ThemeToggle />

        {user ? (
          <>
            {/* Desktop Quick Nav */}
            <nav className="desktop-nav">
              <Link to="/" className="nav-link">Home</Link>
              {!isWorker && (
                <Link to="/jobs" className="nav-link">Browse Jobs</Link>
              )}

              {/* Role Badges */}
              {isSuperAdmin ? (
                <Link to="/admin/super" className="role-pill super-admin">
                  🛡️ SuperAdmin
                </Link>
              ) : isRegionLead ? (
                <Link to="/admin/region-lead" className="role-pill region-lead">
                  📍 Region Lead
                </Link>
              ) : isMason ? (
                <Link to="/mason/dashboard" className="role-pill mason-role">
                  🧱 Mason
                </Link>
              ) : isAdmin ? (
                <Link to="/admin" className="role-pill admin-role">
                  👨‍💼 Admin
                </Link>
              ) : isWorker ? (
                <Link to="/worker/dashboard" className="role-pill worker-role">
                  👷 Worker
                </Link>
              ) : (
                <Link to="/my-bookings" className="nav-link">My Bookings</Link>
              )}
            </nav>

            {/* Hamburger Menu Trigger */}
            <div className="menu-container">
              <button
                className={`menu-trigger ${menuOpen ? 'open' : ''}`}
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Toggle Navigation"
              >
                {menuOpen ? '✕' : '☰'}
              </button>

              {menuOpen && (
                <div className="dropdown-menu">
                  <div className="menu-header">
                    <span className="user-email">👤 {user.email?.split('@')[0]}</span>
                  </div>

                  <div className="mobile-only-links">
                    <Link to="/" onClick={() => setMenuOpen(false)} className="menu-item mobile-item">
                      🏠 Home
                    </Link>
                    {!isWorker && (
                      <Link to="/jobs" onClick={() => setMenuOpen(false)} className="menu-item mobile-item">
                        💼 Browse Jobs
                      </Link>
                    )}
                    {(isAdmin || isSuperAdmin || isRegionLead) ? (
                      <>
                        <Link to="/my-bookings" onClick={() => setMenuOpen(false)} className="menu-item mobile-item">
                          📅 My Bookings
                        </Link>
                        <Link to={isSuperAdmin ? "/admin/super" : isRegionLead ? "/admin/region-lead" : isMason ? "/mason/dashboard" : "/admin"} onClick={() => setMenuOpen(false)} className="menu-item mobile-item highlighted">
                          Dashboard
                        </Link>
                      </>
                    ) : (
                      <>
                        {isWorker ? (
                          <Link to="/worker/dashboard" onClick={() => setMenuOpen(false)} className="menu-item mobile-item highlighted">
                            👷 Worker Dash
                          </Link>
                        ) : (
                          <Link to="/my-bookings" onClick={() => setMenuOpen(false)} className="menu-item mobile-item">
                            📅 My Bookings
                          </Link>
                        )}
                      </>
                    )}
                  </div>

                  <Link to="/profile" onClick={() => setMenuOpen(false)} className="menu-item">
                    ✏️ Edit Profile
                  </Link>
                  <div onClick={handleLogout} className="menu-item logout">
                    🚪 Logout
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <button className="login-btn" onClick={() => navigate('/auth')}>
            🔐 Login
          </button>
        )}
      </div>

      <style>{`
        .premium-header {
          padding: 12px 24px;
          background: var(--glass-bg);
          backdrop-filter: var(--glass-blur);
          border-bottom: 1px solid var(--glass-border);
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: sticky;
          top: 0;
          z-index: 1000;
          box-shadow: var(--glass-shadow);
          transition: all var(--motion-base);
        }

        .header-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }

        .logo-text {
          font-weight: 800;
          font-size: 24px;
          color: var(--primary-purple);
          letter-spacing: -1px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .desktop-nav {
          display: flex;
          gap: 20px;
          align-items: center;
        }

        .nav-link {
          color: var(--text-main);
          font-size: 14px;
          font-weight: 600;
          opacity: 0.8;
          transition: opacity 0.2s;
        }

        .nav-link:hover {
          opacity: 1;
          color: var(--primary-purple);
        }

        .role-pill {
          padding: 6px 14px;
          border-radius: var(--radius-pill);
          font-size: 13px;
          font-weight: 700;
          text-decoration: none;
          transition: transform 0.2s;
          border: 1px solid transparent;
        }

        .role-pill:hover {
          transform: translateY(-1px);
        }

        .role-pill.super-admin {
          background: var(--warning-bg);
          color: var(--warning);
          border-color: var(--warning);
        }

        .role-pill.region-lead {
          background: var(--primary-purple-glow);
          color: var(--primary-purple);
          border-color: var(--primary-purple);
        }

        .role-pill.mason-role {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
          border-color: #10b981;
        }

        .role-pill.admin-role {
          background: var(--bg-soft);
          color: var(--text-muted);
          border-color: var(--border-light);
        }

        .role-pill.worker-role {
          background: var(--bg-soft);
          color: var(--primary-purple);
          border-color: var(--primary-purple);
        }

        .menu-trigger {
          background: var(--bg-soft);
          border: 1px solid var(--border-light);
          color: var(--text-main);
          width: 40px;
          height: 40px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          font-size: 20px;
          transition: all 0.2s;
        }

        .menu-trigger:hover {
          background: var(--primary-purple-glow);
          border-color: var(--primary-purple);
        }

        .dropdown-menu {
          position: absolute;
          top: calc(100% + 12px);
          right: 0;
          min-width: 240px;
          background: var(--glass-bg);
          backdrop-filter: var(--glass-blur);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          animation: slide-in 0.2s ease-out;
        }

        @keyframes slide-in {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .menu-header {
          padding: 16px;
          background: var(--bg-mesh-1);
          border-bottom: 1px solid var(--border-light);
        }

        .user-email {
          font-size: 13px;
          font-weight: 700;
          color: var(--text-main);
        }

        .menu-item {
          display: block;
          padding: 12px 16px;
          color: var(--text-main);
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: background 0.2s;
        }

        .menu-item:hover {
          background: var(--primary-purple-glow);
          color: var(--primary-purple);
        }

        .menu-item.logout {
          color: var(--error);
          font-weight: 700;
          border-top: 1px solid var(--border-light);
          cursor: pointer;
        }

        .menu-item.highlighted {
          background: var(--primary-purple-glow);
          color: var(--primary-purple);
          font-weight: 700;
        }

        .login-btn {
          padding: 8px 20px;
          background: linear-gradient(135deg, var(--primary-purple), var(--primary-purple-dark));
          color: white;
          border: none;
          border-radius: var(--radius-pill);
          font-weight: 700;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .login-btn:hover {
          transform: translateY(-1px);
        }

        .mobile-only-links {
          display: none;
        }

        @media (max-width: 768px) {
          .desktop-nav { display: none; }
          .mobile-only-links { display: block; }
          .premium-header { padding: 10px 16px; }
        }
      `}</style>
    </header>
    <LocationBar />
    </>
  );
}

