import { describe, it, expect } from 'vitest';
import { isKoboLink, titelUitKoboLink } from '../src/kobolink.js';

describe('Kobo-link', () => {
  it('haalt de titel uit de link', () => {
    expect(titelUitKoboLink('https://www.kobo.com/nl/nl/ebook/de-prijs-3')).toBe('De prijs');
    expect(titelUitKoboLink('https://www.kobo.com/nl/nl/ebook/mijn-laatste-radiojaar?sId=abc')).toBe('Mijn laatste radiojaar');
  });
  it('laat een jaartal in de titel staan', () => {
    expect(titelUitKoboLink('https://www.kobo.com/nl/nl/ebook/claude-ai-beheersing-2026')).toBe('Claude ai beheersing 2026');
  });
  it('gebruikt de titel tussen aanhalingstekens uit de gedeelde tekst', () => {
    expect(titelUitKoboLink('Bekijk “Het goud van Seyss-Inquart” op Kobo: https://www.kobo.com/nl/nl/ebook/het-goud-van-seyss-inquart')).toBe(
      'Het goud van Seyss-Inquart'
    );
  });
  it('herkent geen gewone zoekterm als link', () => {
    expect(isKoboLink('Frits Spits')).toBe(false);
    expect(titelUitKoboLink('https://www.kobo.com/nl/nl')).toBe('');
  });
});
