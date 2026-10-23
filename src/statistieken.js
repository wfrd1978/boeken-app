// Cijfers over je lezen, voor de profielpagina. Alleen rekenen, geen opslag.
// Alleen leesdatums vanaf de startmaand tellen mee: van daarvoor is het beeld niet compleet.

const MAAND = /^\d{4}-\d{2}$/;

export function huidigeMaand(nu = new Date()) {
  return `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, '0')}`;
}

export function geldigeStartmaand(waarde) {
  return typeof waarde === 'string' && MAAND.test(waarde) ? waarde : '';
}

export function berekenStatistieken(boeken, vanaf, nu = new Date()) {
  const dezeMaand = huidigeMaand(nu);
  // Elke leesdatum vanaf de start telt, dus herlezen telt opnieuw mee.
  // Een datum met alleen een maand ('2026-10') valt in die maand.
  const lezingen = [];
  for (const b of boeken) {
    for (const d of b.leesdata ?? []) if (d.slice(0, 7) >= vanaf) lezingen.push({ boek: b, maand: d.slice(0, 7) });
  }
  const gelezen = [...new Set(lezingen.map((l) => l.boek))];
  const metSterren = gelezen.filter((b) => b.sterren);
  const gemiddelde = (lijst) => (lijst.length ? lijst.reduce((som, b) => som + b.sterren, 0) / lijst.length : null);

  // Per maand: van de startmaand tot nu, hooguit de laatste twaalf maanden.
  const perMaand = [];
  for (let [j, m] = dezeMaand.split('-').map(Number); perMaand.length < 12; m--) {
    if (m === 0) [j, m] = [j - 1, 12];
    const maand = `${j}-${String(m).padStart(2, '0')}`;
    if (maand < vanaf) break;
    perMaand.push({ maand, aantal: lezingen.filter((l) => l.maand === maand).length });
  }

  const perJaar = {};
  for (const l of lezingen) perJaar[l.maand.slice(0, 4)] = (perJaar[l.maand.slice(0, 4)] ?? 0) + 1;

  const perCategorie = {};
  for (const b of gelezen) (perCategorie[b.categorie || 'Nog geen categorie'] ??= []).push(b);

  const perSchrijver = {};
  for (const b of gelezen) for (const a of b.auteurs ?? []) perSchrijver[a] = (perSchrijver[a] ?? 0) + 1;

  return {
    gelezen: lezingen.length,
    dezeMaand: lezingen.filter((l) => l.maand === dezeMaand).length,
    gemiddeld: gemiddelde(metSterren),
    metSterren: metSterren.length,
    perMaand,
    perJaar: Object.entries(perJaar)
      .map(([jaar, aantal]) => ({ jaar: Number(jaar), aantal }))
      .sort((a, b) => b.jaar - a.jaar),
    perCategorie: Object.entries(perCategorie)
      .map(([categorie, lijst]) => ({ categorie, aantal: lijst.length, gemiddeld: gemiddelde(lijst.filter((b) => b.sterren)) }))
      // 'Nog geen categorie' altijd onderaan.
      .sort((a, b) => (a.categorie === 'Nog geen categorie') - (b.categorie === 'Nog geen categorie') || b.aantal - a.aantal),
    schrijvers: Object.entries(perSchrijver)
      .filter(([, aantal]) => aantal >= 2)
      .map(([naam, aantal]) => ({ naam, aantal }))
      .sort((a, b) => b.aantal - a.aantal || a.naam.localeCompare(b.naam, 'nl'))
      .slice(0, 5),
  };
}
