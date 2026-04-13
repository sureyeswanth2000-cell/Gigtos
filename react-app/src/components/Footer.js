import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="premium-footer">
      <div className="footer-container">
        <div className="footer-grid">
          {/* Brand Info */}
          <div className="footer-brand">
            <div className="footer-logo">
              <span className="logo-icon">🏠</span>
              <span className="logo-text">Gigtos</span>
            </div>
            <p className="footer-tagline">
              Connecting skilled workers with opportunities. The future of the gig economy, built for speed and trust.
            </p>
            <div className="footer-socials">
              <a href="#" className="social-link">𝕏</a>
              <a href="#" className="social-link">📸</a>
              <a href="#" className="social-link">💼</a>
            </div>
          </div>

          {/* Site Links */}
          <div className="footer-links-group">
            <h4>Platform</h4>
            <Link to="/jobs">Browse Jobs</Link>
            <Link to="/auth">Sign In</Link>
            <Link to="/services">Services</Link>
          </div>

          <div className="footer-links-group">
            <h4>Support</h4>
            <Link to="/help">Help Center</Link>
            <Link to="/contact">Contact Us</Link>
            <Link to="/faq">FAQs</Link>
          </div>

          <div className="footer-links-group">
            <h4>Legal</h4>
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
            <Link to="/security">Security</Link>
          </div>
        </div>

        <div className="footer-bottom">
          <p>© {new Date().getFullYear()} Gigtos. All rights reserved.</p>
          <div className="footer-badges">
            <span className="premium-badge">✨ Premium Platform</span>
            <span className="verified-badge">🛡️ Verified Workers</span>
          </div>
        </div>
      </div>

      <style>{`
        .premium-footer {
          margin-top: 100px;
          background: var(--glass-bg);
          backdrop-filter: var(--glass-blur);
          border-top: 1px solid var(--glass-border);
          padding: 80px 24px 40px;
          position: relative;
          z-index: 10;
        }

        .footer-container {
          max-width: 1200px;
          margin: 0 auto;
        }

        .footer-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr 1fr;
          gap: 40px;
          margin-bottom: 60px;
        }

        .footer-brand {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .footer-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
        }

        .footer-logo .logo-text {
          font-weight: 800;
          font-size: 24px;
          color: var(--primary-purple);
          letter-spacing: -0.5px;
        }

        .footer-tagline {
          color: var(--text-muted);
          font-size: 15px;
          line-height: 1.6;
          max-width: 300px;
        }

        .footer-socials {
          display: flex;
          gap: 12px;
        }

        .social-link {
          width: 36px;
          height: 36px;
          background: var(--bg-soft);
          border: 1px solid var(--border-light);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
          color: var(--text-main);
          font-size: 14px;
          transition: all 0.2s;
        }

        .social-link:hover {
          background: var(--primary-purple);
          color: white;
          transform: translateY(-2px);
        }

        .footer-links-group h4 {
          color: var(--text-main);
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 24px;
        }

        .footer-links-group a {
          display: block;
          color: var(--text-muted);
          text-decoration: none;
          font-size: 14px;
          margin-bottom: 12px;
          transition: color 0.2s;
        }

        .footer-links-group a:hover {
          color: var(--primary-purple);
        }

        .footer-bottom {
          padding-top: 40px;
          border-top: 1px solid var(--border-light);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 20px;
        }

        .footer-bottom p {
          color: var(--text-muted);
          font-size: 14px;
        }

        .footer-badges {
          display: flex;
          gap: 16px;
        }

        .premium-badge, .verified-badge {
          font-size: 12px;
          font-weight: 700;
          color: var(--primary-purple);
          background: var(--primary-purple-glow);
          padding: 6px 12px;
          border-radius: var(--radius-sm);
        }

        @media (max-width: 900px) {
          .footer-grid {
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 600px) {
          .footer-grid {
            grid-template-columns: 1fr;
            text-align: center;
          }
          .footer-brand {
            align-items: center;
          }
          .footer-tagline {
            max-width: 100%;
          }
          .footer-socials {
            justify-content: center;
          }
          .footer-bottom {
            flex-direction: column;
            text-align: center;
          }
        }
      `}</style>
    </footer>
  );
}

