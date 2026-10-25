import { describe, expect, it } from 'vitest';
import { filmsVoorBoek, leesFilms, wikiNaarInfo, zinnenUitExtract } from '../src/schrijver.js';

describe('Over de schrijver', () => {
  it('neemt alleen een pagina over een schrijver', () => {
    const pagina = { title: 'Dan Brown', description: 'Amerikaans schrijver', extract: 'Dan Brown is een Amerikaanse schrijver.', thumbnail: { source: 'https://upload.wikimedia.org/x.jpg' }, content_urls: { mobile: { page: 'https://nl.m.wikipedia.org/wiki/Dan_Brown' } } };
    expect(wikiNaarInfo(pagina, 'nl')).toMatchObject({ naam: 'Dan Brown', foto: 'https://upload.wikimedia.org/x.jpg' });
    expect(wikiNaarInfo({ ...pagina, description: 'Amerikaans voetballer', extract: 'Een voetballer.' }, 'nl')).toBe(null);
    expect(wikiNaarInfo({ ...pagina, type: 'disambiguation' }, 'nl')).toBe(null);
    expect(wikiNaarInfo({ ...pagina, thumbnail: { source: 'javascript:alert(1)' } }, 'nl').foto).toBe('');
  });
  it('vat films samen en koppelt ze aan het boek', () => {
    const v = (x) => ({ value: x });
    const films = leesFilms([
      { werkNl: v('De Da Vinci Code'), werkEn: v('The Da Vinci Code'), filmEn: v('The Da Vinci Code'), jaar: v('2006') },
      { werkEn: v('The Keeper of Lost Causes'), filmNl: v('De vrouw in de kooi'), jaar: v('2014') },
      { werkEn: v('City of Bones'), filmEn: v('Bosch, season 1'), jaar: v('2014') },
      { werkEn: v('The Black Echo'), filmEn: v('Bosch, season 3'), jaar: v('2017') },
    ]);
    expect(films.find((f) => f.titel === 'Bosch')).toMatchObject({ jaar: 2014, serie: true });
    expect(filmsVoorBoek({ titel: 'De Da Vinci Code' }, films).map((f) => f.titel)).toEqual(['The Da Vinci Code']);
    expect(filmsVoorBoek({ titel: 'De vrouw in de kooi' }, films, ['Kvinden i buret', 'The Keeper of Lost Causes'])[0].titel).toBe('De vrouw in de kooi');
    expect(filmsVoorBoek({ titel: 'Inferno' }, films)).toEqual([]);
  });
});

describe('Langere tekst over de schrijver', () => {
  it('haalt kopjes weg en zet alinea\'s achter elkaar', () => {
    expect(zinnenUitExtract('James B. Patterson is een Amerikaans auteur.\n\n\nBiografie\nPatterson werkte in de reclame. Hij schreef meer dan 200 boeken.')).toBe(
      'James B. Patterson is een Amerikaans auteur. Patterson werkte in de reclame. Hij schreef meer dan 200 boeken.'
    );
    expect(zinnenUitExtract('Eerste zin.\n== Leven ==\nTweede zin.')).toBe('Eerste zin. Tweede zin.');
    expect(zinnenUitExtract(undefined)).toBe('');
  });
});
