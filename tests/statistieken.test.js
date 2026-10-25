import { describe, expect, it } from 'vitest';
import { berekenStatistieken } from '../src/statistieken.js';

describe('statistieken vanaf een startmaand', () => {
  const boeken = [
    // Herlezen: de oude lezing telt niet, de nieuwe wel.
    { status: 'Gelezen', sterren: 5, leesdata: ['2025-10', '2026-10-03'], auteurs: ['Tess Gerritsen'], categorie: 'Thriller & spanning' },
    { status: 'Gelezen', sterren: 4, leesdata: ['2026-11'], auteurs: ['Tess Gerritsen'], categorie: 'Thriller & spanning' },
    { status: 'Gelezen', sterren: null, leesdata: ['2026-11-20'], auteurs: ['Hugo Borst'], categorie: '' },
    // Oude lijst zonder datum: telt niet mee, ook niet voor het gemiddelde.
    { status: 'Gelezen', sterren: 5, leesdata: [], auteurs: ['Dan Brown'], categorie: 'Thriller & spanning' },
  ];
  const st = berekenStatistieken(boeken, '2026-10', new Date('2026-11-24'));

  it('telt alleen lezingen vanaf de start', () => {
    expect(st).toMatchObject({ gelezen: 3, dezeMaand: 2, gemiddeld: 4.5, metSterren: 2 });
  });

  it('geeft de maanden vanaf de start, nieuwste eerst', () => {
    expect(st.perMaand).toEqual([
      { maand: '2026-11', aantal: 2 },
      { maand: '2026-10', aantal: 1 },
    ]);
    expect(st.perJaar).toEqual([{ jaar: 2026, aantal: 3 }]);
  });

  it('deelt in per categorie, zonder categorie onderaan', () => {
    expect(st.perCategorie).toEqual([
      { categorie: 'Thriller & spanning', aantal: 2, gemiddeld: 4.5 },
      { categorie: 'Nog geen categorie', aantal: 1, gemiddeld: null },
    ]);
    expect(st.schrijvers).toEqual([{ naam: 'Tess Gerritsen', aantal: 2 }]);
  });

  it('toont hooguit twaalf maanden, ook over de jaarwisseling', () => {
    const lang = berekenStatistieken([], '2020-01', new Date('2027-02-10'));
    expect(lang.perMaand).toHaveLength(12);
    expect(lang.perMaand[0].maand).toBe('2027-02');
    expect(lang.perMaand[2].maand).toBe('2026-12');
    expect(lang.gelezen).toBe(0);
  });
});

describe('Gelezen als', () => {
  it('telt papier, e-book en luisterboek', () => {
    const boeken = [
      { titel: 'A', leesdata: ['2026-10-01'], leesvorm: 'ebook' },
      { titel: 'B', leesdata: ['2026-10-02'], leesvorm: 'ebook' },
      { titel: 'C', leesdata: ['2026-10-03'], leesvorm: 'papier' },
      { titel: 'D', leesdata: ['2026-10-04'], leesvorm: '' },
    ];
    expect(berekenStatistieken(boeken, '2026-10', new Date(2026, 9, 25)).perVorm).toEqual([
      { vorm: 'ebook', aantal: 2 },
      { vorm: 'papier', aantal: 1 },
    ]);
  });
});
