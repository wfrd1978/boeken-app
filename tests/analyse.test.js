import { describe, expect, it } from 'vitest';
import { maandRapport, vorigeMaand, maandenMetLezen, eersteZin, rapportOpdracht, profielOpdracht } from '../src/analyse.js';

const boeken = [
  { titel: 'A', auteurs: ['Jan'], status: 'Gelezen', leesdata: ['2026-10-03'], sterren: 5, paginas: 300, categorie: 'Sport', leesvorm: 'ebook', recensie: 'Prachtig boek. Echt.', reeks: 'R', reeksDeel: 2 },
  { titel: 'B', auteurs: ['Piet'], status: 'Gelezen', leesdata: ['2026-10'], sterren: 3, paginas: 200, categorie: 'Sport', leesvorm: 'papier' },
  { titel: 'C', auteurs: ['Jan'], status: 'Gelezen', leesdata: ['2026-09-20'], sterren: 4, categorie: 'Roman & humor' },
  { titel: 'D', auteurs: ['Kees'], status: 'Gelezen', leesdata: ['2025-10-01', '2026-07-01'] },
];

describe('maandrapport', () => {
  const r = maandRapport(boeken, '2026-10');
  it('telt boeken en bladzijden van de maand', () => {
    expect(r.aantal).toBe(2);
    expect(r.bladzijden).toBe(500);
  });
  it('vergelijkt met eerdere maanden en vorig jaar', () => {
    expect(r.vorigeMaand).toBe(1);
    expect(r.gemiddeldEerder).toBeCloseTo(2 / 3);
    expect(r.vorigJaar).toBe(1);
  });
  it('vindt genres, leesvorm, beste boek, nieuwe schrijvers en reeksen', () => {
    expect(r.categorieen[0]).toEqual({ naam: 'Sport', aantal: 2 });
    expect(r.vormen.map((v) => v.naam).sort()).toEqual(['E-book', 'Papier']);
    expect(r.beste.titel).toBe('A');
    expect(r.sterren).toBe(4);
    expect(r.nieuweSchrijvers).toEqual(['Piet']);
    expect(r.reeksen).toEqual([{ reeks: 'R', deel: 2, titel: 'A' }]);
    expect(r.zinnen[0].zin).toBe('Prachtig boek.');
  });
});

describe('hulpjes', () => {
  it('rekent maanden terug, ook over de jaargrens', () => {
    expect(vorigeMaand('2026-01')).toBe('2025-12');
    expect(maandenMetLezen(boeken)).toEqual(['2026-10', '2026-09', '2026-07', '2025-10']);
  });
  it('kort een lange eerste zin in', () => {
    expect(eersteZin('x'.repeat(300), 20)).toHaveLength(20);
    expect(eersteZin('')).toBe('');
  });
  it('maakt opdrachten met de boeken erin', () => {
    expect(rapportOpdracht(maandRapport(boeken, '2026-10'))).toContain('A (Jan, 5/5, Sport)');
    expect(profielOpdracht(boeken)).toContain('Sport (2): A – Jan (5/5); B – Piet (3/5)');
  });
});

import { schoneRapporten } from '../src/backup.js';

describe('maandanalyses in de backup', () => {
  it('houdt alleen geldige maanden met tekst over', () => {
    expect(schoneRapporten({ '2026-10': { tekst: 'Mooi', gemaakt: 'x' }, rommel: { tekst: 'y' }, '2026-09': { tekst: '' } })).toEqual({
      '2026-10': { tekst: 'Mooi', gemaakt: 'x' },
    });
    expect(schoneRapporten(null)).toBeNull();
  });
});

import { jaarRapport, terugblikJaar, jarenMetLezen, jaarOpdracht } from '../src/analyse.js';

describe('leesjaar', () => {
  const lijst = [...boeken, { titel: 'E', auteurs: ['Jan'], status: 'Gestopt', leesdata: ['2026-05-01'] }];
  const r = jaarRapport(lijst, '2026');
  it('telt het jaar, zonder niet uitgelezen boeken', () => {
    expect(r.aantal).toBe(4);
    expect(r.vorigJaar).toBe(1);
    expect(r.perMaand.find((m) => m.maand === '2026-10').aantal).toBe(2);
    expect(r.drukste.maand).toBe('2026-10');
  });
  it('vindt beste boeken, nieuwe schrijvers en het langste boek', () => {
    expect(r.beste[0].titel).toBe('A');
    expect(r.vijfSterren.map((b) => b.titel)).toEqual(['A']);
    expect(r.nieuweSchrijvers.sort()).toEqual(['Jan', 'Piet']);
    expect(r.langste).toEqual({ titel: 'A', paginas: 300 });
  });
  it('kiest in december dit jaar en in januari het vorige', () => {
    expect(terugblikJaar(new Date(2026, 11, 3))).toBe('2026');
    expect(terugblikJaar(new Date(2027, 0, 20))).toBe('2026');
    expect(terugblikJaar(new Date(2026, 5, 1))).toBe('');
    expect(jarenMetLezen(boeken)).toEqual(['2026', '2025']);
    expect(jaarOpdracht(r)).toContain('leesjaar 2026');
  });
  it('bewaart een jaarverhaal ook in de backup', () => {
    expect(schoneRapporten({ 2026: { tekst: 'Mooi jaar', gemaakt: 'x' } })).toEqual({ 2026: { tekst: 'Mooi jaar', gemaakt: 'x' } });
  });
});

import { schoneLeesdoelen } from '../src/backup.js';

describe('leesdoel in de backup', () => {
  it('houdt alleen geldige jaren met een redelijk aantal', () => {
    expect(schoneLeesdoelen({ 2026: 25, 2027: 0, x: 3, 2028: 2.5, 2025: 12 })).toEqual({ 2025: 12, 2026: 25 });
    expect(schoneLeesdoelen(null)).toEqual({});
  });
});
