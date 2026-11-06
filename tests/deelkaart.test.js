import { describe, expect, it } from 'vitest';
import { kaartZin, kaartVoet } from '../src/deelkaart.js';

describe('deelkaart', () => {
  it('neemt de eerste zin van de recensie', () => {
    expect(kaartZin('Wat een boek. Echt waar.')).toBe('Wat een boek.');
    expect(kaartZin('')).toBe('');
  });
  it('zegt onderaan wanneer gelezen of dat je het leest', () => {
    expect(kaartVoet({ status: 'Gelezen', leesdata: ['2025-03-01', '2026-10-12'] })).toBe('Gelezen in oktober 2026');
    expect(kaartVoet({ status: 'Bezig' })).toBe('Nu aan het lezen');
    expect(kaartVoet({ status: 'Gestopt' })).toBe('');
  });
});
