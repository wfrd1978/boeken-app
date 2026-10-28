// Service worker: zorgt dat de app snel opent, ook met slecht of geen internet.
const CACHE = 'boeken-v6';
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
  if (antwoord.ok) {
    const cache = await caches.open(CACHE);
    await cache.put(request, antwoord.clone());
  }
  return antwoord;
}

// Een nieuwe versie van de pagina pas bewaren als álle bestanden van die versie binnen zijn:
// de bestanden die de pagina noemt, en de onderdelen die later worden geladen (Excel, scanner).
// Zo start de app ook zonder internet altijd met een complete versie. Daarna gaan de
// bestanden van oudere versies weg, zodat de opslag niet volloopt.
async function bewaarVersie(cache, antwoord) {
  const html = await antwoord.clone().text();
  const basis = self.registration.scope;
  const nodig = new Set([...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)].map((m) => new URL(m[1], basis).href));
  for (const adres of [...nodig]) {
    if (!adres.endsWith('.js')) continue;
    const bewaard = await cache.match(adres);
    const code = await (bewaard ?? (await fetch(adres))).clone().text();
    for (const m of code.matchAll(/["'`]\.\/([\w.-]+\.(?:js|css))["'`]/g)) nodig.add(new URL(m[1], adres).href);
  }
  for (const adres of nodig) {
    if (await cache.match(adres)) continue;
    const bestand = await fetch(adres);
    if (!bestand.ok) throw new Error(`Bestand ontbreekt: ${adres}`);
    await cache.put(adres, bestand);
  }
  await cache.put(basis, antwoord);
  for (const oud of await cache.keys()) {
    if (new URL(oud.url).pathname.includes('/assets/') && !nodig.has(oud.url)) await cache.delete(oud);
  }
}

function isPagina(url) {
  return url.href === self.registration.scope || url.pathname.endsWith('/index.html');
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

// De app zelf openen (de pagina, thema.js, het manifest): meteen uit de opslag, zodat de app
// direct opstart, ook bij traag internet. Op de achtergrond wordt de nieuwste versie opgehaald;
// de app meldt dan 'Nieuwe versie klaar'. Nog niets bewaard: gewoon van internet.
async function snelOpenen(request, event) {
  const cache = await caches.open(CACHE);
  const pagina = request.mode === 'navigate';
  const bewaard = pagina ? await cache.match(self.registration.scope) : await cache.match(request);
  // Opslaan gebeurt op de achtergrond: de pagina hoeft daar niet op te wachten.
  let opslaan = null;
  const netwerk = fetch(pagina ? self.registration.scope : request, { cache: 'no-cache' }).then((antwoord) => {
    if (antwoord.ok) opslaan = pagina ? bewaarVersie(cache, antwoord.clone()) : cache.put(request, antwoord.clone());
    return antwoord;
  });
  event.waitUntil(netwerk.then(() => opslaan).catch(() => {}));
  if (!bewaard) return netwerk;
  netwerk.catch(() => {});
  return bewaard;
}

// De app vraagt de pagina op om te zien of er een nieuwe versie is: altijd van internet,
// en een nieuwe versie meteen compleet klaarzetten voor de volgende keer.
async function paginaVanInternet(request, event) {
  const cache = await caches.open(CACHE);
  try {
    const antwoord = await fetch(request, { cache: 'no-store' });
    if (antwoord.ok) bewaarVersie(cache, antwoord.clone()).catch(() => {});
    return antwoord;
  } catch {
    return (await cache.match(self.registration.scope)) ?? Response.error();
  }
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
  if (url.pathname.includes('/assets/')) event.respondWith(opslagEerst(request));
  else if (request.mode === 'navigate' || /\/(thema\.js|manifest\.webmanifest)$/.test(url.pathname)) event.respondWith(snelOpenen(request, event));
  else if (isPagina(url)) event.respondWith(paginaVanInternet(request, event));
  // Lijsten (tips, nieuws, reeksen) en de rest: eerst internet, zodat ze vers zijn.
  else event.respondWith(netwerkEerst(request));
});
