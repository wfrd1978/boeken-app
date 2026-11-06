import { describe, expect, it } from 'vitest';
import { naarHsl, sfeerKleur } from '../src/kleur.js';

const pixels = (...kleuren) => Uint8ClampedArray.from(kleuren.flatMap(([r, g, b]) => [r, g, b, 255]));

describe('kleur uit de cover', () => {
  it('rekent rgb om naar tint, verzadiging en helderheid', () => {
    expect(naarHsl(255, 0, 0)).toEqual([0, 1, 0.5]);
    expect(naarHsl(128, 128, 128)[1]).toBe(0);
  });
  it('kiest de kleurrijke tint, niet het wit en zwart', () => {
    const k = sfeerKleur(pixels([20, 60, 200], [255, 255, 255], [0, 0, 0], [30, 70, 210]));
    expect(k.donker).toMatch(/^hsl\(22\d /);
    expect(k.donker).toContain('16%)');
  });
  it('geeft niets bij een volkomen grijze cover', () => {
    expect(sfeerKleur(pixels([255, 255, 255], [10, 10, 10]))).toBeNull();
  });
});
