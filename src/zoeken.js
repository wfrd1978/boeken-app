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

async function zoekOpenLibrary(tekst) {
  const velden = 'key,title,author_name,isbn,cover_i,first_publish_year,number_of_pages_median';
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(tekst)}&limit=10&fields=${velden}`;
  const data = await haalJson(url);
  return (data.docs ?? []).map((d) => ({
    titel: d.title,
    auteurs: d.author_name ?? [],
    isbn: kiesIsbn(d.isbn),
    coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : '',
    jaar: d.first_publish_year ?? null,
    paginas: d.number_of_pages_median ?? null,
  }));
}

async function zoekGoogleBooks(tekst) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(tekst)}&maxResults=10`;
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

// Zoekt bij beide bronnen tegelijk en voegt de resultaten samen zonder dubbelingen.
export async function zoekBoeken(tekst) {
  const [ol, gb] = await Promise.allSettled([zoekOpenLibrary(tekst), zoekGoogleBooks(tekst)]);
  if (ol.status === 'rejected' && gb.status === 'rejected') {
    throw new Error('Geen verbinding met de boekenbronnen');
  }
  const gezien = new Set();
  const resultaten = [];
  for (const boek of [...(ol.value ?? []), ...(gb.value ?? [])]) {
    if (!boek.titel) continue;
    const k = sleutel(boek);
    if (gezien.has(k)) continue;
    gezien.add(k);
    resultaten.push(boek);
  }
  return resultaten.slice(0, 15);
}

// Haal de cover op als bestand, zodat hij ook offline zichtbaar blijft.
export async function haalCover(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    // Open Library geeft een piepklein plaatje terug als er geen cover is.
    if (blob.size < 1000 || !blob.type.startsWith('image/')) return null;
    return blob;
  } catch {
    return null;
  }
}
