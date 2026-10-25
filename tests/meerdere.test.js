import { describe, expect, it } from 'vitest';
import { leesRegels, lijktNaam, ordenOpPassend } from '../src/meerdere.js';

describe('Meerdere boeken tegelijk', () => {
  it('herkent namen', () => {
    expect(lijktNaam('Jussi Adler-Olsen')).toBe(true);
    expect(lijktNaam('Michel van Egmond')).toBe(true);
    expect(lijktNaam('De vrouw in de kooi')).toBe(false);
  });
  it('leest een geplakt rijtje en een bibliotheekscherm', () => {
    const regels = leesRegels(`De vrouw in de kooi
Jussi Adler-Olsen
42% gelezen
Inferno – Dan Brown
Sekte door Mariëtte Lindstein

Kind 44
Kind 44`);
    expect(regels).toEqual([
      { titel: 'De vrouw in de kooi', auteur: 'Jussi Adler-Olsen' },
      { titel: 'Inferno', auteur: 'Dan Brown' },
      { titel: 'Sekte', auteur: 'Mariëtte Lindstein' },
      { titel: 'Kind 44', auteur: '' },
    ]);
  });
  it('kiest het best passende resultaat', () => {
    const resultaten = [
      { titel: 'Inferno: a novel', auteurs: ['Dan Brown'], taal: 'en' },
      { titel: 'Dante en de Inferno', auteurs: ['Iemand'], taal: 'nl' },
      { titel: 'Inferno', auteurs: ['Dan Brown'], taal: 'nl', coverUrl: 'x' },
    ];
    expect(ordenOpPassend({ titel: 'Inferno', auteur: 'Dan Brown' }, resultaten)[0]).toBe(resultaten[2]);
  });
});
