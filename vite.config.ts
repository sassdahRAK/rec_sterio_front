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
    // Bind all IPv4 interfaces (0.0.0.0), not just ::1: a browser resolving
    // `localhost` to 127.0.0.1 otherwise gets ECONNREFUSED from a healthy
    // server. It is also what lets the bot's "Go to admin" button open this
    // console from a phone — the link it sends is this machine's LAN IP.
    host: true,
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
