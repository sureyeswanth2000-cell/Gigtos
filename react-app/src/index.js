import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initAppCheck } from './utils/appCheck';

// Initialize Firebase App Check before any Firebase service calls
initAppCheck();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
