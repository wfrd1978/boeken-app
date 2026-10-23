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

import { veilig, veiligeUrl } from '../src/veilig.js';
import { normaliseerBoek } from '../src/db.js';

describe('veilig weergeven', () => {
  it('schermt ook aanhalingstekens af', () => {
    expect(veilig(`Wil "Fred" 't <b>`)).toBe('Wil &quot;Fred&quot; &#39;t &lt;b&gt;');
  });
  it('laat alleen veilige adressen door als cover', () => {
    expect(veiligeUrl('https://covers.openlibrary.org/b/id/1-M.jpg')).toBeTruthy();
    expect(veiligeUrl('blob:https://x/1')).toBeTruthy();
    expect(veiligeUrl('javascript:alert(1)')).toBe('');
    expect(veiligeUrl('x" onerror="alert(1)')).toBe('');
  });
});

describe('boeken uit een backup controleren', () => {
  it('weigert een boek zonder titel', () => {
    expect(() => normaliseerBoek({ auteurs: ['X'] })).toThrow(/titel/);
  });
  it('maakt verkeerde gegevens leeg en houdt goede gegevens', () => {
    const b = normaliseerBoek({
      id: 7, titel: 'Vaderland', auteurs: ['Robert Harris', 5], sterren: '<img src=x>', leesdata: ['2025-10', 'kapot'],
      status: 'Iets', toegevoegdOp: 'geen datum', onbekend: 'weg', synopsis: 'Tekst', koboWacht: 'ja',
    });
    expect(b).toMatchObject({ id: 7, titel: 'Vaderland', auteurs: ['Robert Harris'], sterren: null, leesdata: ['2025-10'], status: 'Wil ik lezen', synopsis: 'Tekst', koboWacht: false });
    expect(b.onbekend).toBeUndefined();
    expect(Date.parse(b.toegevoegdOp)).not.toBeNaN();
  });
  it('laat een ontbrekende synopsis open, zodat hij later wordt opgehaald', () => {
    expect(normaliseerBoek({ titel: 'X' }).synopsis).toBeUndefined();
  });
});
