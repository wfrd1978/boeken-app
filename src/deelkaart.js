// Deelkaart: een afbeelding van een boek om te delen (WhatsApp, Instagram, LinkedIn).
// Cover, sterren, titel, schrijver en een zin uit je recensie, op de kleur van de cover.
// Alles wordt op de telefoon getekend; er gaat niets naar een dienst.

import { sfeerKleur } from './kleur.js';
import { eersteZin, maandNaam } from './analyse.js';

export const BREED = 1080;
export const HOOG = 1350;

// Welke zin komt op de kaart? De eerste zin van je recensie, niet te lang.
export function kaartZin(recensie) {
  return eersteZin(recensie, 150);
}

// Het regeltje onderaan: wanneer gelezen, of dat je het nu leest.
export function kaartVoet(boek) {
  if (boek.status === 'Bezig') return 'Nu aan het lezen';
  if (boek.status === 'Wil ik lezen') return 'Op mijn leeslijst';
  const laatste = [...(boek.leesdata ?? [])].sort().at(-1);
  if (boek.status === 'Gelezen' && /^\d{4}-\d{2}/.test(laatste ?? '')) return `Gelezen in ${maandNaam(laatste.slice(0, 7))}`;
  return boek.status === 'Gelezen' ? 'Gelezen' : '';
}

// Tekst in regels knippen die passen, hooguit `max` regels (de laatste met … als het niet past).
function regels(ctx, tekst, breedte, max) {
  const woorden = String(tekst || '').split(/\s+/).filter(Boolean);
  const uit = [];
  let regel = '';
  for (const w of woorden) {
    const proef = regel ? `${regel} ${w}` : w;
    if (ctx.measureText(proef).width <= breedte || !regel) regel = proef;
    else {
      uit.push(regel);
      regel = w;
    }
  }
  if (regel) uit.push(regel);
  if (uit.length > max) {
    uit.length = max;
    let laatste = uit[max - 1];
    while (laatste && ctx.measureText(`${laatste}…`).width > breedte) laatste = laatste.slice(0, -1);
    uit[max - 1] = `${laatste.trimEnd()}…`;
  }
  return uit;
}

function afgerond(ctx, x, y, b, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + b, y, x + b, y + h, r);
  ctx.arcTo(x + b, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + b, y, r);
  ctx.closePath();
}

// De sfeerkleur van de cover; lukt dat niet, dan het groen van de app.
function kleurVan(cover) {
  try {
    const c = document.createElement('canvas');
    c.width = 24;
    c.height = 36;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(cover, 0, 0, 24, 36);
    return sfeerKleur(g.getImageData(0, 0, 24, 36).data);
  } catch {
    return null;
  }
}

function teken(boek, recensie, cover, letter) {
  const c = document.createElement('canvas');
  c.width = BREED;
  c.height = HOOG;
  const ctx = c.getContext('2d');
  const letters = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';

  // Achtergrond: een verloop in de kleur van de cover.
  const kleur = cover ? kleurVan(cover) : null;
  const verloop = ctx.createLinearGradient(0, 0, BREED * 0.4, HOOG);
  verloop.addColorStop(0, kleur?.licht ?? '#1d5a45');
  verloop.addColorStop(1, kleur?.donker ?? '#0f3d2e');
  ctx.fillStyle = verloop;
  ctx.fillRect(0, 0, BREED, HOOG);

  // De cover, groot en met schaduw.
  const ch = 600;
  const cb = 400;
  const cx = (BREED - cb) / 2;
  const cy = 110;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 60;
  ctx.shadowOffsetY = 24;
  afgerond(ctx, cx, cy, cb, ch, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fill();
  ctx.restore();
  ctx.save();
  afgerond(ctx, cx, cy, cb, ch, 10);
  ctx.clip();
  if (cover && letter === null) {
    // Bijsnijden zoals op het scherm (object-fit: cover).
    const schaal = Math.max(cb / cover.naturalWidth, ch / cover.naturalHeight);
    const w = cover.naturalWidth * schaal;
    const h = cover.naturalHeight * schaal;
    ctx.drawImage(cover, cx + (cb - w) / 2, cy + (ch - h) / 2, w, h);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(cx, cy, cb, ch);
    ctx.fillStyle = '#ffffff';
    ctx.font = `700 200px ${letters}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((boek.titel || '?').charAt(0), BREED / 2, cy + ch / 2);
  }
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  let y = cy + ch + 100;

  // Sterren.
  if (boek.status === 'Gelezen' && boek.sterren) {
    ctx.font = `56px ${letters}`;
    const ster = 64;
    const begin = BREED / 2 - (5 * ster) / 2 + ster / 2;
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < boek.sterren ? '#e3b23c' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', begin + i * ster, y);
    }
    y += 90;
  }

  // Titel en schrijver.
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 60px ${letters}`;
  for (const r of regels(ctx, boek.titel, BREED - 160, 2)) {
    ctx.fillText(r, BREED / 2, y);
    y += 70;
  }
  ctx.globalAlpha = 0.8;
  ctx.font = `400 38px ${letters}`;
  ctx.fillText((boek.auteurs ?? []).join(' & '), BREED / 2, y);
  ctx.globalAlpha = 1;
  y += 80;

  // Een zin uit de recensie.
  const zin = boek.status === 'Gelezen' ? kaartZin(recensie) : '';
  if (zin) {
    ctx.font = `italic 400 38px ${letters}`;
    ctx.globalAlpha = 0.92;
    for (const r of regels(ctx, `“${zin}”`, BREED - 200, 3)) {
      if (y > HOOG - 110) break;
      ctx.fillText(r, BREED / 2, y);
      y += 52;
    }
    ctx.globalAlpha = 1;
  }

  // Onderaan: wanneer gelezen.
  const voet = kaartVoet(boek);
  if (voet) {
    ctx.globalAlpha = 0.65;
    ctx.font = `600 30px ${letters}`;
    ctx.fillText(voet, BREED / 2, HOOG - 56);
    ctx.globalAlpha = 1;
  }
  return c;
}

const naarBlob = (c) =>
  new Promise((klaar, fout) => {
    try {
      c.toBlob((b) => (b ? klaar(b) : fout(new Error('leeg'))), 'image/jpeg', 0.9);
    } catch (e) {
      fout(e);
    }
  });

// Maakt de kaart als jpg. `cover` is het plaatje dat op de boekpagina staat (of niets).
// Een cover van een andere website mag soms niet in een afbeelding: dan de beginletter.
export async function maakDeelkaart(boek, recensie, cover) {
  const bruikbaar = cover?.tagName === 'IMG' && cover.naturalWidth > 0 ? cover : null;
  try {
    return await naarBlob(teken(boek, recensie, bruikbaar, bruikbaar ? null : 'letter'));
  } catch {
    return naarBlob(teken(boek, recensie, null, 'letter'));
  }
}
