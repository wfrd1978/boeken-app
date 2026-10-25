// Reeksen: bij welke reeks een boek hoort en welk deel het is ("Harry Bosch · deel 26 van 27").
// Geen gratis bron kent reeksen goed; Claude vult ze in via een Excel-import, zelf aanpassen kan altijd.
import { kaal } from './dubbel.js';

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
