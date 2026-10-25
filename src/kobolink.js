// Een gedeelde Kobo-link omzetten in een zoekterm. De Kobo-site zelf kan de app niet lezen
// (Kobo blokkeert dat), maar de titel staat in de link: kobo.com/nl/nl/ebook/de-prijs-3.

const LINK = /https?:\/\/[^\s]*kobo[^\s]*/i;

export function isKoboLink(tekst) {
  return LINK.test(String(tekst ?? ''));
}

// Geeft de titel uit de link (of uit de tekst eromheen), of '' als er niets bruikbaars in staat.
export function titelUitKoboLink(tekst) {
  const invoer = String(tekst ?? '');
  const link = invoer.match(LINK)?.[0];
  if (!link) return '';
  // Staat de titel tussen aanhalingstekens in de gedeelde tekst, dan die: die heeft nog accenten.
  const rest = invoer.replace(link, ' ');
  const tussen = rest.match(/[“"‘'«]([^”"’'»]{2,120})[”"’'»]/)?.[1]?.trim();
  if (tussen) return tussen;
  let pad;
  try {
    pad = decodeURIComponent(new URL(link).pathname);
  } catch {
    return '';
  }
  const slug = pad.match(/\/(?:ebook|audiobook|boek|book)\/([^/?#]+)/i)?.[1];
  if (!slug) return '';
  return slug
    .replace(/-\d+$/, '') // Kobo zet een volgnummer achter dubbele titels
    .replace(/[-_]+/g, ' ')
    .trim();
}
