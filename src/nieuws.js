// Boekennieuws: een paar berichten per week (nieuws.json op de eigen site, gemaakt door de wekelijkse taak).
import { kaal } from './dubbel.js';
import { veiligeUrl } from './veilig.js';

export async function haalNieuws() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}nieuws.json`, { cache: 'no-cache' });
    if (!res.ok) return [];
    const data = await res.json();
    // Alleen berichten met een titel en een echte https-bron.
    return (data.berichten ?? []).filter((b) => b && typeof b.titel === 'string' && veiligeUrl(b.url)?.startsWith('https://'));
  } catch {
    return [];
  }
}

// Gaat een bericht over een schrijver van wie de gebruiker boeken heeft? Dat wordt alleen
// op de telefoon bekeken; het nieuwsbestand zelf weet niets van zijn lijst.
export function overMijnSchrijver(bericht, boeken) {
  const mijn = new Set(boeken.flatMap((b) => b.auteurs ?? []).map(kaal));
  return (bericht.schrijvers ?? []).some((s) => mijn.has(kaal(s)));
}

// Eigen schrijvers eerst, daarna het nieuwste bericht.
export function ordenNieuws(berichten, boeken) {
  return [...berichten].sort(
    (a, b) => overMijnSchrijver(b, boeken) - overMijnSchrijver(a, boeken) || String(b.datum).localeCompare(String(a.datum))
  );
}
