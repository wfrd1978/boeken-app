import { describe, expect, it } from 'vitest';
import { leesKoboOpmerking, koboZoekUrl } from '../src/kobo.js';
import { geldigIsbn13 } from '../src/scanner.js';

describe('Kobo', () => {
  it('haalt "Kobo Plus: nee" uit de opmerking en houdt de serie', () => {
    expect(leesKoboOpmerking('Jens Meidel 2 · Kobo Plus: nee')).toEqual({ koboWacht: true, opmerking: 'Jens Meidel 2' });
    expect(leesKoboOpmerking('Kobo Plus: ja')).toEqual({ koboWacht: false, opmerking: '' });
    expect(leesKoboOpmerking('Amos Decker 1')).toBeNull();
  });

  it('maakt een zoekadres met titel en eerste auteur', () => {
    expect(koboZoekUrl({ titel: 'De dichter', auteurs: ['Michael Connelly'] })).toBe(
      'https://www.kobo.com/nl/nl/search?query=De%20dichter%20Michael%20Connelly'
    );
  });
});

describe('ISBN-controle', () => {
  it('accepteert een geldig ISBN-13', () => {
    expect(geldigIsbn13('9789025444112')).toBe(true);
  });
  it('weigert een fout controlecijfer of een andere streepjescode', () => {
    expect(geldigIsbn13('9789025444113')).toBe(false);
    expect(geldigIsbn13('8712345678906')).toBe(false);
  });
});
