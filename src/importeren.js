// Een Excel-lijst inlezen en klaarzetten voor import.
import { kaal, vindDubbel } from './dubbel.js';
import { STATUSSEN } from './db.js';
import { leesKoboOpmerking } from './kobo.js';

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
    return `${waarde.getFullYear()}-${tweeCijfers(waarde.getMonth() + 1)}-${tweeCijfers(waarde.getDate())}`;
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
      bron: 'excel',
    });
  }
  return boeken;
}

// Splitst in: toevoegen, en overslaan omdat het boek er al is (of dubbel in het bestand staat).
export function planImport(nieuw, bestaand) {
  const toevoegen = [];
  const overslaan = [];
  for (const boek of nieuw) {
    const al = vindDubbel(boek, bestaand) || vindDubbel(boek, toevoegen);
    if (al) overslaan.push({ boek, al });
    else toevoegen.push(boek);
  }
  return { toevoegen, overslaan };
}
