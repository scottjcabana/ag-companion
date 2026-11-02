// Antigravity Android Companion Service Worker (v3 - Network-First Shell)
const CACHE_NAME = 'ag-companion-v3';
const NETWORK_TIMEOUT_MS = 4000;
const RELATIVE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './style.css',
  './app.js',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const requests = RELATIVE_ASSETS.map(
        (p) => new Request(new URL(p, self.registration.scope).toString(), { cache: 'reload' })
      );
      return cache.addAll(requests);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.map((key) => (key !== CACHE_NAME ? caches.delete(key) : Promise.resolve())))
      )
      .then(() => self.clients.claim())
  );
});

async function networkFirstWithTimeout(request) {
  const cache = await caches.open(CACHE_NAME);

  const lookupCached = async () => {
    const direct = await cache.match(request, { ignoreSearch: true });
    if (direct) return direct;
    if (request.mode === 'navigate') {
      return (
        (await cache.match(new URL('./index.html', self.registration.scope).toString())) ||
        (await cache.match(new URL('./', self.registration.scope).toString()))
      );
    }
    return null;
  };

  let timeoutId;
  const networkPromise = fetch(request, { cache: 'no-cache' }).then(
    (response) => {
      clearTimeout(timeoutId);
      if (response && response.ok) {
        cache.put(request, response.clone()).catch(() => {});
        return response;
      }
      throw new Error(`HTTP ${response ? response.status : 0}`);
    },
    (err) => {
      clearTimeout(timeoutId);
      throw err;
    }
  );

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('SW_TIMEOUT')), NETWORK_TIMEOUT_MS);
  });

  try {
    return await Promise.race([networkPromise, timeoutPromise]);
  } catch (err) {
    networkPromise.catch(() => {});
    const cached = await lookupCached();
    if (cached) return cached;
    if (err && err.message === 'SW_TIMEOUT') {
      return networkPromise;
    }
    throw err;
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  // Strict network-only passthrough for all /api/ routes & cross-origin endpoints
  if (url.pathname.includes('/api/') || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(networkFirstWithTimeout(event.request));
});
