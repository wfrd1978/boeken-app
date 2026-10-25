// De reekslijst ophalen (reeksen.json op de eigen site) en de eigen boeken aanvullen.
// Alles gebeurt op de telefoon: de lijst weet niets van jouw boeken.
import { db } from './db.js';
import { herkenReeks, normaliseerReeks, reeksOpNaam } from './reeks.js';

export async function reeksLijst() {
  const bewaard = (await db.instellingen.get('reeksLijst'))?.waarde;
  return (Array.isArray(bewaard) ? bewaard : []).map(normaliseerReeks).filter(Boolean);
}

async function haalReeksLijst() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}reeksen.json`, { cache: 'no-cache' });
    if (res.ok) {
      const lijst = ((await res.json()).reeksen ?? []).map(normaliseerReeks).filter(Boolean);
      if (lijst.length) await db.instellingen.put({ sleutel: 'reeksLijst', waarde: lijst });
      return lijst;
    }
  } catch {
    // Geen verbinding: de lijst die de telefoon al heeft.
  }
  return reeksLijst();
}

// Boeken zonder reeks krijgen er een als de lijst ze kent. Bij boeken in een bekende reeks
// worden het aantal delen en het volgende deel bijgewerkt. Een zelf ingevulde reeks of
// deel blijft altijd staan. Geeft het aantal bijgewerkte boeken.
export async function vulReeksenAan() {
  const reeksen = await haalReeksLijst();
  if (!reeksen.length) return 0;
  let n = 0;
  for (const boek of await db.boeken.toArray()) {
    let wijziging = null;
    if (!boek.reeks) {
      wijziging = herkenReeks(boek, reeksen);
    } else {
      const r = reeksOpNaam(boek.reeks, reeksen);
      const totaal = r ? Math.max(...r.delen.map((d) => d.deel)) : null;
      if (r && (totaal !== boek.reeksTotaal || r.volgende !== boek.reeksVolgende)) wijziging = { reeksTotaal: totaal, reeksVolgende: r.volgende };
    }
    if (!wijziging) continue;
    // Alleen als het nog hetzelfde boek is en de reeks intussen niet zelf is ingevuld.
    await db.boeken.where('id').equals(boek.id).modify((b) => {
      if (b.titel !== boek.titel || b.toegevoegdOp !== boek.toegevoegdOp) return;
      if (wijziging.reeks && b.reeks) return;
      Object.assign(b, wijziging);
    });
    n += 1;
  }
  return n;
}
