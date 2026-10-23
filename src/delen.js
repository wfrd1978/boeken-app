// Een boek delen via het deelmenu (WhatsApp, Berichten, LinkedIn, mail).

import { koboZoekUrl } from './kobo.js';

export const OPENING = 'Hé, hier een leuke boekentip voor je:';

// Korter maken tot hele zinnen, zodat een lange tekst niet midden in een zin stopt.
function inkorten(tekst, max) {
  const schoon = (tekst || '').replace(/\s+/g, ' ').trim();
  if (schoon.length <= max) return schoon;
  const stuk = schoon.slice(0, max);
  const einde = Math.max(stuk.lastIndexOf('. '), stuk.lastIndexOf('! '), stuk.lastIndexOf('? '));
  return einde > max / 2 ? stuk.slice(0, einde + 1) : `${stuk.trimEnd()}…`;
}

export function bolZoekUrl(boek) {
  const auteur = boek.auteurs?.[0]?.split('&')[0].trim() ?? '';
  const zoek = boek.isbn || `${boek.titel} ${auteur}`.trim();
  return `https://www.bol.com/nl/nl/s/?searchtext=${encodeURIComponent(zoek)}`;
}

// Opening, titel en auteur, categorie en oordeel, je recensie, waar het over gaat en waar je het koopt.
export function deelTekst(boek, recensie = boek.recensie) {
  const auteurs = (boek.auteurs ?? []).join(' & ');
  const blokken = [OPENING, auteurs ? `${boek.titel}, van ${auteurs}` : boek.titel];

  const sterren = boek.status === 'Gelezen' && boek.sterren ? '★'.repeat(boek.sterren) + '☆'.repeat(5 - boek.sterren) : '';
  const regel = [boek.categorie, sterren].filter(Boolean).join(' · ');
  if (regel) blokken[1] += `\n${regel}`;
  if (boek.status === 'Bezig') blokken.push('Ik ben het nu zelf aan het lezen.');
  if (boek.status === 'Wil ik lezen') blokken.push('Het staat op mijn leeslijst.');

  const mijn = boek.status === 'Gelezen' ? inkorten(recensie, 600) : '';
  if (mijn) blokken.push(`Wat ik ervan vond:\n"${mijn}"`);
  const synopsis = inkorten(boek.synopsis, 350);
  if (synopsis) blokken.push(`Waar het over gaat:\n${synopsis}`);
  blokken.push(`Kobo: ${koboZoekUrl(boek)}\nBol.com: ${bolZoekUrl(boek)}`);
  return blokken.join('\n\n');
}

// Geeft 'gedeeld', 'gekopieerd' of 'geannuleerd'.
export async function deelBoek(tekst) {
  if (navigator.share) {
    try {
      await navigator.share({ text: tekst });
      return 'gedeeld';
    } catch (e) {
      if (e.name === 'AbortError') return 'geannuleerd';
    }
  }
  await navigator.clipboard.writeText(tekst);
  return 'gekopieerd';
}

