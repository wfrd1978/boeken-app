// Backup: alle boeken (met covers) in één JSON-bestand, en weer terugzetten.
import { db, normaliseerBoek } from './db.js';
import { stopAchtergrond } from './verrijken.js';

const SLEUTEL = 'laatsteBackup';
const HERINNER_NA_DAGEN = 14;

function blobNaarTekst(blob) {
  return new Promise((klaar, fout) => {
    const lezer = new FileReader();
    lezer.onload = () => klaar(lezer.result);
    lezer.onerror = () => fout(lezer.error);
    lezer.readAsDataURL(blob);
  });
}

// Zelf ontleden in plaats van fetch(): de veiligheidsregels van de app staan fetch van
// 'data:'-adressen bewust niet toe.
async function tekstNaarBlob(dataUrl) {
  const [kop, gegevens = ''] = dataUrl.split(',');
  const type = kop.match(/^data:([^;,]+)/)?.[1] ?? 'image/jpeg';
  const bytes = /;base64$/.test(kop) ? atob(gegevens) : decodeURIComponent(gegevens);
  return new Blob([Uint8Array.from(bytes, (c) => c.charCodeAt(0))], { type });
}

// Keuzes in de lijst (sorteren, tab, filter): klein, maar fijn om mee te verhuizen.
const VOORKEUREN = ['sortering', 'tab', 'toon'];

function leesVoorkeuren() {
  try {
    return Object.fromEntries(VOORKEUREN.map((k) => [k, localStorage.getItem(k)]).filter(([, v]) => typeof v === 'string'));
  } catch {
    return null;
  }
}

function zetVoorkeuren(v) {
  if (!v || typeof v !== 'object') return;
  try {
    for (const k of VOORKEUREN) if (typeof v[k] === 'string') localStorage.setItem(k, v[k]);
  } catch {
    // Niet erg: dan gelden de standaardkeuzes.
  }
}

// Alleen tips met een id en titel; de rest van een tip is gewone tekst.
function schoonArchief(a) {
  if (!Array.isArray(a)) return null;
  return a
    .filter((t) => t && typeof t.id === 'string' && typeof t.titel === 'string')
    .map((t) => JSON.parse(JSON.stringify(t)));
}

async function fotoAlsTekst() {
  const foto = (await db.instellingen.get('profielFoto'))?.waarde;
  return foto instanceof Blob ? blobNaarTekst(foto) : null;
}

export async function maakBackupBestand() {
  const boeken = await db.boeken.toArray();
  const metCovers = await Promise.all(
    boeken.map(async (b) => ({ ...b, cover: b.cover instanceof Blob ? await blobNaarTekst(b.cover) : null }))
  );
  const nu = new Date();
  const inhoud = {
    app: 'boeken-app',
    // Versie 2 bevat ook het profiel. Backups van versie 1 blijven gewoon terug te zetten.
    versie: 2,
    gemaakt: nu.toISOString(),
    aantal: boeken.length,
    boeken: metCovers,
    profiel: (await db.instellingen.get('profiel'))?.waarde ?? null,
    tipReacties: (await db.instellingen.get('tipReacties'))?.waarde ?? null,
    profielFoto: await fotoAlsTekst(),
    tipArchief: (await db.instellingen.get('tipArchief'))?.waarde ?? null,
    voorkeuren: leesVoorkeuren(),
  };
  const datum = nu.toISOString().slice(0, 10);
  return new File([JSON.stringify(inhoud)], `boeken-backup-${datum}.json`, { type: 'application/json' });
}

// Via het deelmenu (iPhone: 'Bewaar in Bestanden'), anders als download.
// Geeft true als de backup bewaard is, false als Wilfred annuleerde.
export async function bewaarBackup(bestand) {
  if (navigator.canShare?.({ files: [bestand] })) {
    try {
      await navigator.share({ files: [bestand] });
    } catch (e) {
      if (e.name === 'AbortError') return false;
      throw e;
    }
  } else {
    const url = URL.createObjectURL(bestand);
    const a = Object.assign(document.createElement('a'), { href: url, download: bestand.name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  try {
    localStorage.setItem(SLEUTEL, new Date().toISOString());
  } catch {
    // Dan herinnert de app er later nog eens aan; geen probleem.
  }
  return true;
}

export function laatsteBackup() {
  try {
    const waarde = localStorage.getItem(SLEUTEL);
    return waarde ? new Date(waarde) : null;
  } catch {
    return null;
  }
}

export function dagenSindsBackup() {
  const laatste = laatsteBackup();
  return laatste ? Math.floor((Date.now() - laatste) / 86400000) : null;
}

// Herinnering: nog nooit een backup, of langer dan 14 dagen geleden.
// 'Later' stelt de herinnering een dag uit.
export function moetHerinneren() {
  try {
    const uitgesteld = localStorage.getItem('backupLater');
    if (uitgesteld && Date.now() - new Date(uitgesteld) < 86400000) return false;
  } catch {
    // Geen opslag: gewoon herinneren.
  }
  const dagen = dagenSindsBackup();
  return dagen === null || dagen >= HERINNER_NA_DAGEN;
}

export function herinnerLater() {
  try {
    localStorage.setItem('backupLater', new Date().toISOString());
  } catch {
    // Niet erg.
  }
}

// Leest een backupbestand en controleert of het echt een backup van deze app is.
export async function leesBackup(bestand) {
  let inhoud;
  try {
    inhoud = JSON.parse(await bestand.text());
  } catch {
    throw new Error('Dit bestand is geen backup van de boeken-app.');
  }
  if (inhoud?.app !== 'boeken-app' || !Array.isArray(inhoud.boeken)) {
    throw new Error('Dit bestand is geen backup van de boeken-app.');
  }
  if (inhoud.versie > 2) {
    throw new Error('Deze backup is gemaakt met een nieuwere versie van de app. Werk de app eerst bij.');
  }
  // Elk boek nu al controleren, zodat een kapotte backup vóór het vervangen wordt geweigerd.
  inhoud.boeken.forEach(normaliseerBoek);
  return inhoud;
}

function schoonProfiel(p) {
  if (!p || typeof p !== 'object') return null;
  const tekst = (v) => (typeof v === 'string' ? v : '');
  const profiel = { naam: tekst(p.naam), overMij: tekst(p.overMij), lezersprofiel: tekst(p.lezersprofiel) };
  if (/^\d{4}-\d{2}$/.test(p.statsVanaf)) profiel.statsVanaf = p.statsVanaf;
  return profiel;
}

function schoneReacties(r) {
  if (!r || typeof r !== 'object') return null;
  const schoon = {};
  for (const [id, v] of Object.entries(r)) {
    if (v && ['wil', 'gelezen', 'nee'].includes(v.reactie)) {
      schoon[id] = {
        reactie: v.reactie,
        titel: String(v.titel ?? ''),
        auteurs: Array.isArray(v.auteurs) ? v.auteurs.map(String) : [],
        op: String(v.op ?? ''),
        categorie: String(v.categorie ?? ''),
        soort: String(v.soort ?? ''),
      };
    }
  }
  return schoon;
}

// Vervangt de hele lijst door de backup, in één keer: lukt iets niet, dan blijft alles zoals het was.
export async function zetBackupTerug(inhoud) {
  const boeken = await Promise.all(
    inhoud.boeken.map(async (b) => {
      // Alleen echte ingebakken plaatjes worden weer een cover.
      const cover = typeof b.cover === 'string' && b.cover.startsWith('data:image/') ? await tekstNaarBlob(b.cover) : null;
      return normaliseerBoek({ ...b, cover });
    })
  );
  const profiel = schoonProfiel(inhoud.profiel);
  const reacties = schoneReacties(inhoud.tipReacties);
  const archief = schoonArchief(inhoud.tipArchief);
  const foto =
    typeof inhoud.profielFoto === 'string' && inhoud.profielFoto.startsWith('data:image/') ? await tekstNaarBlob(inhoud.profielFoto) : null;
  // Werk op de achtergrond (covers, synopsis) eerst stoppen: dat hoort bij de oude lijst.
  stopAchtergrond();
  await db.transaction('rw', db.boeken, db.instellingen, async () => {
    await db.boeken.clear();
    await db.boeken.bulkAdd(boeken);
    // Een oudere backup zonder profiel laat het huidige profiel staan.
    if (profiel) await db.instellingen.put({ sleutel: 'profiel', waarde: profiel });
    if (reacties) await db.instellingen.put({ sleutel: 'tipReacties', waarde: reacties });
    // Een backup zonder foto laat de huidige foto staan.
    if (foto) await db.instellingen.put({ sleutel: 'profielFoto', waarde: foto });
    if (archief) await db.instellingen.put({ sleutel: 'tipArchief', waarde: archief });
  });
  zetVoorkeuren(inhoud.voorkeuren);
  return boeken.length;
}
