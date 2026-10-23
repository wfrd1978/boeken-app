// Op de achtergrond covers en gegevens ophalen voor geïmporteerde boeken.
// Titel en auteur uit de lijst blijven altijd zoals de gebruiker ze schreef.
import { db } from './db.js';
import { zoekBijpassend, zoekCover, zoekWerk, zoekSynopsis, TijdelijkeFout, googleStand } from './zoeken.js';

const AANVULLEN = ['isbn', 'werk', 'coverUrl', 'uitgever', 'jaar', 'paginas', 'taal', 'synopsis'];
// Rustig tempo: Google heeft naast een daglimiet ook een limiet per minuut.
const PAUZE = 1500;
// 'Te veel vragen' (429): steeds langer wachten (20 s, 40 s, 80 s, 160 s) en hetzelfde
// boek opnieuw proberen. Een storing (503) of geen verbinding: na 3 seconden nog één
// keer proberen, en anders dit boek voorlopig overslaan; het komt later terug.
const WACHTTIJDEN = [20000, 40000, 80000, 160000];
const MAX_OVERGESLAGEN_OP_RIJ = 8;

// Geeft { uitkomst }, of { overslaan: true }, of null (pauzeren tot de volgende keer).
async function metGeduld(taak, soort, stand) {
  let storingen = 0;
  for (let poging = 0; ; poging += 1) {
    try {
      return { uitkomst: await taak() };
    } catch (fout) {
      stand.laatsteFout = fout.status ?? 0;
      // Daglimiet van Google: vandaag niet meer proberen.
      if (fout.daglimiet || !googleStand().achtergrondMag) {
        stand.googleOp = true;
        return null;
      }
      if (!(fout instanceof TijdelijkeFout)) return null;
      if (fout.status === 429) {
        if (poging >= WACHTTIJDEN.length) return null;
        luisteraar({ soort, ...stand, wacht: WACHTTIJDEN[poging] / 1000 });
        await wacht(WACHTTIJDEN[poging]);
      } else {
        storingen += 1;
        if (storingen > 1) return { overslaan: true };
        await wacht(3000);
      }
    }
  }
}

let bezig = false;
let nogEenRonde = false;

// Verhoogd bij het terugzetten van een backup: lopend werk hoort dan bij een oude lijst en stopt.
let generatie = 0;
export function stopAchtergrond() {
  generatie += 1;
}
let luisteraar = () => {};

export function opVoortgang(functie) {
  luisteraar = functie;
}

const wacht = (ms) => new Promise((klaar) => setTimeout(klaar, ms));

function schud(lijst) {
  for (let i = lijst.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [lijst[i], lijst[j]] = [lijst[j], lijst[i]];
  }
  return lijst;
}

// Werkt de wachtrij af. Komen er tijdens het werk nieuwe boeken bij (bijvoorbeeld via
// 'Zoek opnieuw naar ontbrekende covers'), dan gaat hij daar meteen mee verder.
export async function verrijkAlles() {
  if (bezig) {
    nogEenRonde = true;
    return;
  }
  bezig = true;
  const mijnGeneratie = generatie;
  const geprobeerd = new Set();
  let klaar = 0;
  let totaal = 0;
  let gestopt = false;
  let laatsteFout = 0;
  let overgeslagen = 0;
  let googleOp = false;
  try {
    do {
      nogEenRonde = false;
      const open = schud(await db.boeken.filter((b) => b.verrijkt === false && !geprobeerd.has(b.id)).toArray());
      totaal += open.length;
      for (const boek of open) {
        geprobeerd.add(boek.id);
        if (mijnGeneratie !== generatie) return;
        if (!navigator.onLine) {
          gestopt = true;
          break;
        }
        // Het achtergronddeel van de Google-vragen voor vandaag is op: morgen verder.
        if (!googleStand().achtergrondMag) {
          gestopt = true;
          googleOp = true;
          break;
        }
        const stand = { klaar, totaal };
        const poging = await metGeduld(() => zoekBijpassend(boek), 'covers', stand);
        laatsteFout = stand.laatsteFout;
        if (stand.googleOp) googleOp = true;
        if (!poging || (poging.overslaan && ++overgeslagen >= MAX_OVERGESLAGEN_OP_RIJ)) {
          gestopt = true;
          break;
        }
        if (poging.overslaan) {
          totaal -= 1;
          continue;
        }
        overgeslagen = 0;
        const gevonden = poging.uitkomst;
        const actueel = await db.boeken.get(boek.id);
        if (!actueel || mijnGeneratie !== generatie) continue;
        const aanvulling = {};
        for (const veld of AANVULLEN) {
          if (!actueel[veld] && gevonden?.[veld]) aanvulling[veld] = gevonden[veld];
        }
        let nieuweCover = null;
        if (!actueel.cover && !actueel.coverUrl) {
          nieuweCover = await zoekCover({ ...actueel, ...aanvulling }, { opTitel: false });
        }
        const isbn = aanvulling.isbn || actueel.isbn;
        if (!actueel.werk && !aanvulling.werk && isbn) aanvulling.werk = (await zoekWerk(isbn)) || '';
        if (mijnGeneratie !== generatie) return;
        // Controle en schrijven in één handeling: alleen velden die nog steeds leeg zijn,
        // en alleen als het nog hetzelfde boek is. Wat de gebruiker intussen koos, blijft staan.
        await db.boeken.where('id').equals(boek.id).modify((b) => {
          if (b.titel !== boek.titel || b.toegevoegdOp !== boek.toegevoegdOp) return;
          for (const veld of AANVULLEN) {
            if (veld !== 'coverUrl' && !b[veld] && aanvulling[veld]) b[veld] = aanvulling[veld];
          }
          if (!b.cover && !b.coverUrl) {
            if (nieuweCover?.cover) b.cover = nieuweCover.cover;
            b.coverUrl = nieuweCover?.coverUrl || aanvulling.coverUrl || '';
          }
          if (!b.werk) b.werk = aanvulling.werk || b.werk || '';
          b.verrijkt = true;
        });
        klaar += 1;
        luisteraar({ klaar, totaal });
        await wacht(PAUZE);
      }
    } while (nogEenRonde && !gestopt);
    luisteraar({ klaar, totaal, gestopt: gestopt || klaar < totaal, laatsteFout, googleOp });
  } finally {
    bezig = false;
  }
  // Google is voor vandaag op: de synopsis kan ook wachten.
  if (googleOp) return;
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
  const mijnGeneratie = generatie;
  try {
    // Elke keer in een andere volgorde, zodat een paar lastige boeken de rest niet ophouden.
    const zonder = schud(await db.boeken.filter((b) => b.synopsis === undefined).toArray());
    let totaal = zonder.length;
    let overgeslagen = 0;
    let klaar = 0;
    let gestopt = false;
    let laatsteFout = 0;
    let googleOp = false;
    for (const boek of zonder) {
      // Covers gaan voor; die roepen de synopsis daarna vanzelf weer aan.
      if (bezig || mijnGeneratie !== generatie) return;
      if (!navigator.onLine) {
        gestopt = true;
        break;
      }
      if (!googleStand().achtergrondMag) {
        gestopt = true;
        googleOp = true;
        break;
      }
      const stand = { klaar, totaal };
      const poging = await metGeduld(() => zoekSynopsis(boek), 'synopsis', stand);
      laatsteFout = stand.laatsteFout;
      if (stand.googleOp) googleOp = true;
      if (!poging || (poging.overslaan && ++overgeslagen >= MAX_OVERGESLAGEN_OP_RIJ)) {
        gestopt = true;
        break;
      }
      if (poging.overslaan) {
        totaal -= 1;
        continue;
      }
      overgeslagen = 0;
      const synopsis = poging.uitkomst;
      if (mijnGeneratie !== generatie) return;
      await db.boeken.where('id').equals(boek.id).modify((b) => {
        if (b.synopsis === undefined && b.titel === boek.titel && b.toegevoegdOp === boek.toegevoegdOp) b.synopsis = synopsis;
      });
      klaar += 1;
      luisteraar({ soort: 'synopsis', klaar, totaal });
      await wacht(PAUZE);
    }
    // Overgeslagen boeken (storing bij Google) komen bij de volgende keer openen terug.
    if (zonder.length) luisteraar({ soort: 'synopsis', klaar, totaal, gestopt: gestopt || klaar < totaal, laatsteFout, googleOp });
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
