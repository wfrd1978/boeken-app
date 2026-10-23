// Een voorstel voor de categorie van een nieuw boek. Wilfred kiest zelf; dit is alleen een hulp.
import { CATEGORIEEN } from './db.js';
import { kaal } from './dubbel.js';

// Woorden uit de onderwerpen van Google Books en Open Library (Engels en Nederlands).
const HINTS = [
  ['Thriller & spanning', ['thriller', 'suspense', 'mystery', 'detective', 'crime', 'spanning', 'misdaad', 'spionage', 'espionage']],
  ['Sport', ['sport', 'voetbal', 'soccer', 'football', 'cycling', 'wielren', 'tennis', 'formule 1']],
  ['Oorlog & geschiedenis', ['history', 'geschiedenis', 'war', 'oorlog', 'holocaust', 'world war']],
  ['Biografie & levensverhaal', ['biography', 'autobiography', 'memoir', 'biografie', 'autobiografie']],
  ['Geloof & zingeving', ['religion', 'christian', 'spiritual', 'geloof', 'religie', 'theologie', 'zingeving']],
  ['Journalistiek & samenleving', ['political', 'politics', 'social science', 'true crime', 'politiek', 'samenleving', 'journalist', 'business', 'technology']],
  ['Roman & humor', ['humor', 'fiction', 'roman', 'literature']],
];

// Telt bij twijfel dezelfde schrijver het zwaarst: van David Baldacci heb je al tien thrillers.
export function raadCategorie(boek, mijnBoeken = []) {
  const namen = (boek.auteurs ?? []).map(kaal);
  const telling = {};
  for (const b of mijnBoeken) {
    if (b.categorie && (b.auteurs ?? []).some((a) => namen.includes(kaal(a)))) {
      telling[b.categorie] = (telling[b.categorie] ?? 0) + 1;
    }
  }
  const vanSchrijver = Object.entries(telling).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (vanSchrijver) return vanSchrijver;

  const onderwerpen = kaal((boek.onderwerpen ?? []).join(' | '));
  if (!onderwerpen) return '';
  for (const [categorie, woorden] of HINTS) {
    if (woorden.some((w) => onderwerpen.includes(w))) return categorie;
  }
  return '';
}

// Een categorie uit een Excel-cel herkennen, ook kort geschreven ('thriller', 'biografie').
export function leesCategorie(waarde) {
  const tekst = kaal(String(waarde ?? '')).trim();
  if (!tekst) return '';
  return (
    CATEGORIEEN.find((c) => kaal(c) === tekst) ||
    CATEGORIEEN.find((c) => kaal(c).split(/\s*&\s*/).includes(tekst)) ||
    ''
  );
}
