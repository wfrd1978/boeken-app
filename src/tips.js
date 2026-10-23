// Boekentips: een wekelijkse lijst (tips.json op de eigen site) en Wilfreds reacties erop.
import { db } from './db.js';
import { vindDubbel } from './dubbel.js';

export async function haalTips() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}tips.json`, { cache: 'no-cache' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Reacties per tip: 'wil' (Wil ik lezen), 'gelezen' of 'nee' (Niet voor mij).
export async function tipReacties() {
  return (await db.instellingen.get('tipReacties'))?.waarde ?? {};
}

export async function zetTipReactie(tip, reactie) {
  const reacties = await tipReacties();
  // Titel, auteur, categorie en soort mee: zo leert de app wat wel en niet aanslaat,
  // en kan Claude het later ook zien (via een backup).
  reacties[tip.id] = {
    reactie,
    titel: tip.titel,
    auteurs: tip.auteurs,
    categorie: tip.categorie ?? '',
    soort: tip.soort ?? '',
    op: new Date().toISOString().slice(0, 10),
  };
  await db.instellingen.put({ sleutel: 'tipReacties', waarde: reacties });
}

// Alle tips die de app ooit kreeg, bewaard op het toestel. Zo blijven tips waar Wilfred
// nog niet op reageerde staan als er een nieuwe ronde komt; nieuwe tips komen vooraan.
const MAX_ZICHTBAAR = 8;

// Wat slaat aan? Wil ik lezen telt het zwaarst, Niet voor mij telt negatief.
// Je vijfsterrenboeken tellen een beetje mee voor hun categorie.
const GEWICHT = { wil: 2, gelezen: 1, nee: -2 };

export function smaak(reacties, boeken = []) {
  const score = {};
  const tel = (sleutel, punten) => {
    if (sleutel) score[sleutel] = (score[sleutel] ?? 0) + punten;
  };
  for (const r of Object.values(reacties)) {
    tel(r.categorie && `c:${r.categorie}`, GEWICHT[r.reactie] ?? 0);
    tel(r.soort && `s:${r.soort}`, (GEWICHT[r.reactie] ?? 0) / 2);
  }
  for (const b of boeken) if (b.sterren === 5) tel(b.categorie && `c:${b.categorie}`, 0.3);
  return score;
}

// Tips met de hoogste score eerst; bij gelijke stand blijft de volgorde (nieuwste eerst).
export function ordenTips(tips, score) {
  const punten = (t) => (score[`c:${t.categorie}`] ?? 0) + (score[`s:${t.soort}`] ?? 0);
  return tips
    .map((t, i) => ({ t, i, p: punten(t) }))
    .sort((a, b) => b.p - a.p || a.i - b.i)
    .map(({ t }) => t);
}

async function bewaarArchief(nieuw) {
  const archief = (await db.instellingen.get('tipArchief'))?.waarde ?? [];
  const bekend = new Set(archief.map((t) => t.id));
  const erbij = (nieuw ?? []).filter((t) => !bekend.has(t.id));
  const samen = [...erbij, ...archief];
  if (erbij.length) await db.instellingen.put({ sleutel: 'tipArchief', waarde: samen });
  return samen;
}

// Tips zonder reactie en zonder boek dat al in de lijst staat (ook niet als vertaling),
// uit wat het toestel al heeft: direct beschikbaar, zonder te wachten op internet.
export async function tipsUitArchief(boeken) {
  const [archief, reacties] = await Promise.all([db.instellingen.get('tipArchief'), tipReacties()]);
  const open = (archief?.waarde ?? []).filter((t) => !reacties[t.id] && !vindDubbel(t, boeken));
  return ordenTips(open, smaak(reacties, boeken)).slice(0, MAX_ZICHTBAAR);
}

// Haalt de nieuwste ronde op en bewaart nieuwe tips. Geeft het aantal nieuwe tips terug.
export async function verversTips() {
  const lijst = await haalTips();
  const voor = (await db.instellingen.get('tipArchief'))?.waarde?.length ?? 0;
  const na = (await bewaarArchief(lijst?.tips)).length;
  return na - voor;
}
