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

// Tips zonder reactie en zonder boek dat al in de lijst staat (ook niet als vertaling).
export async function zichtbareTips(boeken) {
  const [lijst, reacties] = await Promise.all([haalTips(), tipReacties()]);
  if (!lijst?.tips?.length) return [];
  return lijst.tips.filter((t) => !reacties[t.id] && !vindDubbel(t, boeken));
}
