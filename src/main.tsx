import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { setMockEnabled } from './api/client';
import { useAuthStore } from './store/auth';
import { initTheme } from './store/theme';
import './index.css';

// `?mock=1` sticks for the whole session so the demo works without a backend.
if (new URLSearchParams(window.location.search).get('mock') === '1') {
  setMockEnabled(true);
}

// Apply the saved colour scheme before the first paint.
initTheme();

// Re-hydrate the saved session (or open a guest session) before the first
// render so protected routes never flash the wrong screen on a reload.
useAuthStore.getState().restore();

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root is missing from index.html');

createRoot(container).render(
  <StrictMode>
    {/* BASE_URL is `/` in dev and `/console/` in the deployed build. */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
