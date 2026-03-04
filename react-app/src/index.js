import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import app from './firebase';
import { initAppCheck } from './utils/appCheck';

// Initialise Firebase App Check (reCAPTCHA v3) before any service calls.
// Configure REACT_APP_RECAPTCHA_SITE_KEY in your .env file.
initAppCheck(app);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
