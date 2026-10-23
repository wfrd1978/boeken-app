// Eenvoudige service worker: eerst het netwerk, bij geen internet de opgeslagen versie.
const CACHE = 'boeken-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(request)
      .then((response) => {
        const kopie = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, kopie));
        return response;
      })
      .catch(() => caches.match(request).then((r) => r || caches.match('./')))
  );
});
