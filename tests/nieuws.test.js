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

import { normaliseerBericht } from '../src/nieuws.js';

describe('nieuwsberichten controleren', () => {
  it('houdt een goed bericht met artikel, en weigert berichten zonder https-bron', () => {
    const b = normaliseerBericht({ id: 'a', titel: ' Kop ', url: 'https://x.nl/a', artikel: ['Eén.', '', 'Twee.'], datum: '2026-10-25' });
    expect(b).toMatchObject({ titel: 'Kop', artikel: ['Eén.', 'Twee.'], datum: '2026-10-25', schrijvers: [] });
    expect(normaliseerBericht({ id: 'b', titel: 'Kop', url: 'javascript:alert(1)' })).toBeNull();
    expect(normaliseerBericht({ id: 'c', titel: 'Kop', url: 'http://x.nl' })).toBeNull();
    expect(normaliseerBericht({ id: 'd', titel: 'Kop', url: 'https://x.nl', artikel: 'Een.\n\nTwee.' }).artikel).toEqual(['Een.', 'Twee.']);
  });
});
