import Dexie from 'dexie';
import { leesKoboOpmerking } from './kobo.js';

// Alle boeken staan in IndexedDB op het toestel zelf.
export const db = new Dexie('boeken');

db.version(1).stores({
  boeken: '++id, isbn, titel, toegevoegdOp, status',
});

// Versie 2: een vakje voor persoonlijke gegevens (profiel). De boeken blijven ongewijzigd.
db.version(2).stores({
  boeken: '++id, isbn, titel, toegevoegdOp, status',
  instellingen: 'sleutel',
});

export const STATUSSEN = ['Wil ik lezen', 'Bezig', 'Gelezen', 'Gestopt'];

// Zo heet een status in beeld. In de opslag blijft de oorspronkelijke naam staan,
// zodat bestaande boeken en backups gewoon blijven werken.
const STATUS_IN_BEELD = { Bezig: 'Aan het lezen' };

export function statusNaam(status) {
  return STATUS_IN_BEELD[status] ?? status;
}

// De gekozen indeling. Elk boek heeft er één (of nog geen).
export const CATEGORIEEN = [
  'Thriller & spanning',
  'Oorlog & geschiedenis',
  'Sport',
  'Biografie & levensverhaal',
  'Journalistiek & samenleving',
  'Roman & humor',
  'Geloof & zingeving',
  'Overig',
];

// Vraag de browser om de opslag niet zomaar op te ruimen.
export async function vraagBlijvendeOpslag() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // Niet elke browser ondersteunt dit; de app werkt ook zonder.
  }
}

export function alleBoeken() {
  return db.boeken.orderBy('toegevoegdOp').reverse().toArray();
}

const DATUM = /^\d{4}-\d{2}(-\d{2})?$/;

// '2025-10' of '2025-10-14', en een datum die echt bestaat (geen 31 februari).
export function echteDatum(d) {
  if (typeof d !== 'string' || !DATUM.test(d)) return false;
  const [j, m, dag = '1'] = d.split('-').map(Number);
  const datum = new Date(j, m - 1, dag);
  return datum.getFullYear() === j && datum.getMonth() === m - 1 && datum.getDate() === Number(dag);
}

// Controleert een boek uit een backup en zet het in de vaste vorm. Onbekende velden
// vallen weg, verkeerde soorten gegevens worden leeg. Zonder titel: een fout.
export function normaliseerBoek(b) {
  if (!b || typeof b !== 'object') throw new Error('Ongeldig boek in de backup.');
  const titel = typeof b.titel === 'string' ? b.titel.trim() : '';
  if (!titel) throw new Error('Er staat een boek zonder titel in de backup.');
  const tekst = (v) => (typeof v === 'string' ? v : '');
  const getal = (v, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : null);
  return {
    ...(Number.isInteger(b.id) && b.id > 0 ? { id: b.id } : {}),
    titel,
    auteurs: Array.isArray(b.auteurs) ? b.auteurs.filter((a) => typeof a === 'string' && a.trim()) : [],
    isbn: tekst(b.isbn).replace(/[^0-9X]/gi, ''),
    // Alleen een echt Open Library-werk ('/works/OL123W'); al het andere wordt opnieuw opgezocht.
    werk: typeof b.werk === 'string' && /^(\/works\/OL\d+W)?$/.test(b.werk) ? b.werk : undefined,
    cover: b.cover instanceof Blob ? b.cover : null,
    coverUrl: tekst(b.coverUrl),
    uitgever: tekst(b.uitgever),
    jaar: getal(b.jaar, 0, 3000),
    paginas: getal(b.paginas, 1, 50000),
    taal: tekst(b.taal),
    status: STATUSSEN.includes(b.status) ? b.status : 'Wil ik lezen',
    sterren: getal(b.sterren, 1, 5),
    leesdata: Array.isArray(b.leesdata) ? b.leesdata.filter(echteDatum) : [],
    recensie: tekst(b.recensie),
    opmerking: tekst(b.opmerking),
    koboWacht: b.koboWacht === true,
    koboGedownload: b.koboGedownload === true,
    papierGekocht: b.papierGekocht === true,
    categorie: CATEGORIEEN.includes(b.categorie) ? b.categorie : '',
    synopsis: typeof b.synopsis === 'string' ? b.synopsis : undefined,
    toegevoegdOp: typeof b.toegevoegdOp === 'string' && !isNaN(Date.parse(b.toegevoegdOp)) ? b.toegevoegdOp : new Date().toISOString(),
    bron: tekst(b.bron) || 'backup',
    verrijkt: b.verrijkt !== false,
  };
}

// Een compleet boek met alle velden, zodat elk boek dezelfde vorm heeft.
function nieuwBoek(boek, toegevoegdOp = new Date().toISOString()) {
  return {
    titel: boek.titel,
    auteurs: boek.auteurs ?? [],
    isbn: boek.isbn ?? '',
    // Onbekend werk leeg laten (undefined), dan vult de app het later aan.
    werk: boek.werk || undefined,
    cover: boek.cover ?? null,
    coverUrl: boek.coverUrl ?? '',
    uitgever: boek.uitgever ?? '',
    jaar: boek.jaar ?? null,
    paginas: boek.paginas ?? null,
    taal: boek.taal ?? '',
    status: boek.status ?? 'Wil ik lezen',
    sterren: boek.sterren ?? null,
    leesdata: boek.leesdata ?? [],
    recensie: boek.recensie ?? '',
    opmerking: boek.opmerking ?? '',
    // Leeg laten (undefined) als we hem nog niet hebben, dan haalt de app hem later op.
    synopsis: boek.synopsis || undefined,
    koboWacht: boek.koboWacht ?? false,
    koboGedownload: boek.koboGedownload ?? false,
    papierGekocht: boek.papierGekocht ?? false,
    categorie: boek.categorie ?? '',
    toegevoegdOp,
    bron: boek.bron ?? 'getypt',
    // false = cover en gegevens moeten nog op de achtergrond worden opgehaald.
    verrijkt: boek.verrijkt ?? true,
  };
}

export function boekToevoegen(boek) {
  return db.boeken.add(nieuwBoek(boek));
}

// Alle boeken uit een import in één keer: lukt het niet, dan wordt er niets toegevoegd.
// Elk boek krijgt een eigen tijdstip, zodat de volgorde van het bestand bewaard blijft.
export function boekenImporteren(boeken) {
  const nu = Date.now();
  return db.boeken.bulkAdd(
    boeken.map((b, i) => nieuwBoek({ ...b, verrijkt: false }, new Date(nu - i).toISOString()))
  );
}

// Sterren of categorie aanvullen bij bestaande boeken, allemaal tegelijk: lukt het niet,
// dan verandert er niets. Alleen lege velden worden gevuld, ook als er intussen iets veranderde.
export function boekenAanvullen(lijst) {
  return db.transaction('rw', db.boeken, () =>
    Promise.all(
      lijst.map(({ id, wijzigingen }) =>
        db.boeken.where('id').equals(id).modify((b) => {
          for (const [veld, waarde] of Object.entries(wijzigingen)) if (!b[veld]) b[veld] = waarde;
        })
      )
    )
  );
}

// Oudere boeken krijgen op de achtergrond hun Open Library-werk erbij, zodat
// de dubbel-waarschuwing ook vertalingen herkent. Alleen dit ene veld wordt
// toegevoegd; de rest van het boek blijft onaangeroerd.
export async function vulWerkenAan(zoekWerk) {
  // Boeken die nog verrijkt worden, krijgen hun werk daar al.
  const zonder = await db.boeken.filter((b) => b.werk === undefined && b.verrijkt !== false).toArray();
  for (const boek of zonder) {
    if (!navigator.onLine) return;
    const werk = boek.isbn ? await zoekWerk(boek.isbn) : '';
    // null = opzoeken lukte niet (bijvoorbeeld geen internet): later opnieuw.
    if (werk === null) continue;
    // Alleen als het nog hetzelfde boek is (na een teruggezette backup kan een id een ander boek zijn).
    await db.boeken.where('id').equals(boek.id).modify((b) => {
      if (b.werk === undefined && b.titel === boek.titel && b.toegevoegdOp === boek.toegevoegdOp) b.werk = werk;
    });
  }
}

// Boeken die al geïmporteerd waren met "Kobo Plus: ja/nee" in de opmerking krijgen
// het label 'Wacht op Kobo Plus'; die tekst verdwijnt dan uit de opmerking.
export async function zetKoboOm() {
  const kandidaten = await db.boeken.filter((b) => /kobo plus:/i.test(b.opmerking || '')).toArray();
  for (const boek of kandidaten) {
    const kobo = leesKoboOpmerking(boek.opmerking);
    if (kobo) await db.boeken.update(boek.id, kobo);
  }
}

export function haalBoek(id) {
  return db.boeken.get(id);
}

export function boekBijwerken(id, wijzigingen) {
  return db.boeken.update(id, wijzigingen);
}

export function boekVerwijderen(id) {
  return db.boeken.delete(id);
}

// Voor 'Ongedaan maken': zet een verwijderd boek precies terug, met hetzelfde id.
export function boekTerugzetten(boek) {
  return db.boeken.put(boek);
}

// --- Profiel ---

export async function haalProfiel() {
  return (await db.instellingen.get('profiel'))?.waarde ?? { naam: '', overMij: '', lezersprofiel: '' };
}

export async function bewaarProfiel(profiel) {
  await db.instellingen.put({ sleutel: 'profiel', waarde: profiel });
}

// Profielfoto apart bewaard (een plaatje), zodat het profiel zelf gewone tekst blijft.
export async function haalProfielFoto() {
  const foto = (await db.instellingen.get('profielFoto'))?.waarde;
  return foto instanceof Blob ? foto : null;
}

export async function bewaarProfielFoto(foto) {
  if (foto) await db.instellingen.put({ sleutel: 'profielFoto', waarde: foto });
  else await db.instellingen.delete('profielFoto');
}
