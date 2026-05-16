import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import LocationBar from './LocationBar';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../context/ThemeContext';
import { getDevBypassUserFromSearch, isDevBypassEnabled } from '../utils/devBypass';
import { getServiceOptions } from '../utils/serviceCatalog';

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
  const [serviceQuery, setServiceQuery] = React.useState('');
  const [searchOpen, setSearchOpen] = React.useState(false);
  const services = React.useMemo(() => getServiceOptions(), []);
  const serviceMatches = React.useMemo(() => {
    const query = serviceQuery.trim().toLowerCase();
    if (!query) return services.slice(0, 6);
    return services
      .filter((service) =>
        service.name.toLowerCase().includes(query) ||
        service.category.toLowerCase().includes(query) ||
        service.iconLabel.toLowerCase().includes(query)
      )
      .slice(0, 7);
  }, [serviceQuery, services]);

  React.useEffect(() => {
    if (isDevBypassEnabled()) {
      try {
        const devUser = getDevBypassUserFromSearch(window.location.search);
        if (devUser) {
          setUser(devUser);
          setIsAdmin(devUser.role === 'superadmin' || devUser.role === 'field_operator');
          setIsWorker(devUser.role === 'worker');
          setAdminRole(devUser.role);
          setIsSuperAdmin(devUser.role === 'superadmin');
          setIsRegionLead(false);
          setIsMason(false);
          return undefined;
        }
      } catch {
        // Use normal auth if the local bypass URL is invalid.
      }
    }

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

  const openService = (serviceName) => {
    setServiceQuery('');
    setSearchOpen(false);
    setMenuOpen(false);
    navigate(`/service?type=${encodeURIComponent(serviceName)}`);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    if (serviceMatches[0]) openService(serviceMatches[0].name);
  };

  return (
    <>
    <header className="premium-header">
      {/* Logo */}
      <Link to="/" className="header-logo">
        <span className="logo-icon">🏠</span>
        <span className="logo-text">Gigtos</span>
      </Link>

      <form className="header-search" onSubmit={handleSearchSubmit}>
        <input
          value={serviceQuery}
          onFocus={() => setSearchOpen(true)}
          onChange={(event) => {
            setServiceQuery(event.target.value);
            setSearchOpen(true);
          }}
          placeholder="Search maid, cleaning, electrician..."
          aria-label="Search services"
        />
        <button type="submit">Search</button>
        {searchOpen && (
          <div className="header-search-results">
            {serviceMatches.length > 0 ? serviceMatches.map((service) => (
              <button key={service.id} type="button" onMouseDown={() => openService(service.name)}>
                <span>{service.name}</span>
                <small>{service.category}</small>
              </button>
            )) : (
              <div className="header-search-empty">No service found</div>
            )}
          </div>
        )}
      </form>

      {/* Navigation & Theme */}
      <div className="header-actions">
        <ThemeToggle />

        {user ? (
          <>
            {/* Desktop Quick Nav */}
            <nav className="desktop-nav">
              <Link to="/" className="nav-link">Home</Link>
              <Link to="/services" className="nav-link">Services</Link>
              {!isWorker && (
                <Link to="/jobs" className="nav-link">Browse Jobs</Link>
              )}

              {/* Role Badges */}
              {isSuperAdmin ? (
                <Link to="/admin/super" className="role-pill super-admin">
                  🛡️ SuperAdmin
                </Link>
              ) : adminRole === 'field_operator' ? (
                <Link to="/operator" className="role-pill admin-role">
                  Field Operator
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
                    <Link to="/services" onClick={() => setMenuOpen(false)} className="menu-item mobile-item">
                      Services
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
                        <Link to={isSuperAdmin ? "/admin/super" : adminRole === 'field_operator' ? "/operator" : isRegionLead ? "/admin/region-lead" : isMason ? "/mason/dashboard" : "/admin"} onClick={() => setMenuOpen(false)} className="menu-item mobile-item highlighted">
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

        .header-search {
          flex: 1;
          max-width: 560px;
          min-width: 260px;
          display: flex;
          align-items: center;
          gap: 8px;
          position: relative;
          background: var(--bg-surface);
          border: 1px solid var(--border-light);
          border-radius: 8px;
          padding: 6px;
          box-shadow: var(--shadow-sm);
        }

        .header-search input {
          flex: 1;
          min-width: 0;
          border: none;
          outline: none;
          background: transparent;
          color: var(--text-main);
          font-size: 14px;
          padding: 8px 10px;
        }

        .header-search button[type="submit"] {
          border: none;
          border-radius: 7px;
          background: var(--text-main);
          color: var(--bg-surface);
          font-size: 12px;
          font-weight: 800;
          padding: 8px 12px;
          cursor: pointer;
        }

        .header-search-results {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          background: var(--bg-surface);
          border: 1px solid var(--border-light);
          border-radius: 8px;
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          z-index: 1200;
        }

        .header-search-results button {
          width: 100%;
          border: none;
          background: transparent;
          color: var(--text-main);
          padding: 12px 14px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          border-bottom: 1px solid var(--border-light);
        }

        .header-search-results button:hover {
          background: var(--bg-soft);
        }

        .header-search-results small,
        .header-search-empty {
          color: var(--text-muted);
          font-size: 12px;
        }

        .header-search-empty {
          padding: 14px;
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
          .premium-header {
            padding: 10px 14px;
            display: grid;
            grid-template-columns: 1fr auto;
            gap: 10px;
          }
          .header-search {
            order: 3;
            grid-column: 1 / -1;
            min-width: 0;
            max-width: none;
          }
          .header-actions {
            gap: 10px;
            justify-content: flex-end;
          }
        }
      `}</style>
    </header>
    <LocationBar />
    </>
  );
}

