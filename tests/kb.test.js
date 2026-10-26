import { describe, expect, it } from 'vitest';
import { kandidaten, kbNaarBoek } from '../src/kb.js';

describe('Koninklijke Bibliotheek', () => {
  it('maakt van de zoektekst mogelijke titels en schrijvers', () => {
    const { titels, namen } = kandidaten('frits spits mijn laatste radiojaar');
    expect(titels).toContain('Mijn laatste radiojaar');
    expect(namen).toContain('Frits Spits');
    expect(kandidaten('michel van egmond').namen).toContain('Michel van Egmond');
    expect(kandidaten('President vermist').titels).toContain('President vermist');
  });

  it('haalt de schrijvers uit de beschrijving en negeert rare paginagetallen', () => {
    const boek = kbNaarBoek({
      titel: 'Alles lijkt zoals het was : nieuwe standaards',
      label: 'President vermist / Bill Clinton & James Patterson ; vertaald [uit het Engels] door André Haacke',
      isbn: '9789046824092',
      paginas: '2117599',
      uitgever: 'Uitgeverij Luitingh-Sijthoff',
      jaar: '2018',
      auteur: 'William Jefferson Clinton',
    });
    expect(boek).toMatchObject({
      titel: 'Alles lijkt zoals het was: nieuwe standaards',
      auteurs: ['Bill Clinton', 'James Patterson'],
      paginas: null,
      uitgever: 'Luitingh-Sijthoff',
      jaar: 2018,
      taal: 'nl',
    });
  });
});

import { googleId, lijktNederlands } from '../src/zoeken.js';

describe('Synopsis zonder Google-zoeken', () => {
  it('haalt het Google-nummer uit een cover', () => {
    expect(googleId('https://books.google.com/books/content?id=zyTCAlFPjgYC&printsec=frontcover&img=1&zoom=1')).toBe('zyTCAlFPjgYC');
    expect(googleId('https://covers.openlibrary.org/b/id/1-M.jpg')).toBe('');
    expect(googleId('')).toBe('');
  });
  it('herkent Nederlandse tekst', () => {
    expect(lijktNederlands('Wanneer een bekende expert overlijdt tijdens een conferentie, is het voor de club gedaan met de rust. Het spoor leidt naar Amsterdam en de leden van de club moeten opnieuw in actie komen.')).toBe(true);
    expect(lijktNederlands('When a renowned expert dies during a conference, the club is drawn back into the world of espionage and the trail leads to Amsterdam where he was last seen.')).toBe(false);
  });
});
