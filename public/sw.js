// RecSterio console service worker. Hand rolled, no build step, no imports.
// Every URL is resolved against the registration scope so the same file works
// at the root (Vercel) and under /console/ (the Caddy and Docker deployment).
const CACHE_NAME = 'recsterio-admin-shell-v1';

const SCOPE = self.registration.scope;
const INDEX_URL = new URL('index.html', SCOPE).toString();
const OFFLINE_URL = new URL('offline.html', SCOPE).toString();

// The app shell, kept relative on purpose: a leading slash would 404 under
// /console/ and the install would fail there.
const SHELL = [
  '.',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      // Fetch each entry separately so one missing file cannot reject the whole
      // install, and only keep real same origin 200 responses.
      await Promise.all(
        SHELL.map(async (path) => {
          try {
            const request = new Request(new URL(path, SCOPE).toString(), { cache: 'reload' });
            const response = await fetch(request);
            if (response.ok && response.type === 'basic') {
              await cache.put(request, response);
            }
          } catch {
            // A missing optional asset must not block the install.
          }
        }),
      );
      // Take over as soon as the new shell is ready.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      // Only older console shell caches are removed here. The portal has its
      // own worker on the same origin and its cache is not ours to delete.
      await Promise.all(
        keys
          .filter((name) => name.startsWith('recsterio-admin-shell-') && name !== CACHE_NAME)
          .map((name) => caches.delete(name)),
      );
      // Start serving the pages that are already open.
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Writes and non GET traffic always go straight to the network.
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // The API is never cached, never served stale, never intercepted.
  if (url.pathname.includes('/api/')) return;

  // Only same origin GETs are ours to handle.
  if (url.origin !== self.location.origin) return;

  event.respondWith(handleRequest(request));
});

async function handleRequest(request) {
  const cache = await caches.open(CACHE_NAME);

  // A navigation goes to the network first so a new deploy is picked up, then
  // the cached shell for a client side route, then the offline page.
  if (request.mode === 'navigate') {
    try {
      const response = await fetch(request);
      if (response && response.ok) return response;
    } catch {
      // Network is down, fall through to the cache.
    }
    const cachedIndex = await cache.match(INDEX_URL);
    if (cachedIndex) return cachedIndex;
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    return offlineResponse();
  }

  // Other same origin GETs: cache first, with a network fill.
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    // Never cache opaque, redirected or non 200 responses.
    if (response && response.ok && response.type === 'basic') {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return offlineResponse();
  }
}

function offlineResponse() {
  return new Response('Offline', {
    status: 503,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
