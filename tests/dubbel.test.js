import { describe, expect, it } from 'vitest';
import { vindDubbel, achternaam, kaal } from '../src/dubbel.js';

const boek = (titel, auteur, extra = {}) => ({ titel, auteurs: auteur ? [auteur] : [], ...extra });

describe('dubbele boeken herkennen', () => {
  it('herkent hetzelfde ISBN', () => {
    expect(vindDubbel(boek('A', 'X', { isbn: '978-90-254-4411-2' }), [boek('B', 'Y', { isbn: '9789025444112' })])).toBeTruthy();
  });

  it('herkent hetzelfde werk (vertaling)', () => {
    expect(vindDubbel(boek('De weg', 'Cormac McCarthy', { werk: '/works/1' }), [boek('The Road', 'Cormac McCarthy', { werk: '/works/1' })])).toBeTruthy();
  });

  it('negeert lidwoorden, hoofdletters en leestekens', () => {
    expect(vindDubbel(boek('The Da Vinci Code', 'Dan Brown'), [boek('De Da Vinci code', 'Dan Brown')])).toBeTruthy();
  });

  it('negeert een ondertitel en kleine verschillen in de voornaam', () => {
    expect(vindDubbel(boek('Derksen: De biografie', 'Michel van Egmond'), [boek('Derksen', 'Michiel van Egmond')])).toBeTruthy();
  });

  it('ziet dezelfde titel van een andere schrijver niet als dubbel', () => {
    expect(vindDubbel(boek('De terugkeer', 'David Baldacci'), [boek('De terugkeer', 'Michel van Egmond')])).toBeFalsy();
  });

  it('ziet verschillende delen van een serie niet als dubbel', () => {
    const lijst = [boek('M', 'Anna Levander'), boek('Mo', 'Anna Levander')];
    expect(vindDubbel(boek('Morten', 'Anna Levander'), lijst)).toBeFalsy();
  });

  it('achternaam is het laatste woord van de eerste auteur', () => {
    expect(achternaam(boek('X', 'Michel van Egmond'))).toBe('egmond');
    expect(achternaam({ titel: 'X', auteurs: ['Peter Mohlin & Peter Nyström'] })).toBe('mohlin');
    expect(kaal('Ibrahimović')).toBe('ibrahimovic');
  });
});
