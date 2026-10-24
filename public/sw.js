// Service worker: zorgt dat de app snel opent, ook met slecht of geen internet.
const CACHE = 'boeken-v5';
// Covers van Google Books en Open Library apart bewaren, zodat ze na een herstart meteen
// van de telefoon komen in plaats van opnieuw van internet.
const COVERS = 'covers-v1';
const COVER_ADRESSEN = ['books.google.com', 'books.googleusercontent.com', 'covers.openlibrary.org', 'static.unbidan.nl'];
const MAX_COVERS = 600;
const WACHT_OP_NETWERK = 3000;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== COVERS).map((k) => caches.delete(k))))
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

// Is er genoeg ruimte? De boeken zelf gaan altijd voor: bij twijfel geen cover bewaren.
async function ruimteVoorCovers(cache) {
  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (usage > quota * 0.5) return false;
  } catch {
    // Geen schatting mogelijk: dan alleen de grens op het aantal covers.
  }
  return (await cache.keys()).length < MAX_COVERS;
}

async function coverEerst(request) {
  const cache = await caches.open(COVERS);
  const bewaard = await cache.match(request);
  if (bewaard) return bewaard;
  const antwoord = await fetch(request);
  // Plaatjes van een andere site zijn 'gesloten' (type opaque): wel te bewaren en te tonen.
  if ((antwoord.ok || antwoord.type === 'opaque') && (await ruimteVoorCovers(cache))) {
    cache.put(request, antwoord.clone()).catch(() => {});
  }
  return antwoord;
}

// Laadt een bewaarde cover toch niet, dan vraagt de app hem weg te gooien.
self.addEventListener('message', (event) => {
  if (typeof event.data?.coverWeg === 'string') {
    event.waitUntil(caches.open(COVERS).then((cache) => cache.delete(event.data.coverWeg)));
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;
  if (request.destination === 'image' && COVER_ADRESSEN.includes(url.hostname)) {
    event.respondWith(coverEerst(request));
    return;
  }
  if (url.origin !== self.location.origin) return;
  event.respondWith(url.pathname.includes('/assets/') ? opslagEerst(request) : netwerkEerst(request));
});
