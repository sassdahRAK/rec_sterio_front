import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Google's OAuth client for this project only has `http://localhost:5174`
// registered as an allowed JavaScript origin (the portal's dev port), and none
// of the 5173 spellings are registered, so the operator cannot add them
// easily. This console is normally reached through the portal's sign-in, but
// when it is opened as http://127.0.0.1:5173 the browser gets
// `origin_mismatch` from Google, so that spelling is permanently redirected to
// `localhost` here instead. Only the literal 127.0.0.1 host is rewritten: the
// bot's "Go to admin" link uses this machine's LAN IP and has to keep working.
// 308 rather than 301/302 so the method and body of the same-origin `/api`
// calls made from the page survive. The redirect target, `localhost`, is never
// rewritten, so there is no loop.
//
// The middleware's request/response shape is spelled out locally rather than
// taken from Vite's `Connect` types: those lean on @types/node, so they cannot
// describe `headers`/`url` in an app where that package is not installed.
type LoopbackRequest = { headers: { host?: string }; url?: string };
type LoopbackResponse = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(): void;
};

function redirectLoopbackToLocalhost(): Plugin {
  const toLocalhost = (req: LoopbackRequest, res: LoopbackResponse, next: () => void) => {
    const host = (req.headers.host ?? '').toLowerCase();
    // Split host from port without bracketed-IPv6 handling: 127.0.0.1 is
    // never bracketed, and every other host is passed through untouched.
    const sep = host.lastIndexOf(':');
    const hostname = (sep === -1 ? host : host.slice(0, sep)).replace(/\.$/, '');
    if (hostname !== '127.0.0.1') return next();
    const port = sep === -1 ? '' : host.slice(sep + 1);
    // These are plain-HTTP dev servers, so 80 is the scheme default; 443 is
    // omitted too since an https listener would never reach this middleware.
    const suffix = port === '' || port === '80' || port === '443' ? '' : `:${port}`;
    res.statusCode = 308;
    res.setHeader('Location', `http://localhost${suffix}${req.url ?? '/'}`);
    res.end();
  };
  // At runtime `use` takes an ordinary (req, res, next) handler; the `unknown`
  // handle in this local signature is only here to decouple it from Vite's
  // Connect typings, which cannot express the shape declared above.
  const mount = (server: { middlewares: { use(handle: unknown): unknown } }) => {
    server.middlewares.use(toLocalhost);
  };
  return {
    name: 'redirect-loopback-to-localhost',
    // Hooks without a returned function run before Vite's internal
    // middlewares, so the redirect wins over static serving and the proxy.
    configureServer(server) {
      mount(server);
    },
    configurePreviewServer(server) {
      mount(server);
    },
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [redirectLoopbackToLocalhost(), react()],
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
