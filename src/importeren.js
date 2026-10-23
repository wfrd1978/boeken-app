// Een Excel-lijst inlezen en klaarzetten voor import.
import { kaal, vindDubbel } from './dubbel.js';
import { STATUSSEN } from './db.js';
import { leesKoboOpmerking } from './kobo.js';
import { leesCategorie } from './categorie.js';

const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];

// Welke kolomnamen we herkennen (kleine letters, zonder accenten).
const KOLOMMEN = {
  auteur: ['auteur', 'auteurs', 'schrijver', 'schrijvers', 'author'],
  titel: ['titel', 'title', 'boek'],
  gelezen: ['gelezen (maand)', 'gelezen', 'leesdatum', 'datum', 'gelezen op'],
  sterren: ['sterren', 'cijfer', 'waardering', 'rating'],
  opmerking: ['opmerking', 'opmerkingen', 'notitie', 'serie'],
  status: ['status'],
  isbn: ['isbn'],
  categorie: ['categorie', 'categorieen', 'genre'],
};

function kolomSoort(kop) {
  const naam = kaal(String(kop)).trim();
  return Object.keys(KOLOMMEN).find((soort) => KOLOMMEN[soort].includes(naam));
}

function tweeCijfers(n) {
  return String(n).padStart(2, '0');
}

// "oktober 2025" -> "2025-10", een echte datum -> "2025-10-14".
function leesLeesdatum(waarde) {
  if (!waarde) return '';
  if (waarde instanceof Date && !isNaN(waarde)) {
    // Een half dagje erbij, zodat een tijdzoneverschil geen dag eerder oplevert.
    const d = new Date(waarde.getTime() + 12 * 3600 * 1000);
    const maand = `${d.getFullYear()}-${tweeCijfers(d.getMonth() + 1)}`;
    // Een maand als datumcel ('okt-25') komt binnen als de 1e: dan geen dag verzinnen.
    return d.getDate() === 1 ? maand : `${maand}-${tweeCijfers(d.getDate())}`;
  }
  const tekst = kaal(String(waarde)).trim();
  const maand = tekst.match(/^([a-z]+)\s+(\d{4})$/);
  if (maand && MAANDEN.includes(maand[1])) return `${maand[2]}-${tweeCijfers(MAANDEN.indexOf(maand[1]) + 1)}`;
  const nl = tekst.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (nl) return `${nl[3]}-${tweeCijfers(nl[2])}-${tweeCijfers(nl[1])}`;
  if (/^\d{4}-\d{2}(-\d{2})?$/.test(tekst)) return tekst;
  if (/^\d{4}$/.test(tekst)) return '';
  return '';
}

function leesSterren(waarde) {
  if (waarde === '' || waarde == null) return null;
  const tekst = String(waarde).trim();
  const getal = /^\*+$/.test(tekst) ? tekst.length : Math.round(Number(tekst.replace(',', '.')));
  return getal >= 1 && getal <= 5 ? getal : null;
}

function leesStatus(waarde) {
  const tekst = kaal(String(waarde || '')).trim();
  if (tekst === 'aan het lezen') return 'Bezig';
  return STATUSSEN.find((s) => kaal(s) === tekst) || 'Gelezen';
}

export async function leesExcel(bestand) {
  // SheetJS pas laden als het nodig is, zodat de app zelf snel blijft.
  const XLSX = await import('xlsx');
  let werkmap;
  try {
    werkmap = XLSX.read(await bestand.arrayBuffer(), { cellDates: true });
  } catch {
    throw new Error('Dit bestand kan ik niet lezen. Kies een Excel-bestand (.xlsx).');
  }
  const blad = werkmap.Sheets[werkmap.SheetNames[0]];
  const rijen = XLSX.utils.sheet_to_json(blad, { header: 1, raw: true, defval: '' });

  const kopRij = rijen.findIndex((rij) => rij.some((cel) => kolomSoort(cel) === 'titel'));
  if (kopRij === -1) {
    throw new Error('Ik vind geen kolom "Titel" in het eerste tabblad. Zet bovenaan de kolommen Auteur en Titel.');
  }
  const soorten = rijen[kopRij].map(kolomSoort);
  const kolom = (rij, soort) => {
    const i = soorten.indexOf(soort);
    return i === -1 ? '' : rij[i];
  };

  const boeken = [];
  for (const rij of rijen.slice(kopRij + 1)) {
    const titel = String(kolom(rij, 'titel')).trim();
    if (!titel) continue;
    const auteur = String(kolom(rij, 'auteur')).trim();
    const leesdatum = leesLeesdatum(kolom(rij, 'gelezen'));
    const opmerking = String(kolom(rij, 'opmerking')).trim();
    const kobo = leesKoboOpmerking(opmerking);
    boeken.push({
      titel,
      auteurs: auteur ? auteur.split(/\s*&\s*/).filter(Boolean) : [],
      isbn: String(kolom(rij, 'isbn')).replace(/[^0-9X]/gi, ''),
      status: leesStatus(kolom(rij, 'status')),
      sterren: leesSterren(kolom(rij, 'sterren')),
      leesdata: leesdatum ? [leesdatum] : [],
      opmerking: kobo ? kobo.opmerking : opmerking,
      koboWacht: kobo?.koboWacht ?? false,
      categorie: leesCategorie(kolom(rij, 'categorie')),
      bron: 'excel',
    });
  }
  // Alleen auteur, titel en categorie: dat is een lijst om bestaande boeken in te delen,
  // geen lijst met nieuwe boeken. Dan wordt er niets toegevoegd.
  const alleenIndelen = soorten.includes('categorie') && !['gelezen', 'sterren', 'status', 'opmerking'].some((s) => soorten.includes(s));
  return Object.assign(boeken, { alleenIndelen });
}

// Splitst in: toevoegen, bijwerken, overslaan en (bij een indeellijst) niet gevonden.
// Bijwerken = het boek staat er al en het bestand vult een leeg veld aan (sterren, categorie).
// Wat Wilfred zelf al invulde, blijft altijd staan.
export function planImport(nieuw, bestaand) {
  const toevoegen = [];
  const bijwerken = [];
  const overslaan = [];
  const nietGevonden = [];
  for (const boek of nieuw) {
    const al = vindDubbel(boek, bestaand);
    const wijzigingen = {};
    if (al && boek.sterren && !al.sterren) wijzigingen.sterren = boek.sterren;
    if (al && boek.categorie && !al.categorie) wijzigingen.categorie = boek.categorie;
    if (Object.keys(wijzigingen).length && !bijwerken.some((b) => b.al === al)) bijwerken.push({ boek, al, wijzigingen });
    else if (al || vindDubbel(boek, toevoegen)) overslaan.push({ boek, al: al || vindDubbel(boek, toevoegen) });
    else if (nieuw.alleenIndelen) nietGevonden.push(boek);
    else toevoegen.push(boek);
  }
  return { toevoegen, bijwerken, overslaan, nietGevonden };
}
