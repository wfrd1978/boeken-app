// Boekennieuws: elke ochtend een of twee berichten (nieuws.json op de eigen site, gemaakt door
// de dagelijkse taak). Alles wat de app ooit kreeg, blijft op de telefoon bewaard als archief.
import { db } from './db.js';
import { kaal } from './dubbel.js';
import { veiligeUrl } from './veilig.js';

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

// Een bericht in een vaste, veilige vorm; zonder titel of echte https-bron valt het weg.
export function normaliseerBericht(b) {
  if (!b || typeof b !== 'object' || typeof b.id !== 'string' || typeof b.titel !== 'string' || !b.titel.trim()) return null;
  const url = veiligeUrl(b.url);
  if (!url?.startsWith('https://')) return null;
  const tekst = (v) => (typeof v === 'string' ? v.trim() : '');
  const artikel = Array.isArray(b.artikel) ? b.artikel : typeof b.artikel === 'string' ? b.artikel.split(/\n{2,}/) : [];
  return {
    id: b.id,
    titel: b.titel.trim(),
    tekst: tekst(b.tekst),
    artikel: artikel.map(tekst).filter(Boolean),
    bron: tekst(b.bron),
    url,
    datum: DATUM.test(b.datum) ? b.datum : '',
    schrijvers: Array.isArray(b.schrijvers) ? b.schrijvers.filter((s) => typeof s === 'string') : [],
  };
}

// Nieuwste eerst; bij dezelfde datum blijft de volgorde van binnenkomst.
function opDatum(a, b) {
  return b.datum.localeCompare(a.datum);
}

export async function nieuwsArchief() {
  const archief = (await db.instellingen.get('nieuwsArchief'))?.waarde ?? [];
  return archief.map(normaliseerBericht).filter(Boolean).sort(opDatum);
}

// Nieuwe berichten (en verbeterde versies van bestaande) bewaren in het archief.
export async function bewaarNieuws(berichten) {
  const archief = await nieuwsArchief();
  const opId = new Map(archief.map((b) => [b.id, b]));
  let veranderd = false;
  for (const ruw of berichten ?? []) {
    const b = normaliseerBericht(ruw);
    if (!b) continue;
    if (JSON.stringify(opId.get(b.id)) !== JSON.stringify(b)) {
      opId.set(b.id, b);
      veranderd = true;
    }
  }
  const samen = [...opId.values()].sort(opDatum);
  if (veranderd) await db.instellingen.put({ sleutel: 'nieuwsArchief', waarde: samen });
  return samen;
}

// Het nieuwste van de site ophalen en bewaren. Zonder internet: wat de telefoon al heeft.
export async function haalNieuws() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}nieuws.json`, { cache: 'no-cache' });
    if (res.ok) return await bewaarNieuws((await res.json()).berichten);
  } catch {
    // Geen verbinding: het archief is genoeg.
  }
  return nieuwsArchief();
}

// Gaat een bericht over een schrijver uit de eigen lijst? Dat wordt alleen
// op de telefoon bekeken; het nieuwsbestand zelf weet niets van zijn lijst.
export function overMijnSchrijver(bericht, boeken) {
  const mijn = new Set(boeken.flatMap((b) => b.auteurs ?? []).map(kaal));
  return (bericht.schrijvers ?? []).some((s) => mijn.has(kaal(s)));
}

// Eigen schrijvers eerst, daarna het nieuwste bericht.
export function ordenNieuws(berichten, boeken) {
  return [...berichten].sort(
    (a, b) => overMijnSchrijver(b, boeken) - overMijnSchrijver(a, boeken) || String(b.datum).localeCompare(String(a.datum))
  );
}
