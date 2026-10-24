// De Koninklijke Bibliotheek (data.bibliotheken.nl): open en gratis, en kent bijna elk
// Nederlands boek, ook nieuwe. Reserve als Google Books uitvalt en Open Library het boek niet kent.
// Geen covers; die komen van de andere bronnen.

const KB = 'https://data.bibliotheken.nl/sparql';
const WACHTTIJD = 10000;

const KLEINE_WOORDEN = new Set(['van', 'de', 'der', 'den', 'het', 'ten', 'ter', 'te', 'in', 'op', 'von', "'t"]);

// "frits spits" -> "Frits Spits", "michel van egmond" -> "Michel van Egmond".
function alsNaam(tekst) {
  return tekst
    .split(/\s+/)
    .map((w, i, alle) => (i > 0 && i < alle.length - 1 && KLEINE_WOORDEN.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join(' ');
}

function alsTitel(tekst) {
  return tekst.charAt(0).toUpperCase() + tekst.slice(1);
}

// De KB zoekt alleen op precies dezelfde titel of naam. Daarom maken we van de zoektekst een
// paar mogelijke titels en schrijvers: alles als titel, en de eerste of laatste woorden als naam.
export function kandidaten(tekst) {
  const schoon = tekst.trim().replace(/\s+/g, ' ');
  const woorden = schoon.split(' ');
  const titels = new Set([schoon, alsTitel(schoon), alsTitel(schoon.toLowerCase())]);
  const namen = new Set([alsNaam(schoon)]);
  for (let i = 1; i < woorden.length && i <= 4; i += 1) {
    const voor = woorden.slice(0, i).join(' ');
    const achter = woorden.slice(i).join(' ');
    namen.add(alsNaam(voor));
    titels.add(alsTitel(achter));
    titels.add(alsTitel(woorden.slice(0, woorden.length - i).join(' ')));
    namen.add(alsNaam(woorden.slice(woorden.length - i).join(' ')));
  }
  return { titels: [...titels].filter((t) => t.length > 1), namen: [...namen].filter((n) => n.includes(' ')) };
}

// Tekst veilig in een zoekvraag zetten.
function letterlijk(tekst) {
  return `"${tekst.replace(/["\\\n\r]/g, ' ')}"`;
}

function vraag(kern) {
  return `PREFIX schema: <http://schema.org/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT ?boek (SAMPLE(?t) AS ?titel) (SAMPLE(?l) AS ?label) (SAMPLE(?i) AS ?isbn) (SAMPLE(?p) AS ?paginas)
       (SAMPLE(?u) AS ?uitgever) (SAMPLE(?j) AS ?jaar) (SAMPLE(?an) AS ?auteur) WHERE {
  ${kern}
  ?boek schema:name ?t .
  OPTIONAL { ?boek rdfs:label ?l }
  OPTIONAL { ?boek schema:isbn ?i }
  OPTIONAL { ?boek schema:numberOfPages ?p }
  OPTIONAL { ?boek <http://purl.org/dc/terms#issued> ?j }
  OPTIONAL { ?boek schema:author ?aa . ?aa schema:name ?an }
  OPTIONAL { ?boek schema:publication ?pub . ?pub schema:publishedBy ?org . ?org schema:name ?u }
} GROUP BY ?boek LIMIT 60`;
}

async function vraagKB(kern) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), WACHTTIJD);
  try {
    const res = await fetch(`${KB}?query=${encodeURIComponent(vraag(kern))}&format=json`, { signal: ctrl.signal });
    if (!res.ok) throw Object.assign(new Error(`KB ${res.status}`), { status: res.status });
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } finally {
    clearTimeout(timer);
  }
}

// "President vermist / Bill Clinton & James Patterson ; vertaald ..." -> ["Bill Clinton", "James Patterson"]
function auteursUitLabel(label) {
  const deel = String(label ?? '').split(' / ')[1]?.split(' ; ')[0];
  return deel ? deel.split(/\s*(?:&|,|\sen\s)\s*/).map((a) => a.trim()).filter(Boolean) : [];
}

export function kbNaarBoek(r) {
  const getal = (v, min, max) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
  };
  const auteurs = auteursUitLabel(r.label);
  return {
    titel: String(r.titel ?? '').replace(/\s+:\s+/g, ': ').trim(),
    auteurs: auteurs.length ? auteurs : r.auteur ? [String(r.auteur)] : [],
    isbn: String(r.isbn ?? '').replace(/[^0-9X]/gi, ''),
    coverUrl: '',
    uitgever: String(r.uitgever ?? '').replace(/^Uitgeverij\s+/i, ''),
    jaar: getal(r.jaar, 1000, 3000),
    // Soms staat hier de bestandsgrootte van een e-book in plaats van het aantal bladzijden.
    paginas: getal(r.paginas, 10, 3000),
    taal: 'nl',
  };
}

export async function kbOpIsbn(isbn) {
  const rijen = await vraagKB(`?boek schema:isbn ${letterlijk(isbn)} .`);
  const boek = rijen.map(kbNaarBoek).find((b) => b.titel);
  return boek ? { ...boek, isbn } : null;
}

export async function kbZoek(tekst) {
  const { titels, namen } = kandidaten(tekst);
  const delen = [`{ VALUES ?zoek { ${titels.map(letterlijk).join(' ')} } ?boek schema:name ?zoek . }`];
  if (namen.length) delen.push(`{ VALUES ?naam { ${namen.map(letterlijk).join(' ')} } ?a schema:name ?naam . ?boek schema:author ?a . }`);
  const rijen = await vraagKB(delen.join(' UNION '));
  return rijen.map(kbNaarBoek).filter((b) => b.titel);
}
