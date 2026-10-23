// Service worker: zorgt dat de app snel opent, ook met slecht of geen internet.
const CACHE = 'boeken-v3';
const WACHT_OP_NETWERK = 3000;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Bestanden in assets/ hebben een unieke naam per versie: die veranderen nooit, dus eerst uit de opslag.
async function opslagEerst(request) {
  const bewaard = await caches.match(request);
  if (bewaard) return bewaard;
  const antwoord = await fetch(request);
  if (antwoord.ok) (await caches.open(CACHE)).put(request, antwoord.clone());
  return antwoord;
}

// De rest (de pagina zelf, tips.json): eerst internet, zodat je de nieuwste versie krijgt.
// Duurt dat langer dan 3 seconden of is er geen internet, dan de bewaarde versie.
// Alleen goede antwoorden worden bewaard, nooit een foutpagina.
async function netwerkEerst(request) {
  const cache = await caches.open(CACHE);
  const netwerk = fetch(request, { cache: 'no-cache' }).then((antwoord) => {
    if (antwoord.ok) cache.put(request, antwoord.clone());
    return antwoord;
  });
  const bewaard = (await cache.match(request)) || (request.mode === 'navigate' ? await cache.match('./') : undefined);
  if (!bewaard) return netwerk;
  const teLaat = new Promise((klaar) => setTimeout(() => klaar(bewaard), WACHT_OP_NETWERK));
  return Promise.race([netwerk.then((a) => (a.ok ? a : bewaard)).catch(() => bewaard), teLaat]);
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(url.pathname.includes('/assets/') ? opslagEerst(request) : netwerkEerst(request));
});
