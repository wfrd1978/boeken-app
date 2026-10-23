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

export function boekToevoegen(boek) {
  return db.boeken.add({
    titel: boek.titel,
    auteurs: boek.auteurs ?? [],
    isbn: boek.isbn ?? '',
    cover: boek.cover ?? null,
    coverUrl: boek.coverUrl ?? '',
    uitgever: boek.uitgever ?? '',
    jaar: boek.jaar ?? null,
    paginas: boek.paginas ?? null,
    taal: boek.taal ?? '',
    status: boek.status ?? 'Wil ik lezen',
    sterren: null,
    leesdata: [],
    recensie: '',
    toegevoegdOp: new Date().toISOString(),
    bron: boek.bron ?? 'getypt',
  });
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
