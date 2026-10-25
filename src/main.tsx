import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { setMockEnabled } from './api/client';
import { useAuthStore } from './store/auth';
import './index.css';

// `?mock=1` sticks for the whole session so the demo works without a backend.
if (new URLSearchParams(window.location.search).get('mock') === '1') {
  setMockEnabled(true);
}

// Re-hydrate the saved session before the first render so protected routes
// never flash the login screen on a reload.
useAuthStore.getState().restore();

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
