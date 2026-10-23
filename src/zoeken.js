// Boekgegevens ophalen bij Open Library en Google Books (gratis, geen sleutel).

const WACHTTIJD = 10000;

async function haalJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), WACHTTIJD);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
async function zoekOpenLibrary(tekst) {
  const velden = [
    'key,title,author_name,isbn,cover_i,first_publish_year,number_of_pages_median,language',
    'editions,editions.title,editions.isbn,editions.cover_i,editions.language,editions.publisher',
  ].join(',');
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(tekst)}&lang=nl&limit=10&fields=${velden}`;
  const data = await haalJson(url);
  return (data.docs ?? []).map((d) => {
    const uitgave = d.editions?.docs?.[0] ?? {};
    const cover = uitgave.cover_i || d.cover_i;
    const talen = uitgave.language ?? (d.language?.length === 1 ? d.language : []);
    return {
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

async function zoekGoogleBooks(tekst, alleenNederlands = false) {
  const taal = alleenNederlands ? '&langRestrict=nl' : '';
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(tekst)}&maxResults=10${taal}`;
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
    };
  });
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
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(zoekvraag)}&maxResults=5`
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
export async function zoekCover(boek) {
  const kandidaten = [
    () => boek.coverUrl,
    () => boek.isbn && `https://covers.openlibrary.org/b/isbn/${boek.isbn}-M.jpg?default=false`,
    () => boek.isbn && googleCoverUrl(`isbn:${boek.isbn}`),
    () => googleCoverUrl(`intitle:${boek.titel}${boek.auteurs?.[0] ? ` inauthor:${boek.auteurs[0]}` : ''}`),
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
