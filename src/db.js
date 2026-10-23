import Dexie from 'dexie';

// Alle boeken staan in IndexedDB op het toestel zelf.
export const db = new Dexie('boeken');

db.version(1).stores({
  boeken: '++id, isbn, titel, toegevoegdOp, status',
});

export const STATUSSEN = ['Wil ik lezen', 'Bezig', 'Gelezen', 'Gestopt'];

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

// Oudere boeken krijgen op de achtergrond hun Open Library-werk erbij, zodat
// de dubbel-waarschuwing ook vertalingen herkent. Alleen dit ene veld wordt
// toegevoegd; de rest van het boek blijft onaangeroerd.
export async function vulWerkenAan(zoekWerk) {
  // Boeken die nog verrijkt worden, krijgen hun werk daar al.
  const zonder = await db.boeken.filter((b) => b.werk === undefined && b.verrijkt !== false).toArray();
  for (const boek of zonder) {
    const werk = boek.isbn ? await zoekWerk(boek.isbn) : '';
    await db.boeken.update(boek.id, { werk });
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
