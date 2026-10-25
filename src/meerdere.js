// Meerdere boeken tegelijk: een rijtje titels (geplakt of met Scan tekst van het scherm van
// je ereader) omzetten in zoekopdrachten, en per regel het best passende resultaat kiezen.
import { achternaam, kaal } from './dubbel.js';

export const MAX_REGELS = 30;

// Regels van een bibliotheekscherm die geen titel zijn: percentages, 'Gelezen', 'Nieuw', tijden.
const RUIS = /^(\d+\s*%.*|\d+|nieuw|gelezen|ongelezen|voltooid|bezig|aan het lezen|kobo plus|voorbeeld|e-?book|luisterboek|.*\b(min|uur|pagina's|blz)\.?\s*(resterend|over)?)$/i;

const TUSSENVOEGSELS = new Set(['van', 'de', 'der', 'den', 'ten', 'ter', 'te', 'het', "'t", 'von', 'le', 'la', 'du', 'da', 'di', '&']);

// Lijkt deze regel op een naam? Twee tot vijf woorden die met een hoofdletter beginnen
// (tussenvoegsels uitgezonderd): "Jussi Adler-Olsen", "Michel van Egmond".
export function lijktNaam(regel) {
  const woorden = regel.trim().split(/\s+/);
  if (woorden.length < 2 || woorden.length > 5) return false;
  return woorden.every((w) => TUSSENVOEGSELS.has(w.toLowerCase()) || /^\p{Lu}/u.test(w)) && !/\d/.test(regel);
}

// "Titel – Schrijver", "Titel - Schrijver", "Titel door Schrijver" of alleen een titel.
function splits(regel) {
  const m = regel.match(/^(.+?)\s+(?:[–—-]|door|by)\s+(.+)$/i);
  return m && lijktNaam(m[2]) ? { titel: m[1].trim(), auteur: m[2].trim() } : { titel: regel.trim(), auteur: '' };
}

export function leesRegels(tekst) {
  const regels = String(tekst ?? '')
    .split(/\r?\n/)
    .map((r) => r.replace(/\s+/g, ' ').trim())
    .filter((r) => r.length > 1 && !RUIS.test(r));
  const uit = [];
  for (const regel of regels) {
    const vorige = uit[uit.length - 1];
    // Op een bibliotheekscherm staat de schrijver vaak op de regel onder de titel.
    if (vorige && !vorige.auteur && lijktNaam(regel)) {
      vorige.auteur = regel;
      continue;
    }
    uit.push(splits(regel));
  }
  const gezien = new Set();
  return uit
    .filter((r) => {
      const k = `${kaal(r.titel)}|${kaal(r.auteur)}`;
      if (gezien.has(k)) return false;
      gezien.add(k);
      return true;
    })
    .slice(0, MAX_REGELS);
}

function kern(tekst) {
  return kaal(tekst).replace(/^(de|het|een|the|a|an)\s+/, '').replace(/[^a-z0-9]/g, '');
}

// Het resultaat dat het best past bij de regel: zelfde titel, zelfde schrijver,
// Nederlands, met cover. Bij gelijke stand de volgorde van de bronnen.
export function ordenOpPassend(regel, resultaten) {
  const titel = kern(regel.titel);
  const naam = regel.auteur ? achternaam({ auteurs: [regel.auteur] }) : '';
  const score = (b) => {
    const t = kern(b.titel);
    const hoofd = kern((b.titel || '').split(/[:(]/)[0]);
    return (
      (t === titel || hoofd === titel ? 4 : t.includes(titel) || titel.includes(hoofd) ? 1 : 0) +
      (naam && achternaam(b) === naam ? 3 : 0) +
      (b.taal === 'nl' ? 1 : 0) +
      (b.coverUrl ? 0.5 : 0)
    );
  };
  return resultaten
    .map((b, i) => ({ b, s: score(b), i }))
    .sort((x, y) => y.s - x.s || x.i - y.i)
    .map((x) => x.b);
}
