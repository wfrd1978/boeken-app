import { describe, expect, it } from 'vitest';
import { berekenStatistieken } from '../src/statistieken.js';

describe('statistieken', () => {
  const boeken = [
    { status: 'Gelezen', sterren: 5, leesdata: ['2025-10', '2026-03-01'], auteurs: ['Tess Gerritsen'], categorie: 'Thriller & spanning' },
    { status: 'Gelezen', sterren: 4, leesdata: ['2026-05'], auteurs: ['Tess Gerritsen'], categorie: 'Thriller & spanning' },
    { status: 'Gelezen', sterren: null, leesdata: [], auteurs: ['Hugo Borst'], categorie: '' },
    { status: 'Wil ik lezen', sterren: null, leesdata: [], auteurs: ['Mick Herron'], categorie: 'Thriller & spanning' },
  ];
  const st = berekenStatistieken(boeken, new Date('2026-10-24'));

  it('telt gelezen boeken, dit jaar en het gemiddelde', () => {
    expect(st).toMatchObject({ gelezen: 3, ditJaar: 2, gemiddeld: 4.5, metSterren: 2, zonderDatum: 1 });
  });

  it('telt herlezen per jaar mee, nieuwste jaar eerst', () => {
    expect(st.perJaar).toEqual([{ jaar: 2026, aantal: 2 }, { jaar: 2025, aantal: 1 }]);
  });

  it('deelt gelezen boeken in per categorie, zonder categorie onderaan', () => {
    expect(st.perCategorie).toEqual([
      { categorie: 'Thriller & spanning', aantal: 2, gemiddeld: 4.5 },
      { categorie: 'Nog geen categorie', aantal: 1, gemiddeld: null },
    ]);
  });

  it('noemt alleen schrijvers met minstens twee gelezen boeken', () => {
    expect(st.schrijvers).toEqual([{ naam: 'Tess Gerritsen', aantal: 2 }]);
  });
});
