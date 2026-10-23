// Cijfers over je lezen, voor de profielpagina. Alleen rekenen, geen opslag.

function jaarVan(datum) {
  return Number(datum.slice(0, 4));
}

export function berekenStatistieken(boeken, nu = new Date()) {
  const gelezen = boeken.filter((b) => b.status === 'Gelezen');
  const metSterren = boeken.filter((b) => b.sterren);
  const gemiddelde = (lijst) => (lijst.length ? lijst.reduce((som, b) => som + b.sterren, 0) / lijst.length : null);

  // Elke leesdatum telt, dus herlezen telt in dat jaar opnieuw mee.
  const perJaar = {};
  for (const b of boeken) for (const d of b.leesdata ?? []) perJaar[jaarVan(d)] = (perJaar[jaarVan(d)] ?? 0) + 1;

  const perCategorie = {};
  for (const b of gelezen) {
    const c = b.categorie || 'Nog geen categorie';
    (perCategorie[c] ??= []).push(b);
  }

  const perSchrijver = {};
  for (const b of gelezen) for (const a of b.auteurs ?? []) perSchrijver[a] = (perSchrijver[a] ?? 0) + 1;

  return {
    gelezen: gelezen.length,
    ditJaar: perJaar[nu.getFullYear()] ?? 0,
    gemiddeld: gemiddelde(metSterren),
    metSterren: metSterren.length,
    perJaar: Object.entries(perJaar)
      .map(([jaar, aantal]) => ({ jaar: Number(jaar), aantal }))
      .sort((a, b) => b.jaar - a.jaar),
    zonderDatum: gelezen.filter((b) => !b.leesdata?.length).length,
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
