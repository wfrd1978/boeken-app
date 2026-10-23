// 'Wacht op Kobo Plus': een boek dat de gebruiker wil lezen, maar dat nog niet in zijn abonnement zit.

// Haalt "Kobo Plus: ja/nee" uit een opmerking (zo staat het in de Excel-lijst van de
// verlanglijst) en geeft de opgeschoonde opmerking terug.
export function leesKoboOpmerking(opmerking = '') {
  const m = opmerking.match(/kobo plus:\s*(ja|nee)[^·]*/i);
  if (!m) return null;
  const rest = opmerking
    .replace(m[0], '')
    .split('·')
    .map((d) => d.trim())
    .filter(Boolean)
    .join(' · ');
  return { koboWacht: m[1].toLowerCase() === 'nee', opmerking: rest };
}

// Zoeken op de Nederlandse Kobo-site, met titel en auteur al ingevuld.
export function koboZoekUrl(boek) {
  const auteur = boek.auteurs?.[0]?.split('&')[0].trim() ?? '';
  return `https://www.kobo.com/nl/nl/search?query=${encodeURIComponent(`${boek.titel} ${auteur}`.trim())}`;
}
