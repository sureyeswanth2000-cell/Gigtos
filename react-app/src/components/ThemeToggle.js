import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`theme-toggle theme-${theme}`}
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      aria-label="Toggle brightness"
    >
      <div className="toggle-track">
        <div className="toggle-thumb">
          <span className="toggle-icon">{theme === 'light' ? '🔆' : '🌙'}</span>
        </div>
      </div>

      <style>{`
        .theme-toggle {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-pill);
          padding: 4px;
          cursor: pointer;
          transition: all var(--motion-base);
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: var(--glass-blur);
          width: 60px;
          height: 32px;
          position: relative;
          box-shadow: var(--shadow-sm);
        }

        .theme-toggle:hover {
          background: rgba(255, 255, 255, 0.2);
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
        }

        .toggle-track {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          position: relative;
        }

        .toggle-thumb {
          width: 24px;
          height: 24px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform var(--motion-base) cubic-bezier(0.34, 1.56, 0.64, 1);
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .theme-light .toggle-thumb {
          transform: translateX(0);
        }

        .theme-dark .toggle-thumb {
          transform: translateX(28px);
          background: #1e1b4b;
        }

        .toggle-icon {
          font-size: 14px;
          user-select: none;
        }

        [data-theme='dark'] .theme-toggle {
          background: rgba(0, 0, 0, 0.3);
          border-color: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </button>
  );
}
