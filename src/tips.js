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
  // Titel en auteur mee, zodat Claude later ziet wat wel en niet aansloeg.
  reacties[tip.id] = { reactie, titel: tip.titel, auteurs: tip.auteurs, op: new Date().toISOString().slice(0, 10) };
  await db.instellingen.put({ sleutel: 'tipReacties', waarde: reacties });
}

// Alle tips die de app ooit kreeg, bewaard op het toestel. Zo blijven tips waar Wilfred
// nog niet op reageerde staan als er een nieuwe ronde komt; nieuwe tips komen vooraan.
const MAX_ZICHTBAAR = 12;

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
  return (archief?.waarde ?? []).filter((t) => !reacties[t.id] && !vindDubbel(t, boeken)).slice(0, MAX_ZICHTBAAR);
}

// Haalt de nieuwste ronde op en bewaart nieuwe tips. Geeft het aantal nieuwe tips terug.
export async function verversTips() {
  const lijst = await haalTips();
  const voor = (await db.instellingen.get('tipArchief'))?.waarde?.length ?? 0;
  const na = (await bewaarArchief(lijst?.tips)).length;
  return na - voor;
}
