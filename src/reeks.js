// Reeksen: bij welke reeks een boek hoort en welk deel het is ("Harry Bosch · deel 26 van 27").
// Geen gratis bron kent reeksen goed. Daarom een eigen lijst (reeksen.json op de site, elke week
// bijgehouden door een geplande taak); de app herkent op de telefoon zelf welke boeken erin staan.
// Zelf aanpassen kan altijd.
import { kaal, vindDubbel } from './dubbel.js';

// Een deelnummer: een heel getal van 1 tot 999, anders leeg.
export function leesDeel(waarde) {
  const n = Number(String(waarde ?? '').replace(/^deel\s*/i, '').trim());
  return Number.isInteger(n) && n >= 1 && n <= 999 ? n : null;
}

export function reeksTekst(boek) {
  if (!boek.reeks) return '';
  const deel = boek.reeksDeel ? `deel ${boek.reeksDeel}${boek.reeksTotaal ? ` van ${boek.reeksTotaal}` : ''}` : boek.reeksTotaal ? `${boek.reeksTotaal} delen` : '';
  return [boek.reeks, deel].filter(Boolean).join(' · ');
}

function zelfdeReeks(a, b) {
  return Boolean(a.reeks && b.reeks) && kaal(a.reeks).trim() === kaal(b.reeks).trim();
}

// Alle boeken uit je lijst in dezelfde reeks (ook dit boek zelf), op volgorde van deel.
export function delenInLijst(boek, boeken) {
  return boeken
    .filter((b) => b.id === boek.id || zelfdeReeks(b, boek))
    .sort((a, b) => (a.reeksDeel ?? 999) - (b.reeksDeel ?? 999) || a.titel.localeCompare(b.titel, 'nl'));
}

// Namen van reeksen die al in de lijst staan, om uit te kiezen bij het invullen.
export function bekendeReeksen(boeken) {
  return [...new Set(boeken.map((b) => b.reeks).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nl'));
}

const tekst = (v) => (typeof v === 'string' ? v.trim() : '');

// Een reeks uit reeksen.json in een vaste, veilige vorm; zonder naam, schrijver of delen valt hij weg.
export function normaliseerReeks(r) {
  if (!r || typeof r !== 'object' || !tekst(r.naam)) return null;
  const schrijvers = Array.isArray(r.schrijvers) ? r.schrijvers.map(tekst).filter(Boolean) : [];
  const delen = (Array.isArray(r.delen) ? r.delen : [])
    .map((d) => ({
      deel: leesDeel(d?.deel),
      titels: Array.isArray(d?.titels) ? d.titels.map(tekst).filter(Boolean) : [],
      jaar: Number.isInteger(d?.jaar) ? d.jaar : null,
    }))
    .filter((d) => d.deel && d.titels.length);
  if (!schrijvers.length || !delen.length) return null;
  return { naam: tekst(r.naam), schrijvers, delen, volgende: tekst(r.volgende) };
}

// Bij welke reeks hoort dit boek volgens de lijst? Titel (ook vertaald of oorspronkelijk)
// en achternaam van de schrijver moeten kloppen. Geeft de reeksvelden, of null.
export function herkenReeks(boek, reeksen) {
  for (const r of reeksen) {
    for (const d of r.delen) {
      const gevonden = d.titels.some((titel) => r.schrijvers.some((s) => vindDubbel({ titel, auteurs: [s], isbn: '' }, [boek])));
      if (gevonden) {
        return { reeks: r.naam, reeksDeel: d.deel, reeksTotaal: Math.max(...r.delen.map((x) => x.deel)), reeksVolgende: r.volgende };
      }
    }
  }
  return null;
}

// De reeks uit de lijst met dezelfde naam (voor het aantal delen en het volgende deel).
export function reeksOpNaam(naam, reeksen) {
  return reeksen.find((r) => kaal(r.naam).trim() === kaal(naam || '').trim()) ?? null;
}

// Het eerstvolgende deel dat nog niet in je lijst staat, met de (Nederlandse) titel.
export function volgendDeel(boek, reeks, boeken) {
  if (!reeks || !boek.reeksDeel) return null;
  const inLijst = new Set(delenInLijst(boek, boeken).map((b) => b.reeksDeel));
  return reeks.delen.find((d) => d.deel > boek.reeksDeel && !inLijst.has(d.deel)) ?? null;
}
