import { describe, expect, it } from 'vitest';
import { deelTekst } from '../src/delen.js';

describe('boek delen', () => {
  it('gelezen: titel, sterren en de eerste zin van de recensie', () => {
    const tekst = deelTekst({
      titel: 'Ik ben Pelgrim',
      auteurs: ['Terry Hayes'],
      status: 'Gelezen',
      sterren: 4,
      recensie: 'Spannend tot de laatste bladzijde! Wel erg lang.',
    });
    expect(tekst).toBe('Gelezen: Ik ben Pelgrim van Terry Hayes\n★★★★☆\n"Spannend tot de laatste bladzijde!"');
  });

  it('wil ik lezen: geen sterren of recensie', () => {
    expect(deelTekst({ titel: 'Vaderland', auteurs: ['Robert Harris'], status: 'Wil ik lezen', sterren: 5, recensie: 'x' })).toBe(
      'Op mijn leeslijst: Vaderland van Robert Harris'
    );
  });

  it('kort een lange zin netjes in', () => {
    const tekst = deelTekst({ titel: 'X', auteurs: [], status: 'Gelezen', recensie: 'a'.repeat(300) });
    expect(tekst.split('\n')[1]).toHaveLength(202);
  });
});
