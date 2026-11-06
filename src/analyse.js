// Leesanalyse: een maandrapport en een leesprofiel, uitgerekend op de telefoon.
// Alleen rekenen en tekst maken; de app toont het en bewaart alleen de tekst van Claude.

import { LEESVORMEN } from './db.js';

const MAAND = /^\d{4}-\d{2}$/;

export function geldigeMaand(m) {
  return typeof m === 'string' && MAAND.test(m) ? m : '';
}

export function vorigeMaand(maand) {
  let [j, m] = maand.split('-').map(Number);
  if (--m === 0) [j, m] = [j - 1, 12];
  return `${j}-${String(m).padStart(2, '0')}`;
}

export function maandNaam(maand, metJaar = true) {
  const [j, m] = maand.split('-').map(Number);
  return new Date(j, m - 1, 15).toLocaleDateString('nl-NL', { month: 'long', ...(metJaar ? { year: 'numeric' } : {}) });
}

// Welke boeken las je in een maand? Een boek dat je die maand twee keer uitlas, telt één keer.
// Niet uitgelezen boeken (in de opslag 'Gestopt') tellen niet mee.
export function gelezenIn(boeken, maand) {
  return boeken.filter((b) => b.status !== 'Gestopt' && (b.leesdata ?? []).some((d) => d.slice(0, 7) === maand));
}

// Maanden waarin iets is uitgelezen, nieuwste eerst.
export function maandenMetLezen(boeken) {
  const maanden = new Set();
  for (const b of boeken) if (b.status !== 'Gestopt') for (const d of b.leesdata ?? []) if (MAAND.test(d.slice(0, 7))) maanden.add(d.slice(0, 7));
  return [...maanden].sort().reverse();
}

const tel = (lijst, sleutel) => {
  const uit = {};
  for (const x of lijst) for (const k of [].concat(sleutel(x)).filter(Boolean)) uit[k] = (uit[k] ?? 0) + 1;
  return Object.entries(uit)
    .map(([naam, aantal]) => ({ naam, aantal }))
    .sort((a, b) => b.aantal - a.aantal || a.naam.localeCompare(b.naam, 'nl'));
};

// Eerste zin van een recensie, niet te lang.
export function eersteZin(tekst, max = 160) {
  const schoon = String(tekst ?? '').replace(/\s+/g, ' ').trim();
  if (!schoon) return '';
  const zin = schoon.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? schoon;
  return zin.length > max ? `${zin.slice(0, max - 1).trimEnd()}…` : zin;
}

const gemiddelde = (lijst) => {
  const met = lijst.filter((b) => b.sterren);
  return met.length ? met.reduce((s, b) => s + b.sterren, 0) / met.length : null;
};

// Het maandrapport: alles wat de app zelf kan uitrekenen.
export function maandRapport(boeken, maand) {
  const deze = gelezenIn(boeken, maand);
  const bladzijden = (lijst) => lijst.reduce((s, b) => s + (Number.isInteger(b.paginas) && b.paginas > 0 ? b.paginas : 0), 0);

  // Tempo: vergeleken met de drie maanden ervoor en dezelfde maand vorig jaar.
  const eerder = [];
  for (let m = vorigeMaand(maand), i = 0; i < 3; i++, m = vorigeMaand(m)) eerder.push(gelezenIn(boeken, m).length);
  const [j, mm] = maand.split('-');
  const vorigJaar = gelezenIn(boeken, `${Number(j) - 1}-${mm}`).length;

  // Schrijvers die je vóór deze maand nog nooit las.
  const eerderGelezen = new Set(
    boeken.filter((b) => (b.leesdata ?? []).some((d) => d.slice(0, 7) < maand)).flatMap((b) => b.auteurs ?? [])
  );

  const beste = [...deze]
    .filter((b) => b.sterren)
    .sort((a, b) => b.sterren - a.sterren || (b.recensie?.length ?? 0) - (a.recensie?.length ?? 0))[0];

  return {
    maand,
    aantal: deze.length,
    bladzijden: bladzijden(deze),
    gemiddeldEerder: eerder.reduce((s, n) => s + n, 0) / eerder.length,
    vorigeMaand: eerder[0],
    vorigJaar,
    categorieen: tel(deze, (b) => b.categorie || 'Nog geen categorie'),
    vormen: tel(deze, (b) => LEESVORMEN[b.leesvorm]),
    sterren: gemiddelde(deze),
    beste: beste ? { titel: beste.titel, auteurs: beste.auteurs ?? [], sterren: beste.sterren } : null,
    zinnen: deze
      .filter((b) => eersteZin(b.recensie))
      .sort((a, b) => (b.sterren ?? 0) - (a.sterren ?? 0))
      .slice(0, 3)
      .map((b) => ({ titel: b.titel, zin: eersteZin(b.recensie) })),
    schrijvers: tel(deze, (b) => b.auteurs ?? []).slice(0, 5),
    nieuweSchrijvers: [...new Set(deze.flatMap((b) => b.auteurs ?? []).filter((a) => !eerderGelezen.has(a)))],
    reeksen: deze
      .filter((b) => b.reeks)
      .map((b) => ({ reeks: b.reeks, deel: b.reeksDeel ?? null, titel: b.titel })),
    boeken: deze.map((b) => ({ titel: b.titel, auteurs: b.auteurs ?? [], sterren: b.sterren ?? null, categorie: b.categorie ?? '' })),
  };
}

// De opdracht voor Claude bij een maandrapport. Kort, zodat hij in een adres past.
export function rapportOpdracht(r) {
  const regels = [
    `Schrijf in het Nederlands een korte, persoonlijke terugblik (drie tot vijf alinea's, warm en nuchter, geen opsommingen) op mijn leesmaand ${maandNaam(r.maand)}.`,
    `Ik las ${r.aantal} ${r.aantal === 1 ? 'boek' : 'boeken'}${r.bladzijden ? ` (${r.bladzijden} bladzijden)` : ''}; de drie maanden ervoor gemiddeld ${r.gemiddeldEerder.toFixed(1)}, dezelfde maand vorig jaar ${r.vorigJaar}.`,
    `Boeken: ${r.boeken.map((b) => `${b.titel} (${b.auteurs.join(', ')}${b.sterren ? `, ${b.sterren}/5` : ''}${b.categorie ? `, ${b.categorie}` : ''})`).join('; ')}.`,
  ];
  if (r.vormen.length) regels.push(`Gelezen als: ${r.vormen.map((v) => `${v.naam} ${v.aantal}`).join(', ')}.`);
  if (r.zinnen.length) regels.push(`Uit mijn recensies: ${r.zinnen.map((z) => `${z.titel}: "${z.zin}"`).join(' ')}`);
  if (r.nieuweSchrijvers.length) regels.push(`Nieuwe schrijvers voor mij: ${r.nieuweSchrijvers.join(', ')}.`);
  regels.push('Wat zegt deze maand over wat ik zoek in boeken, en wat zou een mooie volgende stap zijn? Geef alleen de tekst, zonder titel.');
  return regels.join('\n');
}

// De opdracht voor een leesprofiel op basis van alles wat gelezen is. Compact gehouden:
// per boek titel, schrijver, sterren en categorie; recensiezinnen alleen van de beste boeken.
export function profielOpdracht(boeken) {
  const gelezen = boeken.filter((b) => b.status === 'Gelezen');
  const kort = (b) => `${b.titel}${b.auteurs?.[0] ? ` – ${b.auteurs[0]}` : ''}${b.sterren ? ` (${b.sterren}/5)` : ''}`;
  const perCategorie = {};
  for (const b of gelezen) (perCategorie[b.categorie || 'Overig'] ??= []).push(b);
  const regels = [
    'Schrijf in het Nederlands een lezersprofiel van mij in de tweede persoon ("je"), in vier tot zes alinea\'s, zonder opsommingen. Beschrijf wat ik graag lees en waarom, welke thema\'s en schrijvers me raken, wat ik minder waardeer, en welke kant mijn smaak op beweegt.',
    `Ik las ${gelezen.length} boeken. Per categorie:`,
    ...Object.entries(perCategorie)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([cat, lijst]) => `${cat} (${lijst.length}): ${lijst.map(kort).join('; ')}`),
  ];
  const vormen = tel(gelezen, (b) => LEESVORMEN[b.leesvorm]);
  if (vormen.length) regels.push(`Gelezen als: ${vormen.map((v) => `${v.naam} ${v.aantal}`).join(', ')}.`);
  const zinnen = gelezen
    .filter((b) => b.sterren >= 4 && eersteZin(b.recensie))
    .slice(0, 8)
    .map((b) => `${b.titel}: "${eersteZin(b.recensie, 120)}"`);
  if (zinnen.length) regels.push(`Uit mijn recensies: ${zinnen.join(' ')}`);
  regels.push('Geef alleen het profiel, zonder titel of inleiding.');
  return regels.join('\n');
}

// Past de opdracht in een adres? Anders alleen kopiëren en zelf plakken in Claude.
export const MAX_ADRES = 7000;

// --- Je leesjaar: dezelfde cijfers als bij een maand, maar dan voor een heel jaar ---

const JAAR = /^\d{4}$/;
export function geldigJaar(j) {
  return typeof j === 'string' && JAAR.test(j) ? j : '';
}

// Welk jaar is er om op terug te kijken? In december het lopende jaar, in januari het vorige.
// De rest van het jaar geen (de kaart op het startscherm verschijnt alleen dan).
export function terugblikJaar(nu = new Date()) {
  if (nu.getMonth() === 11) return String(nu.getFullYear());
  if (nu.getMonth() === 0) return String(nu.getFullYear() - 1);
  return '';
}

// Jaren waarin iets is uitgelezen, nieuwste eerst.
export function jarenMetLezen(boeken) {
  return [...new Set(maandenMetLezen(boeken).map((m) => m.slice(0, 4)))];
}

export function jaarRapport(boeken, jaar) {
  const inJaar = (b, j) => b.status !== 'Gestopt' && (b.leesdata ?? []).some((d) => d.slice(0, 4) === j);
  const deze = boeken.filter((b) => inJaar(b, jaar));
  const bladzijden = deze.reduce((s, b) => s + (Number.isInteger(b.paginas) && b.paginas > 0 ? b.paginas : 0), 0);
  const perMaand = [];
  for (let m = 1; m <= 12; m++) perMaand.push({ maand: `${jaar}-${String(m).padStart(2, '0')}`, aantal: gelezenIn(boeken, `${jaar}-${String(m).padStart(2, '0')}`).length });
  const eerderGelezen = new Set(
    boeken.filter((b) => (b.leesdata ?? []).some((d) => d.slice(0, 4) < jaar)).flatMap((b) => b.auteurs ?? [])
  );
  const opOordeel = [...deze]
    .filter((b) => b.sterren)
    .sort((a, b) => b.sterren - a.sterren || (b.recensie?.length ?? 0) - (a.recensie?.length ?? 0));
  const langste = [...deze].filter((b) => Number.isInteger(b.paginas) && b.paginas > 0).sort((a, b) => b.paginas - a.paginas)[0];
  const kort = (b) => ({ id: b.id, titel: b.titel, auteurs: b.auteurs ?? [], sterren: b.sterren ?? null, categorie: b.categorie ?? '' });
  return {
    jaar,
    aantal: deze.length,
    bladzijden,
    vorigJaar: boeken.filter((b) => inJaar(b, String(Number(jaar) - 1))).length,
    perMaand,
    drukste: [...perMaand].sort((a, b) => b.aantal - a.aantal)[0],
    categorieen: tel(deze, (b) => b.categorie || 'Nog geen categorie'),
    vormen: tel(deze, (b) => LEESVORMEN[b.leesvorm]),
    sterren: gemiddelde(deze),
    vijfSterren: deze.filter((b) => b.sterren === 5).map(kort),
    beste: opOordeel.slice(0, 3).map(kort),
    zinnen: opOordeel
      .filter((b) => eersteZin(b.recensie))
      .slice(0, 4)
      .map((b) => ({ titel: b.titel, zin: eersteZin(b.recensie) })),
    schrijvers: tel(deze, (b) => b.auteurs ?? []).slice(0, 5),
    nieuweSchrijvers: [...new Set(deze.flatMap((b) => b.auteurs ?? []).filter((a) => !eerderGelezen.has(a)))],
    langste: langste ? { titel: langste.titel, paginas: langste.paginas } : null,
    boeken: deze.map(kort),
  };
}

// De opdracht voor Claude bij een jaarterugblik. Compact: per boek titel, schrijver, sterren.
export function jaarOpdracht(r) {
  const regels = [
    `Schrijf in het Nederlands een persoonlijke terugblik op mijn leesjaar ${r.jaar} (vier tot zes alinea's, warm en nuchter, geen opsommingen, in de tweede persoon "je").`,
    `Ik las ${r.aantal} ${r.aantal === 1 ? 'boek' : 'boeken'}${r.bladzijden ? ` (${r.bladzijden} bladzijden)` : ''}; het jaar ervoor ${r.vorigJaar}.`,
    `Per maand: ${r.perMaand.map((m) => `${maandNaam(m.maand, false)} ${m.aantal}`).join(', ')}.`,
    `Genres: ${r.categorieen.map((c) => `${c.naam} ${c.aantal}`).join(', ')}.`,
    `Boeken: ${r.boeken.map((b) => `${b.titel} (${b.auteurs[0] ?? ''}${b.sterren ? `, ${b.sterren}/5` : ''})`).join('; ')}.`,
  ];
  if (r.zinnen.length) regels.push(`Uit mijn recensies: ${r.zinnen.map((z) => `${z.titel}: "${z.zin}"`).join(' ')}`);
  if (r.nieuweSchrijvers.length) regels.push(`Nieuwe schrijvers voor mij: ${r.nieuweSchrijvers.slice(0, 15).join(', ')}.`);
  regels.push('Wat waren de hoogtepunten, wat zegt dit jaar over wat ik zoek in boeken, en wat zou een mooie richting zijn voor volgend jaar? Geen druk, geen doelen opleggen. Geef alleen de tekst, zonder titel.');
  return regels.join('\n');
}
