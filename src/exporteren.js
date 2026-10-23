// De hele lijst als echt Excel-bestand (.xlsx), via SheetJS.
import { db, statusNaam } from './db.js';
import { achternaam } from './dubbel.js';

// Een leesdatum zoals de gebruiker hem leest: "oktober 2025" of "14-10-2025".
function datumTekst(iso) {
  const [jaar, maand, dag] = iso.split('-');
  if (!dag) {
    return new Date(Number(jaar), Number(maand) - 1, 15).toLocaleDateString('nl-NL', { month: 'long', year: 'numeric' });
  }
  return `${dag}-${maand}-${jaar}`;
}

export async function maakExcel() {
  const XLSX = await import('xlsx');
  const boeken = (await db.boeken.toArray()).sort(
    (a, b) => achternaam(a).localeCompare(achternaam(b), 'nl') || a.titel.localeCompare(b.titel, 'nl')
  );
  const rijen = boeken.map((b) => ({
    Titel: b.titel,
    Auteur: (b.auteurs ?? []).join(' & '),
    Status: statusNaam(b.status),
    Sterren: b.sterren ?? '',
    // Bij herlezen staan alle leesdata in één cel.
    Gelezen: (b.leesdata ?? []).map(datumTekst).join('; '),
    Recensie: b.recensie ?? '',
    Synopsis: b.synopsis ?? '',
    Opmerking: b.opmerking ?? '',
    'Wacht op Kobo Plus': b.koboWacht ? 'ja' : '',
    ISBN: b.isbn ?? '',
    Uitgever: b.uitgever ?? '',
    Jaar: b.jaar ?? '',
    "Pagina's": b.paginas ?? '',
    Taal: b.taal ?? '',
    'Toegevoegd op': b.toegevoegdOp ? b.toegevoegdOp.slice(0, 10).split('-').reverse().join('-') : '',
  }));
  const blad = XLSX.utils.json_to_sheet(rijen);
  blad['!cols'] = [40, 30, 14, 8, 24, 50, 60, 24, 10, 15, 22, 6, 8, 6, 13].map((wch) => ({ wch }));
  blad['!autofilter'] = { ref: blad['!ref'] };
  const werkmap = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(werkmap, blad, 'Boeken');
  const inhoud = XLSX.write(werkmap, { bookType: 'xlsx', type: 'array' });
  const datum = new Date().toISOString().slice(0, 10);
  return {
    bestand: new File([inhoud], `boeken-${datum}.xlsx`, {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    aantal: boeken.length,
  };
}

// Via het deelmenu (bewaren, mailen, AirDrop), anders als download.
export async function deelBestand(bestand) {
  if (navigator.canShare?.({ files: [bestand] })) {
    try {
      await navigator.share({ files: [bestand] });
    } catch (e) {
      if (e.name !== 'AbortError') throw e;
    }
    return;
  }
  const url = URL.createObjectURL(bestand);
  Object.assign(document.createElement('a'), { href: url, download: bestand.name }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
