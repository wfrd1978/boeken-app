// Over de schrijver (Wikipedia: korte tekst en foto) en verfilmingen (Wikidata: films en
// series die op een boek zijn gebaseerd). Gratis en zonder sleutel. Alleen de naam van de
// schrijver gaat naar Wikipedia en Wikidata; per schrijver een maand op de telefoon bewaard.
import { db } from './db.js';
import { kaal, titelKern as kern } from './dubbel.js';
import { veiligeUrl } from './veilig.js';

const BEWAARDAGEN = 30;
// Hoger zetten als de opgeslagen gegevens anders worden: dan wordt alles opnieuw opgehaald.
const VERSIE = 3;
// Lukte het ophalen (deels) niet, bijvoorbeeld door een trage verbinding: na een uur opnieuw.
const OPNIEUW_NA = 3600000;
// Korter dan dit (vaak één zin): dan de eerste drie zinnen van het artikel erbij halen.
const KORT = 220;
const WACHTTIJD = 20000;

// Is dit een pagina over een schrijver? Anders liever niets dan de verkeerde persoon.
const SCHRIJVERWOORDEN = /schrijver|schrijfster|auteur|romancier|journalist|columnist|dichter|biograaf|writer|novelist|author|journalist/i;

async function haal(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), WACHTTIJD);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    // Niet gevonden is een antwoord; elke andere fout (te druk, storing) telt als 'mislukt'.
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`fout ${res.status}`);
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

// De eerste zinnen van een artikel (de samenvatting is soms maar één zin).
async function eersteZinnen(titel, taal) {
  const d = await haal(
    `https://${taal}.wikipedia.org/w/api.php?action=query&prop=extracts&exsentences=3&explaintext=1&redirects=1&format=json&origin=*&titles=${encodeURIComponent(titel)}`
  ).catch(() => null);
  const pagina = Object.values(d?.query?.pages ?? {})[0];
  return zinnenUitExtract(pagina?.extract);
}

// Platte tekst van Wikipedia: kopjes ('Biografie', '== Leven ==') eruit, alinea's achter elkaar.
export function zinnenUitExtract(tekst) {
  if (typeof tekst !== 'string') return '';
  return tekst
    .split('\n')
    .map((r) => r.trim())
    .filter((r) => r && !/^=+.*=+$/.test(r) && /[.!?]["')]?$/.test(r))
    .join(' ')
    .trim();
}

// Geeft de info, null als Wikipedia geen schrijver met deze naam kent, of undefined als het
// ophalen mislukte (dan later opnieuw proberen).
async function wikipedia(naam) {
  const pad = encodeURIComponent(naam.trim().replace(/\s+/g, '_'));
  let mislukt = false;
  for (const taal of ['nl', 'en']) {
    let pagina;
    try {
      pagina = await haal(`https://${taal}.wikipedia.org/api/rest_v1/page/summary/${pad}`);
    } catch {
      mislukt = true;
      continue;
    }
    const info = wikiNaarInfo(pagina, taal);
    if (!info) continue;
    if (info.tekst.length < KORT) {
      const langer = await eersteZinnen(info.naam, taal);
      if (langer.length > info.tekst.length) info.tekst = langer;
    }
    return info;
  }
  return mislukt ? undefined : null;
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
  const houdbaar = bewaard?.onvolledig ? OPNIEUW_NA : BEWAARDAGEN * 86400000;
  if (bewaard?.v === VERSIE && Date.now() - Date.parse(bewaard.op) < houdbaar) return bewaard;
  if (!navigator.onLine) return bewaard ?? null;
  const [info, films] = await Promise.all([wikipedia(naam).catch(() => undefined), wikidata(naam).catch(() => null)]);
  const infoMislukt = info === undefined;
  const filmsMislukt = films === null;
  // Mislukt allebei (geen verbinding), dan niets bewaren: de volgende keer opnieuw proberen.
  if (infoMislukt && filmsMislukt && !bewaard) return null;
  const nieuw = {
    v: VERSIE,
    op: new Date().toISOString(),
    info: infoMislukt ? (bewaard?.info ?? null) : info,
    films: filmsMislukt ? (bewaard?.films ?? []) : films,
    onvolledig: infoMislukt || filmsMislukt,
  };
  // Opnieuw lezen vlak voor het schrijven (een ander boek kan intussen een schrijver hebben
  // bewaard), en wat ouder is dan de bewaartijd weggooien, zodat de lijst niet blijft groeien.
  const nu = (await db.instellingen.get('schrijvers'))?.waarde ?? {};
  for (const [k, v] of Object.entries(nu)) if (!(Date.now() - Date.parse(v?.op) < BEWAARDAGEN * 86400000)) delete nu[k];
  nu[sleutel] = nieuw;
  await db.instellingen.put({ sleutel: 'schrijvers', waarde: nu });
  return nieuw;
}
