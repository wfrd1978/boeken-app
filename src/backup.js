// Backup: alle boeken (met covers) in één JSON-bestand, en weer terugzetten.
import { db } from './db.js';

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

async function tekstNaarBlob(dataUrl) {
  return (await fetch(dataUrl)).blob();
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
  return inhoud;
}

// Vervangt de hele lijst door de backup, in één keer: lukt iets niet, dan blijft alles zoals het was.
export async function zetBackupTerug(inhoud) {
  const boeken = await Promise.all(
    inhoud.boeken.map(async (b) => ({ ...b, cover: b.cover ? await tekstNaarBlob(b.cover) : null }))
  );
  await db.transaction('rw', db.boeken, db.instellingen, async () => {
    await db.boeken.clear();
    await db.boeken.bulkAdd(boeken);
    // Een oudere backup zonder profiel laat het huidige profiel staan.
    if (inhoud.profiel) await db.instellingen.put({ sleutel: 'profiel', waarde: inhoud.profiel });
    if (inhoud.tipReacties) await db.instellingen.put({ sleutel: 'tipReacties', waarde: inhoud.tipReacties });
  });
  return boeken.length;
}
