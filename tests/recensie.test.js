import { describe, expect, it } from 'vitest';
import { recensieOpdracht, claudeAdres } from '../src/recensie.js';

describe('recensiehulp', () => {
  it('zet titel, sterren, steekwoorden en eigen woorden in de opdracht', () => {
    const tekst = recensieOpdracht({
      boek: { titel: 'Ik ben Pelgrim', auteurs: ['Terry Hayes'], sterren: 5, recensie: '' },
      woorden: ['Spannend', 'Te lang'],
      eigen: 'las hem in een week',
    });
    expect(tekst).toContain('"Ik ben Pelgrim" van Terry Hayes');
    expect(tekst).toContain('5 van de 5 sterren');
    expect(tekst).toContain('spannend, te lang');
    expect(tekst).toContain('las hem in een week');
    expect(tekst).toContain('twee of drie zinnen');
    expect(tekst).not.toContain('Wat ik zelf al schreef');
  });

  it('gebruikt een bestaande recensie als basis en maakt een veilig adres', () => {
    const tekst = recensieOpdracht({ boek: { titel: 'X & Y', auteurs: [], recensie: 'Mooi.' }, lengte: 'lang' });
    expect(tekst).toContain('Wat ik zelf al schreef (gebruik dit als basis): Mooi.');
    expect(tekst).toContain('één alinea');
    expect(claudeAdres(tekst)).toMatch(/^https:\/\/claude\.ai\/new\?q=[^&\s]+$/);
  });
});
