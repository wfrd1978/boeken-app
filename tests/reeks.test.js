import { describe, expect, it } from 'vitest';
import { delenInLijst, herkenReeks, leesDeel, normaliseerReeks, reeksTekst, volgendDeel } from '../src/reeks.js';

describe('Reeksen', () => {
  it('leest een deelnummer', () => {
    expect(leesDeel('3')).toBe(3);
    expect(leesDeel('deel 12')).toBe(12);
    expect(leesDeel(4)).toBe(4);
    expect(leesDeel('')).toBe(null);
    expect(leesDeel('2,5')).toBe(null);
  });
  it('maakt een korte regel', () => {
    expect(reeksTekst({ reeks: 'Harry Bosch', reeksDeel: 26, reeksTotaal: 27 })).toBe('Harry Bosch · deel 26 van 27');
    expect(reeksTekst({ reeks: 'Afdeling Q', reeksDeel: 1 })).toBe('Afdeling Q · deel 1');
    expect(reeksTekst({ reeks: '' })).toBe('');
  });
  it('zet de delen uit de lijst op volgorde', () => {
    const boeken = [
      { id: 1, titel: 'C', reeks: 'Afdeling Q', reeksDeel: 3 },
      { id: 2, titel: 'A', reeks: 'afdeling q', reeksDeel: 1 },
      { id: 3, titel: 'X', reeks: 'Iets anders', reeksDeel: 2 },
    ];
    expect(delenInLijst(boeken[0], boeken).map((b) => b.id)).toEqual([2, 1]);
  });
});

describe('Reekslijst', () => {
  const lijst = [
    { naam: 'Afdeling Q', schrijvers: ['Jussi Adler-Olsen'], delen: [{ deel: 1, titels: ['De vrouw in de kooi', 'Kvinden i buret'] }, { deel: 2, titels: ['Fazantenmoordenaars'] }, { deel: 3, titels: ['Het bericht in de fles'] }], volgende: '' },
    { naam: 'Kapot', schrijvers: [], delen: [] },
  ]
    .map(normaliseerReeks)
    .filter(Boolean);
  it('houdt alleen geldige reeksen over', () => {
    expect(lijst).toHaveLength(1);
  });
  it('herkent een boek op titel en schrijver', () => {
    expect(herkenReeks({ titel: 'De vrouw in de kooi', auteurs: ['Jussi Adler-Olsen'] }, lijst)).toMatchObject({ reeks: 'Afdeling Q', reeksDeel: 1, reeksTotaal: 3 });
    expect(herkenReeks({ titel: 'Vrouw in de kooi', auteurs: ['Adler-Olsen, Jussi'] }, lijst)).toBe(null);
    expect(herkenReeks({ titel: 'De vrouw in de kooi', auteurs: ['Iemand Anders'] }, lijst)).toBe(null);
  });
  it('noemt het eerstvolgende deel dat nog niet in je lijst staat', () => {
    const boeken = [{ id: 1, titel: 'De vrouw in de kooi', reeks: 'Afdeling Q', reeksDeel: 1 }, { id: 2, titel: 'Fazantenmoordenaars', reeks: 'Afdeling Q', reeksDeel: 2 }];
    expect(volgendDeel(boeken[0], lijst[0], boeken)?.deel).toBe(3);
  });
});

describe('Reekslijst zonder schrijver', () => {
  it('herkent geen boek op alleen de titel', () => {
    const lijst = [normaliseerReeks({ naam: 'Robert Langdon', schrijvers: ['Dan Brown'], delen: [{ deel: 4, titels: ['Inferno'] }] })];
    expect(herkenReeks({ titel: 'Inferno', auteurs: [] }, lijst)).toBe(null);
    expect(herkenReeks({ titel: 'Inferno', auteurs: ['Dan Brown'] }, lijst)).toMatchObject({ reeksDeel: 4 });
  });
});
