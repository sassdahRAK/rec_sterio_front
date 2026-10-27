import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // In production Caddy serves the public portal at `/` and this console at
  // `/console/`, so the built asset URLs must carry that prefix. Dev stays at
  // `/` so the familiar local URLs keep working.
  base: mode === 'production' ? '/console/' : '/',
  server: {
    port: 5173,
    strictPort: false,
    // Bind IPv4 explicitly. Left to itself Vite may bind only ::1, and a browser
    // that resolves `localhost` to 127.0.0.1 then gets ECONNREFUSED on a server
    // that looks perfectly healthy.
    host: '127.0.0.1',
    // Same-origin API calls in dev, matching the deployed layout (Caddy serves
    // the built dashboard and /api from one origin). No CORS preflight, and the
    // browser never needs to reach the API port directly.
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false },
    },
  },
  preview: {
    port: 4173,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false },
    },
  },
}));
