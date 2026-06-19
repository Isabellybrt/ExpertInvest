import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Make Google Client ID available to authService
(window as any).__GOOGLE_CLIENT_ID__ = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
