// Over de schrijver (Wikipedia: korte tekst en foto) en verfilmingen (Wikidata: films en
// series die op een boek zijn gebaseerd). Gratis en zonder sleutel. Alleen de naam van de
// schrijver gaat naar Wikipedia en Wikidata; per schrijver een maand op de telefoon bewaard.
import { db } from './db.js';
import { kaal } from './dubbel.js';
import { veiligeUrl } from './veilig.js';

const BEWAARDAGEN = 30;
const WACHTTIJD = 12000;

// Is dit een pagina over een schrijver? Anders liever niets dan de verkeerde persoon.
const SCHRIJVERWOORDEN = /schrijver|schrijfster|auteur|romancier|journalist|columnist|dichter|biograaf|writer|novelist|author|journalist/i;

async function haal(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), WACHTTIJD);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export function wikiNaarInfo(d, taal) {
  if (!d || d.type === 'disambiguation' || typeof d.extract !== 'string' || !d.extract.trim()) return null;
  if (!SCHRIJVERWOORDEN.test(`${d.description ?? ''} ${d.extract}`)) return null;
  const pagina = veiligeUrl(d.content_urls?.mobile?.page || d.content_urls?.desktop?.page);
  return {
    naam: String(d.title ?? ''),
    tekst: d.extract.trim(),
    foto: veiligeUrl(d.thumbnail?.source)?.startsWith('https://') ? d.thumbnail.source : '',
    url: pagina?.startsWith('https://') ? pagina : '',
    taal,
  };
}

async function wikipedia(naam) {
  const pad = encodeURIComponent(naam.trim().replace(/\s+/g, '_'));
  for (const taal of ['nl', 'en']) {
    const info = wikiNaarInfo(await haal(`https://${taal}.wikipedia.org/api/rest_v1/page/summary/${pad}`).catch(() => null), taal);
    if (info) return info;
  }
  return null;
}

// Films en series op basis van werken van deze schrijver, met de titels van het boek (nl en en).
async function wikidata(naam) {
  const letterlijk = JSON.stringify(naam.trim());
  const vraag = `SELECT ?werkNl ?werkEn ?filmNl ?filmEn ?jaar ?serie WHERE {
  { ?a rdfs:label ${letterlijk}@en } UNION { ?a rdfs:label ${letterlijk}@nl }
  ?werk wdt:P50 ?a . ?film wdt:P144 ?werk .
  { ?film wdt:P31/wdt:P279* wd:Q11424 } UNION { ?film wdt:P31/wdt:P279* wd:Q5398426 } UNION { ?film wdt:P31 wd:Q3464665 . BIND(true AS ?serie) }
  OPTIONAL { ?werk rdfs:label ?werkNl FILTER(lang(?werkNl) = "nl") }
  OPTIONAL { ?werk rdfs:label ?werkEn FILTER(lang(?werkEn) = "en") }
  OPTIONAL { ?film rdfs:label ?filmNl FILTER(lang(?filmNl) = "nl") }
  OPTIONAL { ?film rdfs:label ?filmEn FILTER(lang(?filmEn) = "en") }
  OPTIONAL { ?film wdt:P577 ?d . BIND(YEAR(?d) AS ?jaar) }
  OPTIONAL { ?film wdt:P31 wd:Q5398426 . BIND(true AS ?serie) }
} LIMIT 200`;
  const d = await haal(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(vraag)}`);
  return Array.isArray(d?.results?.bindings) ? leesFilms(d.results.bindings) : null;
}

// Rijen van Wikidata samenvatten: per film of serie één regel, seizoenen samengevoegd.
export function leesFilms(rijen) {
  const w = (r, k) => (typeof r[k]?.value === 'string' ? r[k].value : '');
  const perTitel = new Map();
  for (const r of rijen) {
    const titel = (w(r, 'filmNl') || w(r, 'filmEn')).replace(/,?\s*(season|seizoen)\s*\d+$/i, '').trim();
    if (!titel) continue;
    const jaar = Number(w(r, 'jaar')) || null;
    const k = kaal(titel);
    const al = perTitel.get(k) ?? { titel, jaar, serie: false, werken: [] };
    if (jaar && (!al.jaar || jaar < al.jaar)) al.jaar = jaar;
    if (w(r, 'serie') === 'true' || /season|seizoen/i.test(w(r, 'filmEn'))) al.serie = true;
    for (const t of [w(r, 'werkNl'), w(r, 'werkEn')]) if (t && !al.werken.includes(t)) al.werken.push(t);
    perTitel.set(k, al);
  }
  return [...perTitel.values()];
}

function kern(tekst) {
  return kaal(tekst).replace(/^(de|het|een|the|a|an)\s+/, '').replace(/[^a-z0-9]/g, '');
}

// Verfilmingen van dit boek: het werk heeft dezelfde titel als het boek, of als een andere
// titel van hetzelfde deel in de reekslijst (zo vinden we ook de oorspronkelijke titel).
export function filmsVoorBoek(boek, films, extraTitels = []) {
  // Ook zonder ondertitel: "Pogingen iets van het leven te maken: Het geheime dagboek …".
  const varianten = (t) => [kern(t), kern(String(t).split(/[:(]/)[0])];
  const titels = new Set([boek.titel, ...extraTitels].flatMap(varianten).filter(Boolean));
  return films
    .filter((f) => f.werken.some((t) => varianten(t).some((v) => titels.has(v))))
    .sort((a, b) => (a.jaar ?? 9999) - (b.jaar ?? 9999));
}

// Info over de schrijver en zijn verfilmingen, uit de opslag of opnieuw opgehaald.
export async function schrijverGegevens(naam) {
  if (!naam) return null;
  const sleutel = kaal(naam).trim();
  const alle = (await db.instellingen.get('schrijvers'))?.waarde ?? {};
  const bewaard = alle[sleutel];
  if (bewaard && Date.now() - Date.parse(bewaard.op) < BEWAARDAGEN * 86400000) return bewaard;
  if (!navigator.onLine) return bewaard ?? null;
  const [info, films] = await Promise.all([wikipedia(naam).catch(() => null), wikidata(naam).catch(() => null)]);
  // Mislukt allebei (geen verbinding), dan niets bewaren: de volgende keer opnieuw proberen.
  if (info === null && films === null && !bewaard) return null;
  const nieuw = { op: new Date().toISOString(), info: info ?? bewaard?.info ?? null, films: films ?? bewaard?.films ?? [] };
  alle[sleutel] = nieuw;
  await db.instellingen.put({ sleutel: 'schrijvers', waarde: alle });
  return nieuw;
}
