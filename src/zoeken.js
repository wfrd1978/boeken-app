import { vindDubbel } from './dubbel.js';

// Boekgegevens ophalen bij Open Library en Google Books (gratis).

// een eigen, gratis Google-sleutel (met zijn toestemming, 23 okt 2026). Hij werkt alleen
// vanaf https://wfrd1978.github.io en alleen voor de Books API, dus openbaar zichtbaar is geen
// probleem. Zonder sleutel deel je de daglimiet met iedereen en krijg je vaak geen antwoord.
const GOOGLE_SLEUTEL = 'AIzaSyBqtajJfZxGfc6wMAAYVOsIDOoUjaexDq4';

// country=NL: Google wil weten voor welk land de gegevens zijn.
function googleUrl(zoekvraag, extra = '') {
  return `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(zoekvraag)}${extra}&country=NL&key=${GOOGLE_SLEUTEL}`;
}

const WACHTTIJD = 10000;

async function haalJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), WACHTTIJD);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Een werk heeft vaak tientallen ISBN's (alle vertalingen). Kies bij voorkeur een Nederlandse.
function kiesIsbn(isbns = []) {
  const dertien = isbns.filter((i) => i.length === 13);
  return (
    dertien.find((i) => i.startsWith('97890') || i.startsWith('97894')) ||
    dertien[0] ||
    isbns[0] ||
    ''
  );
}

const TAAL = { dut: 'nl', eng: 'en', ger: 'de', fre: 'fr' };

// Met lang=nl geeft Open Library waar mogelijk de Nederlandse uitgave mee.
// 'zoekvraag' is vrije tekst, of los titel en auteur voor een preciezere zoekopdracht.
async function zoekOpenLibrary(zoekvraag, limiet = 10) {
  const velden = [
    'key,title,author_name,isbn,cover_i,first_publish_year,number_of_pages_median,language',
    'editions,editions.title,editions.isbn,editions.cover_i,editions.language,editions.publisher',
  ].join(',');
  const vraag =
    typeof zoekvraag === 'string'
      ? `q=${encodeURIComponent(zoekvraag)}`
      : zoekvraag.isbn
        ? `isbn=${encodeURIComponent(zoekvraag.isbn)}`
        : `title=${encodeURIComponent(zoekvraag.titel)}${zoekvraag.auteur ? `&author=${encodeURIComponent(zoekvraag.auteur)}` : ''}`;
  const url = `https://openlibrary.org/search.json?${vraag}&lang=nl&limit=${limiet}&fields=${velden}`;
  const data = await haalJson(url);
  return (data.docs ?? []).map((d) => {
    const uitgave = d.editions?.docs?.[0] ?? {};
    const cover = uitgave.cover_i || d.cover_i;
    const talen = uitgave.language ?? (d.language?.length === 1 ? d.language : []);
    return {
      werk: d.key,
      titel: uitgave.title || d.title,
      auteurs: d.author_name ?? [],
      isbn: kiesIsbn(uitgave.isbn ?? d.isbn),
      coverUrl: cover ? `https://covers.openlibrary.org/b/id/${cover}-M.jpg` : '',
      uitgever: uitgave.publisher?.[0] ?? '',
      jaar: d.first_publish_year ?? null,
      paginas: d.number_of_pages_median ?? null,
      taal: TAAL[talen[0]] ?? '',
    };
  });
}

async function zoekGoogleBooks(tekst, alleenNederlands = false, limiet = 10) {
  const taal = alleenNederlands ? '&langRestrict=nl' : '';
  const url = googleUrl(tekst, `&maxResults=${limiet}${taal}`);
  const data = await haalJson(url);
  return (data.items ?? []).map(({ volumeInfo: v }) => {
    const ids = v.industryIdentifiers ?? [];
    const isbn = (ids.find((i) => i.type === 'ISBN_13') || ids.find((i) => i.type === 'ISBN_10'))?.identifier ?? '';
    const plaatje = v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || '';
    return {
      titel: v.subtitle ? `${v.title}: ${v.subtitle}` : v.title,
      auteurs: v.authors ?? [],
      isbn,
      coverUrl: plaatje.replace('http://', 'https://'),
      uitgever: v.publisher ?? '',
      jaar: v.publishedDate ? Number(v.publishedDate.slice(0, 4)) : null,
      paginas: v.pageCount ?? null,
      taal: v.language ?? '',
      synopsis: schoneTekst(v.description),
    };
  });
}

// Google geeft beschrijvingen soms met HTML (<p>, <br>, <b>). Maak er gewone tekst van,
// met witregels tussen alinea's.
export function schoneTekst(html) {
  if (!html) return '';
  const metRegels = String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*/gi, '\n\n');
  const tekst = new DOMParser().parseFromString(metRegels, 'text/html').body.textContent || '';
  return tekst
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*/g, '\n\n')
    .trim();
}

// Synopsis zoeken: eerst Google Books (meestal de achterflaptekst van de Nederlandse
// uitgave), anders de beschrijving van het werk bij Open Library.
// Geeft '' als niemand er een heeft; een TijdelijkeFout als Google even weigert.
export async function zoekSynopsis(boek) {
  const auteur = boek.auteurs?.[0]?.split('&')[0].trim() ?? '';
  let google = [];
  try {
    if (boek.isbn) google = await zoekGoogleBooks(`isbn:${boek.isbn}`, false, 3);
    if (!google.some((k) => k.synopsis)) {
      const opTitel = await zoekGoogleBooks(`intitle:${boek.titel}${auteur ? ` inauthor:${auteur}` : ''}`, false, 10);
      google = google.concat(opTitel.filter((k) => vindDubbel(boek, [k])));
    }
  } catch (fout) {
    if (fout.status === 429 || fout.status >= 500 || !fout.status) throw new TijdelijkeFout('Google weigert even');
  }
  // Liefst een Nederlandse beschrijving.
  const metTekst = google.filter((k) => k.synopsis);
  const nl = metTekst.find((k) => k.taal === 'nl');
  if (nl || metTekst[0]) return (nl || metTekst[0]).synopsis;
  if (boek.werk) {
    try {
      const werk = await haalJson(`https://openlibrary.org${boek.werk}.json`);
      const d = werk.description;
      return schoneTekst(typeof d === 'string' ? d : d?.value);
    } catch {
      return '';
    }
  }
  return '';
}

function sleutel(boek) {
  const kort = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '');
  return `${kort(boek.titel)}|${kort(boek.auteurs[0])}`;
}

// Zoekt bij beide bronnen tegelijk, voegt samen zonder dubbelingen en zet Nederlandse uitgaven bovenaan.
export async function zoekBoeken(tekst) {
  const pogingen = await Promise.allSettled([
    zoekGoogleBooks(tekst, true),
    zoekOpenLibrary(tekst),
    zoekGoogleBooks(tekst),
  ]);
  if (pogingen.every((p) => p.status === 'rejected')) {
    throw new Error('Geen verbinding met de boekenbronnen');
  }
  const alle = pogingen.flatMap((p) => p.value ?? []);
  const gezien = new Map();
  for (const boek of alle) {
    if (!boek.titel) continue;
    const k = sleutel(boek);
    const eerder = gezien.get(k);
    if (!eerder) gezien.set(k, boek);
    // Vul ontbrekende cover of ISBN aan uit de andere bron.
    else {
      if (!eerder.coverUrl && boek.coverUrl) eerder.coverUrl = boek.coverUrl;
      if (!eerder.isbn && boek.isbn) eerder.isbn = boek.isbn;
    }
  }
  const resultaten = [...gezien.values()];
  // Stabiele sortering: Nederlands eerst, verder de volgorde van de bronnen.
  resultaten.sort((a, b) => (b.taal === 'nl') - (a.taal === 'nl'));
  return resultaten.slice(0, 15);
}

export class TijdelijkeFout extends Error {}

// Een boek opzoeken met een gescand of getypt ISBN. Geeft null als geen bron het kent.
// Google Books gaf geen antwoord (bijvoorbeeld de daglimiet) en Open Library kende het boek niet.
export class GoogleWeigert extends Error {}

// Open Library per uitgave: kent soms ISBN's die de zoekfunctie nog niet heeft.
async function openLibraryUitgave(isbn) {
  const uitgave = await haalJson(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`);
  const namen = await Promise.all(
    (uitgave.authors ?? []).slice(0, 3).map((a) =>
      haalJson(`https://openlibrary.org${a.key}.json`).then((x) => x.name).catch(() => '')
    )
  );
  const cover = uitgave.covers?.find((c) => c > 0);
  return {
    werk: uitgave.works?.[0]?.key ?? '',
    titel: uitgave.subtitle && !/^roman$/i.test(uitgave.subtitle) ? `${uitgave.title}: ${uitgave.subtitle}` : uitgave.title,
    auteurs: namen.filter(Boolean),
    coverUrl: cover ? `https://covers.openlibrary.org/b/id/${cover}-M.jpg` : '',
    uitgever: uitgave.publishers?.[0] ?? '',
    jaar: Number(String(uitgave.publish_date ?? '').match(/\d{4}/)?.[0]) || null,
    paginas: uitgave.number_of_pages ?? null,
    taal: { '/languages/dut': 'nl', '/languages/eng': 'en' }[uitgave.languages?.[0]?.key] ?? '',
  };
}

// Een boek opzoeken met een gescand of getypt ISBN. Geeft null als geen bron het kent.
export async function zoekOpIsbn(isbn) {
  const pogingen = await Promise.allSettled([zoekOpenLibrary({ isbn }, 1), zoekGoogleBooks(`isbn:${isbn}`, false, 3)]);
  const [ol, gb] = pogingen.map((p) => p.value ?? []);
  let beste = gb[0] ?? ol[0];
  let ander = gb[0] ? ol[0] : null;
  if (!beste) {
    // Tweede kans bij Open Library, per uitgave.
    try {
      beste = await openLibraryUitgave(isbn);
    } catch {
      beste = null;
    }
  }
  if (!beste?.titel) {
    if (pogingen.every((p) => p.status === 'rejected')) throw new TijdelijkeFout('Geen verbinding');
    if (pogingen[1].status === 'rejected') throw new GoogleWeigert('Google Books antwoordt niet');
    return null;
  }
  if (ander) {
    for (const veld of ['werk', 'coverUrl', 'uitgever', 'jaar', 'paginas', 'taal', 'synopsis']) {
      if (!beste[veld] && ander[veld]) beste[veld] = ander[veld];
    }
  }
  return { ...beste, isbn };
}

// Voor de test in Instellingen: antwoordt elke bron?
export async function testBronnen() {
  const proef = async (url) => {
    try {
      await haalJson(url);
      return { ok: true };
    } catch (fout) {
      return { ok: false, status: fout.status ?? 0 };
    }
  };
  const [openLibrary, google] = await Promise.all([
    proef('https://openlibrary.org/search.json?q=harry+potter&limit=1&fields=key'),
    proef(googleUrl('isbn:9789025444112', '&maxResults=1')),
  ]);
  return { openLibrary, google };
}

// Zoekt de gegevens bij een boek waarvan titel en auteur bekend zijn (bijvoorbeeld uit
// de Excel-lijst). Alleen een resultaat dat echt hetzelfde boek is, telt; Nederlandse
// uitgaven eerst. Geeft null als niets past, en een fout als geen bron bereikbaar is.
export async function zoekBijpassend(boek) {
  const auteur = boek.auteurs?.[0]?.split('&')[0].trim() ?? '';
  const pogingen = await Promise.allSettled([
    zoekOpenLibrary({ titel: boek.titel, auteur }, 5),
    zoekGoogleBooks(`intitle:${boek.titel}${auteur ? ` inauthor:${auteur}` : ''}`, false, 5),
  ]);
  if (pogingen.every((p) => p.status === 'rejected')) throw new TijdelijkeFout('Geen verbinding');
  const passend = pogingen.flatMap((p) => p.value ?? []).filter((k) => vindDubbel(boek, [k]));
  passend.sort((a, b) => (b.taal === 'nl') - (a.taal === 'nl') || Boolean(b.coverUrl) - Boolean(a.coverUrl));
  // Weigerde een bron (bijvoorbeeld Google bij de daglimiet) en hebben we nog geen
  // cover, dan later opnieuw proberen in plaats van 'niets gevonden' te concluderen.
  if (pogingen.some((p) => p.status === 'rejected') && !passend.some((k) => k.coverUrl)) {
    throw new TijdelijkeFout('Bron tijdelijk niet beschikbaar');
  }
  const beste = passend[0];
  if (!beste) return null;
  // Ontbrekende gegevens aanvullen uit de andere passende resultaten.
  for (const ander of passend.slice(1)) {
    for (const veld of ['isbn', 'werk', 'coverUrl', 'uitgever', 'jaar', 'paginas', 'taal', 'synopsis']) {
      if (!beste[veld] && ander[veld]) beste[veld] = ander[veld];
    }
  }
  return beste;
}

// Zoekt bij Open Library bij welk 'werk' een ISBN hoort. Alle vertalingen van
// een boek hangen aan hetzelfde werk. Geeft '' als het niet gevonden wordt.
export async function zoekWerk(isbn) {
  if (!isbn) return '';
  try {
    const data = await haalJson(`https://openlibrary.org/search.json?isbn=${encodeURIComponent(isbn)}&fields=key&limit=1`);
    return data.docs?.[0]?.key ?? '';
  } catch {
    return '';
  }
}

// Haal een plaatje op als bestand, zodat het ook offline zichtbaar blijft.
// Lukt dat niet (Google Books staat het niet toe), dan bewaren we alleen het adres.
async function haalPlaatje(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    // Een piepklein plaatje is een lege plek, geen cover.
    if (blob.size < 1000 || !blob.type.startsWith('image/')) return null;
    return blob;
  } catch {
    return null;
  }
}

async function googleCoverUrl(zoekvraag) {
  try {
    const data = await haalJson(
      googleUrl(zoekvraag, '&maxResults=5')
    );
    const met = (data.items ?? []).find((i) => i.volumeInfo?.imageLinks);
    const links = met?.volumeInfo.imageLinks;
    return (links?.thumbnail || links?.smallThumbnail || '').replace('http://', 'https://');
  } catch {
    return '';
  }
}

// Zoekt een cover in een vaste volgorde: het gevonden plaatje, Open Library via ISBN,
// Google Books via ISBN, en tot slot Google Books via titel en auteur.
// 'opTitel: false' slaat de laatste stap over, als daar net al op gezocht is.
export async function zoekCover(boek, { opTitel = true } = {}) {
  const kandidaten = [
    () => boek.coverUrl,
    () => boek.isbn && `https://covers.openlibrary.org/b/isbn/${boek.isbn}-M.jpg?default=false`,
    () => boek.isbn && googleCoverUrl(`isbn:${boek.isbn}`),
    () => opTitel && googleCoverUrl(`intitle:${boek.titel}${boek.auteurs?.[0] ? ` inauthor:${boek.auteurs[0]}` : ''}`),
  ];
  let reserve = '';
  for (const kandidaat of kandidaten) {
    const url = await kandidaat();
    if (!url) continue;
    const blob = await haalPlaatje(url);
    if (blob) return { cover: blob, coverUrl: url };
    // Google-plaatjes kunnen we niet opslaan, maar wel tonen.
    if (!reserve && url.includes('books.google')) reserve = url;
  }
  return { cover: null, coverUrl: reserve };
}

// Alle covers die de bronnen van dit boek kennen, van verschillende uitgaven, om uit te kiezen.
export async function zoekCoverKeuzes(boek) {
  const auteur = boek.auteurs?.[0]?.split('&')[0].trim() ?? '';
  const vragen = [
    haalJson(googleUrl(`intitle:${boek.titel}${auteur ? ` inauthor:${auteur}` : ''}`, '&maxResults=20')).then((d) =>
      (d.items ?? [])
        .filter((i) => vindDubbel(boek, [{ titel: i.volumeInfo.title, auteurs: i.volumeInfo.authors ?? [] }]))
        .map((i) => i.volumeInfo.imageLinks?.thumbnail)
    ),
    boek.isbn
      ? haalJson(googleUrl(`isbn:${boek.isbn}`, '&maxResults=3')).then((d) => (d.items ?? []).map((i) => i.volumeInfo.imageLinks?.thumbnail))
      : [],
    zoekOpenLibrary({ titel: boek.titel, auteur }, 5).then((r) => r.filter((k) => vindDubbel(boek, [k])).map((k) => k.coverUrl)),
    // Bij Open Library hangen alle uitgaven (en hun covers) aan het werk.
    boek.werk
      ? haalJson(`https://openlibrary.org${boek.werk}/editions.json?limit=60`).then((d) =>
          (d.entries ?? []).flatMap((e) => (e.covers ?? []).filter((c) => c > 0).slice(0, 1)).map((c) => `https://covers.openlibrary.org/b/id/${c}-M.jpg`)
        )
      : [],
  ];
  const uitkomsten = await Promise.allSettled(vragen);
  const urls = uitkomsten.flatMap((u) => u.value ?? []).filter(Boolean).map((u) => u.replace('http://', 'https://'));
  // Google-plaatjes zonder randje (edge=curl) en zonder dubbelen.
  return [...new Set(urls.map((u) => u.replace('&edge=curl', '')))].slice(0, 30);
}

// Een gekozen cover bewaren: Open Library als bestand (ook offline zichtbaar),
// Google alleen als adres (Google staat opslaan niet toe).
export async function bewaarbareCover(url) {
  const blob = await haalPlaatje(url);
  return blob ? { cover: blob, coverUrl: url } : { cover: null, coverUrl: url };
}

// Verkleint een eigen foto tot een nette cover, zodat de opslag niet volloopt.
export async function verkleinFoto(bestand) {
  const bitmap = await createImageBitmap(bestand);
  const schaal = Math.min(1, 600 / bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * schaal);
  canvas.height = Math.round(bitmap.height * schaal);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((klaar) => canvas.toBlob(klaar, 'image/jpeg', 0.85));
}
