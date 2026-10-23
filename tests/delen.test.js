import { describe, expect, it } from 'vitest';
import { deelTekst, bolZoekUrl, OPENING } from '../src/delen.js';

describe('boek delen', () => {
  const pelgrim = {
    titel: 'Ik ben Pelgrim',
    auteurs: ['Terry Hayes'],
    isbn: '9789021807140',
    status: 'Gelezen',
    sterren: 4,
    categorie: 'Thriller & spanning',
    recensie: 'Spannend tot de laatste bladzijde! Wel erg lang.',
    synopsis: 'Een geheim agent jaagt op een terrorist.',
  };

  it('gelezen: opening, categorie, sterren, recensie, synopsis en winkels', () => {
    const tekst = deelTekst(pelgrim);
    expect(tekst.startsWith(`${OPENING}\n\nIk ben Pelgrim, van Terry Hayes\nThriller & spanning · ★★★★☆`)).toBe(true);
    expect(tekst).toContain('Wat ik ervan vond:\n"Spannend tot de laatste bladzijde! Wel erg lang."');
    expect(tekst).toContain('Waar het over gaat:\nEen geheim agent jaagt op een terrorist.');
    expect(tekst).toContain('Kobo: https://www.kobo.com/nl/nl/search?query=Ik%20ben%20Pelgrim%20Terry%20Hayes');
    expect(tekst).toContain('Bol.com: https://www.bol.com/nl/nl/s/?searchtext=9789021807140');
  });

  it('wil ik lezen: geen sterren of recensie, wel de leeslijst', () => {
    const tekst = deelTekst({ ...pelgrim, status: 'Wil ik lezen' });
    expect(tekst).toContain('Het staat op mijn leeslijst.');
    expect(tekst).not.toContain('★');
    expect(tekst).not.toContain('Wat ik ervan vond');
  });

  it('kort een lange synopsis af op een hele zin', () => {
    const lang = 'Dit is een zin. '.repeat(40);
    const stuk = deelTekst({ titel: 'X', auteurs: [], status: 'Gelezen', synopsis: lang }).split('Waar het over gaat:\n')[1].split('\n\n')[0];
    expect(stuk.length).toBeLessThanOrEqual(350);
    expect(stuk.endsWith('.')).toBe(true);
  });

  it('zoekt bij bol.com op titel en auteur als er geen ISBN is', () => {
    expect(bolZoekUrl({ titel: 'Vaderland', auteurs: ['Robert Harris'] })).toBe('https://www.bol.com/nl/nl/s/?searchtext=Vaderland%20Robert%20Harris');
  });
});
