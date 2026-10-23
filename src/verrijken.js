// Op de achtergrond covers en gegevens ophalen voor geïmporteerde boeken.
// Titel en auteur uit de lijst blijven altijd zoals de gebruiker ze schreef.
import { db } from './db.js';
import { zoekBijpassend, zoekCover, zoekWerk, zoekSynopsis, TijdelijkeFout } from './zoeken.js';

const AANVULLEN = ['isbn', 'werk', 'coverUrl', 'uitgever', 'jaar', 'paginas', 'taal', 'synopsis'];
// Rustig tempo: Google heeft naast een daglimiet ook een limiet per minuut.
const PAUZE = 1500;
// Weigert een bron, dan steeds langer wachten (20 s, 40 s, 80 s, 160 s) en het
// hetzelfde boek opnieuw proberen; pas daarna pauzeren tot de volgende keer.
const WACHTTIJDEN = [20000, 40000, 80000, 160000];

// Probeert 'taak' opnieuw bij een tijdelijke weigering. Geeft null terug als het
// na alle wachttijden nog niet lukt (dan pauzeren).
async function metGeduld(taak, soort, stand) {
  for (let poging = 0; ; poging += 1) {
    try {
      return { uitkomst: await taak() };
    } catch (fout) {
      if (!(fout instanceof TijdelijkeFout) || poging >= WACHTTIJDEN.length) {
        stand.laatsteFout = fout.status ?? 0;
        return null;
      }
      stand.laatsteFout = fout.status ?? 0;
      luisteraar({ soort, ...stand, wacht: WACHTTIJDEN[poging] / 1000 });
      await wacht(WACHTTIJDEN[poging]);
    }
  }
}

let bezig = false;
let nogEenRonde = false;
let luisteraar = () => {};

export function opVoortgang(functie) {
  luisteraar = functie;
}

const wacht = (ms) => new Promise((klaar) => setTimeout(klaar, ms));

// Werkt de wachtrij af. Komen er tijdens het werk nieuwe boeken bij (bijvoorbeeld via
// 'Zoek opnieuw naar ontbrekende covers'), dan gaat hij daar meteen mee verder.
export async function verrijkAlles() {
  if (bezig) {
    nogEenRonde = true;
    return;
  }
  bezig = true;
  const geprobeerd = new Set();
  let klaar = 0;
  let totaal = 0;
  let gestopt = false;
  let laatsteFout = 0;
  try {
    do {
      nogEenRonde = false;
      const open = await db.boeken.filter((b) => b.verrijkt === false && !geprobeerd.has(b.id)).toArray();
      totaal += open.length;
      for (const boek of open) {
        geprobeerd.add(boek.id);
        if (!navigator.onLine) {
          gestopt = true;
          break;
        }
        const stand = { klaar, totaal };
        const poging = await metGeduld(() => zoekBijpassend(boek), 'covers', stand);
        if (!poging) {
          gestopt = true;
          laatsteFout = stand.laatsteFout;
          break;
        }
        const gevonden = poging.uitkomst;
        const actueel = await db.boeken.get(boek.id);
        if (!actueel) continue;
        // Alleen lege velden aanvullen; wat al is ingevuld blijft staan.
        const aanvulling = {};
        for (const veld of AANVULLEN) {
          if (!actueel[veld] && gevonden?.[veld]) aanvulling[veld] = gevonden[veld];
        }
        if (!actueel.cover) {
          const cover = await zoekCover({ ...actueel, ...aanvulling }, { opTitel: false });
          if (cover.cover) aanvulling.cover = cover.cover;
          if (cover.coverUrl) aanvulling.coverUrl = cover.coverUrl;
        }
        const isbn = aanvulling.isbn || actueel.isbn;
        if (!actueel.werk && !aanvulling.werk && isbn) aanvulling.werk = await zoekWerk(isbn);
        await db.boeken.update(boek.id, { ...aanvulling, werk: aanvulling.werk || actueel.werk || '', verrijkt: true });
        klaar += 1;
        luisteraar({ klaar, totaal });
        await wacht(PAUZE);
      }
    } while (nogEenRonde && !gestopt);
    luisteraar({ klaar, totaal, gestopt: gestopt || klaar < totaal, laatsteFout });
  } finally {
    bezig = false;
  }
  // Daarna de synopsis bij boeken die er nog geen hebben.
  vulSynopsisAan();
}

// --- Synopsis ---

let synopsisBezig = false;

// Boeken zonder synopsis-veld (undefined) krijgen er een, of '' als niemand er een heeft.
// Een synopsis die al bestaat, wordt nooit overschreven.
export async function vulSynopsisAan() {
  if (synopsisBezig || bezig) return;
  synopsisBezig = true;
  try {
    const zonder = await db.boeken.filter((b) => b.synopsis === undefined).toArray();
    let klaar = 0;
    let gestopt = false;
    let laatsteFout = 0;
    for (const boek of zonder) {
      if (!navigator.onLine) {
        gestopt = true;
        break;
      }
      const stand = { klaar, totaal: zonder.length };
      const poging = await metGeduld(() => zoekSynopsis(boek), 'synopsis', stand);
      if (!poging) {
        gestopt = true;
        laatsteFout = stand.laatsteFout;
        break;
      }
      const synopsis = poging.uitkomst;
      const actueel = await db.boeken.get(boek.id);
      if (actueel && actueel.synopsis === undefined) await db.boeken.update(boek.id, { synopsis });
      klaar += 1;
      luisteraar({ soort: 'synopsis', klaar, totaal: zonder.length });
      await wacht(PAUZE);
    }
    if (zonder.length) luisteraar({ soort: 'synopsis', klaar, totaal: zonder.length, gestopt: gestopt || klaar < zonder.length, laatsteFout });
  } finally {
    synopsisBezig = false;
  }
}

export async function synopsisTelling() {
  const alle = await db.boeken.toArray();
  return { totaal: alle.length, met: alle.filter((b) => b.synopsis).length, open: alle.filter((b) => b.synopsis === undefined).length };
}

// Boeken zonder cover opnieuw in de wachtrij zetten (knop in Instellingen).
export async function zonderCoverOpnieuw() {
  const zonder = await db.boeken.filter((b) => !b.cover && !b.coverUrl).primaryKeys();
  await db.boeken.where('id').anyOf(zonder).modify({ verrijkt: false });
  verrijkAlles();
  return zonder.length;
}

export async function coverTelling() {
  const alle = await db.boeken.toArray();
  return { totaal: alle.length, met: alle.filter((b) => b.cover || b.coverUrl).length };
}

export async function aantalTeVerrijken() {
  return db.boeken.filter((b) => b.verrijkt === false).count();
}
