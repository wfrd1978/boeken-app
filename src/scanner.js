// Streepjescode (ISBN) scannen met de camera, via ZXing. Werkt ook in Safari op de iPhone.

// Controle op het laatste cijfer van een ISBN-13, zodat een half gelezen code niet telt.
export function geldigIsbn13(code) {
  if (!/^97[89]\d{10}$/.test(code)) return false;
  const som = [...code.slice(0, 12)].reduce((t, c, i) => t + Number(c) * (i % 2 ? 3 : 1), 0);
  return (10 - (som % 10)) % 10 === Number(code[12]);
}

// Start de camera in 'video' en roept 'opGevonden(isbn)' aan bij de eerste geldige ISBN.
// Geeft een functie terug die de camera weer uitzet.
export async function startScanner(video, opGevonden) {
  // Pas laden als er gescand wordt, zodat de app zelf snel blijft.
  const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
    import('@zxing/browser'),
    import('@zxing/library'),
  ]);
  const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]]]);
  const lezer = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 150 });
  let klaar = false;
  let besturing = null;
  const stop = () => {
    klaar = true;
    besturing?.stop();
  };
  besturing = await lezer.decodeFromConstraints(
    { audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } } },
    video,
    (resultaat) => {
      if (klaar || !resultaat) return;
      const code = resultaat.getText();
      if (geldigIsbn13(code)) {
        stop();
        opGevonden(code);
      }
    }
  );
  if (klaar) besturing.stop();
  return stop;
}
