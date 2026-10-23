// Op de achtergrond covers en gegevens ophalen voor geïmporteerde boeken.
// Titel en auteur uit de lijst blijven altijd zoals de gebruiker ze schreef.
import { db } from './db.js';
import { zoekBijpassend, zoekCover, zoekWerk } from './zoeken.js';

const AANVULLEN = ['isbn', 'werk', 'coverUrl', 'uitgever', 'jaar', 'paginas', 'taal'];
const PAUZE = 400;

let bezig = false;
let luisteraar = () => {};

export function opVoortgang(functie) {
  luisteraar = functie;
}

const wacht = (ms) => new Promise((klaar) => setTimeout(klaar, ms));

export async function verrijkAlles() {
  if (bezig) return;
  bezig = true;
  try {
    const open = await db.boeken.filter((b) => b.verrijkt === false).toArray();
    let klaar = 0;
    for (const boek of open) {
      if (!navigator.onLine) break;
      let gevonden;
      try {
        gevonden = await zoekBijpassend(boek);
      } catch {
        // Geen verbinding: stoppen en de volgende keer verder.
        break;
      }
      const actueel = await db.boeken.get(boek.id);
      if (!actueel) continue;
      // Alleen lege velden aanvullen; wat al is ingevuld blijft staan.
      const aanvulling = {};
      for (const veld of AANVULLEN) {
        if (!actueel[veld] && gevonden?.[veld]) aanvulling[veld] = gevonden[veld];
      }
      if (!actueel.cover) {
        const cover = await zoekCover({ ...actueel, ...aanvulling });
        if (cover.cover) aanvulling.cover = cover.cover;
        if (cover.coverUrl) aanvulling.coverUrl = cover.coverUrl;
      }
      const isbn = aanvulling.isbn || actueel.isbn;
      if (!actueel.werk && !aanvulling.werk && isbn) aanvulling.werk = await zoekWerk(isbn);
      await db.boeken.update(boek.id, { ...aanvulling, werk: aanvulling.werk || actueel.werk || '', verrijkt: true });
      klaar += 1;
      luisteraar({ klaar, totaal: open.length });
      await wacht(PAUZE);
    }
    luisteraar({ klaar, totaal: open.length, gestopt: klaar < open.length });
  } finally {
    bezig = false;
  }
}

export async function aantalTeVerrijken() {
  return db.boeken.filter((b) => b.verrijkt === false).count();
}
