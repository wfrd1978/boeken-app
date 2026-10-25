import { describe, expect, it } from 'vitest';
import { delenInLijst, leesDeel, reeksTekst } from '../src/reeks.js';

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
