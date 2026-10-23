// Tekst van een foto van de kaft lezen, op het toestel zelf (Tesseract.js).
// De foto gaat nergens heen; alleen het programma en het woordenbestand worden
// de eerste keer gedownload.

let lezer = null;

async function haalLezer(opVoortgang) {
  if (!lezer) {
    const { createWorker } = await import('tesseract.js');
    lezer = createWorker('nld+eng', 1, {
      logger: (m) => {
        if (m.status === 'recognizing text') opVoortgang?.('Tekst lezen…');
        else if (m.status?.startsWith('loading')) opVoortgang?.('Tekstherkenning laden (de eerste keer duurt dit even)…');
      },
    });
  }
  return lezer;
}

// Verkleint de foto: sneller lezen, en grote telefoonfoto's helpen niet.
async function verklein(bestand) {
  const beeld = await createImageBitmap(bestand);
  const schaal = Math.min(1, 1600 / Math.max(beeld.width, beeld.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(beeld.width * schaal);
  canvas.height = Math.round(beeld.height * schaal);
  canvas.getContext('2d').drawImage(beeld, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Geeft een zoekvraag terug: de grootste woorden eerst, want dat is meestal de titel,
// daarna de naam van de schrijver. Kleine lettertjes (citaten, uitgever) vallen weg.
export async function leesKaft(bestand, opVoortgang) {
  const werker = await haalLezer(opVoortgang);
  const { data } = await (await werker).recognize(await verklein(bestand));
  const woorden = (data.words ?? [])
    .map((w) => ({
      tekst: w.text.replace(/[^\p{L}\p{N}'’-]/gu, ''),
      hoogte: w.bbox.y1 - w.bbox.y0,
      zeker: w.confidence,
      y: w.bbox.y0,
      x: w.bbox.x0,
    }))
    .filter((w) => w.tekst.length >= 2 && w.zeker >= 55 && /\p{L}/u.test(w.tekst));
  if (!woorden.length) return '';
  const grootste = Math.max(...woorden.map((w) => w.hoogte));
  const groot = woorden
    .filter((w) => w.hoogte >= grootste * 0.35)
    .sort((a, b) => b.hoogte - a.hoogte)
    .slice(0, 8)
    // In leesvolgorde zetten: van boven naar beneden, van links naar rechts.
    // Woorden die ongeveer even hoog staan, horen bij dezelfde regel.
    .sort((a, b) => (Math.abs(a.y - b.y) < Math.min(a.hoogte, b.hoogte) / 2 ? a.x - b.x : a.y - b.y));
  return groot.map((w) => w.tekst).join(' ');
}
