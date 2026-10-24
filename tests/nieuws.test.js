import { describe, expect, it } from 'vitest';
import { overMijnSchrijver, ordenNieuws } from '../src/nieuws.js';

describe('boekennieuws', () => {
  const boeken = [{ auteurs: ['Michael Berg'] }, { auteurs: ['Tess Gerritsen'] }];
  const berichten = [
    { id: 'a', datum: '2026-10-20', schrijvers: [] },
    { id: 'b', datum: '2026-05-12', schrijvers: ['Michael Berg'] },
    { id: 'c', datum: '2026-10-22', schrijvers: ['Iemand Anders'] },
  ];

  it('herkent schrijvers uit je eigen lijst, ook met andere hoofdletters', () => {
    expect(overMijnSchrijver({ schrijvers: ['michael berg'] }, boeken)).toBe(true);
    expect(overMijnSchrijver({ schrijvers: [] }, boeken)).toBe(false);
  });

  it('zet nieuws over je eigen schrijvers eerst, daarna het nieuwste', () => {
    expect(ordenNieuws(berichten, boeken).map((b) => b.id)).toEqual(['b', 'c', 'a']);
  });
});
