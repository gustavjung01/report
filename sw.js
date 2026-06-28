const CACHE_NAME = 'bepi-field-report-v19';
const APP_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './mobile-polish.css',
  './popup-ui.css',
  './fixed-nav.css',
  './admin-report.css',
  './app.js',
  './popup-ui.js',
  './admin-report-ui.js',
  './pwa-update.js',
  './version.json',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/bepi-logo.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    return cache.match('./index.html');
  }
}

async function cacheFirstThenRefresh(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetched = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || fetched || cache.match('./index.html');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isNavigation = event.request.mode === 'navigate';
  const mustBeFresh = url.pathname.endsWith('/sw.js') || url.pathname.endsWith('/version.json') || url.pathname.endsWith('/index.html');

  if (isNavigation || mustBeFresh) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirstThenRefresh(event.request));
});
