// Hulpjes om gegevens van buiten (zoekbronnen, backups, tips) veilig in de pagina te zetten.

// Maakt tekst veilig om in de pagina te zetten, ook binnen aanhalingstekens van een attribuut.
export function veilig(tekst) {
  return String(tekst ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Alleen gewone webadressen, plaatjes op het toestel en ingebakken plaatjes als cover.
export function veiligeUrl(url) {
  const u = String(url ?? '');
  return /^(https:\/\/|blob:|data:image\/)/i.test(u) ? u : '';
}
