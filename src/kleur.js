// Kleur uit de cover: de app kijkt naar het plaatje en kiest één sfeerkleur,
// donker genoeg voor witte letters. Lukt het niet (bijvoorbeeld bij een cover van
// een andere website die niet uitgelezen mag worden), dan blijft het gewone groen.

const onthouden = new Map();

// Rood-groen-blauw (0–255) naar tint, verzadiging en helderheid (0–1).
export function naarHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

// Uit een rij pixels (r, g, b, a, r, g, b, a, …) de sfeerkleur: kleurrijke pixels tellen
// zwaarder dan grijs, wit en zwart. Uitkomst: twee tinten voor een verloop.
export function sfeerKleur(pixels) {
  let x = 0, y = 0, sGewogen = 0, gewicht = 0, grijs = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i + 3] < 128) continue;
    const [h, s, l] = naarHsl(pixels[i], pixels[i + 1], pixels[i + 2]);
    const w = s * (1 - Math.abs(l - 0.5) * 1.6);
    if (w <= 0.05) { grijs++; continue; }
    x += Math.cos(h * 2 * Math.PI) * w;
    y += Math.sin(h * 2 * Math.PI) * w;
    sGewogen += s * w;
    gewicht += w;
  }
  if (!gewicht) return null;
  const tint = Math.round(((Math.atan2(y, x) / (2 * Math.PI) + 1) % 1) * 360);
  // Een bijna grijze cover krijgt een ingetogen kleur in plaats van een felle.
  const vol = Math.min(0.55, (sGewogen / gewicht) * 0.8) * (gewicht / (gewicht + grijs * 0.15));
  const s = Math.round(Math.max(0.12, vol) * 100);
  return { donker: `hsl(${tint} ${s}% 16%)`, licht: `hsl(${tint} ${s}% 28%)` };
}

// De sfeerkleur van een geladen <img>. Geeft null als het plaatje niet uitgelezen mag worden.
export function coverKleur(img, sleutel = img.currentSrc || img.src) {
  if (onthouden.has(sleutel)) return onthouden.get(sleutel);
  let kleur = null;
  try {
    const c = document.createElement('canvas');
    c.width = 24; c.height = 36;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, c.width, c.height);
    kleur = sfeerKleur(g.getImageData(0, 0, c.width, c.height).data);
  } catch {
    kleur = null;
  }
  onthouden.set(sleutel, kleur);
  return kleur;
}

// Zet de kleur op een vlak zodra de cover erin geladen is.
export function kleurVlakNaarCover(vlak, img) {
  if (!vlak || !img || img.tagName !== 'IMG') return;
  const zet = () => {
    const kleur = img.naturalWidth > 40 ? coverKleur(img) : null;
    if (!kleur) return;
    vlak.style.setProperty('--kleur-donker', kleur.donker);
    vlak.style.setProperty('--kleur-licht', kleur.licht);
    vlak.classList.add('gekleurd');
  };
  if (img.complete && img.naturalWidth) zet();
  else img.addEventListener('load', zet, { once: true });
}
