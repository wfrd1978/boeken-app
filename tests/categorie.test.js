import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { leesCategorie, raadCategorie } from '../src/categorie.js';
import { leesExcel, planImport } from '../src/importeren.js';
import { normaliseerBoek } from '../src/db.js';

function excelBestand(rijen) {
  const werkmap = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(werkmap, XLSX.utils.aoa_to_sheet(rijen), 'Boeken');
  const inhoud = XLSX.write(werkmap, { bookType: 'xlsx', type: 'array' });
  return { arrayBuffer: async () => inhoud };
}

describe('categorie herkennen', () => {
  it('herkent de volledige naam en een kort woord', () => {
    expect(leesCategorie('Thriller & spanning')).toBe('Thriller & spanning');
    expect(leesCategorie('thriller')).toBe('Thriller & spanning');
    expect(leesCategorie('Biografie')).toBe('Biografie & levensverhaal');
    expect(leesCategorie('kookboek')).toBe('');
  });

  it('stelt de categorie van dezelfde schrijver voor, anders uit de onderwerpen', () => {
    const mijn = [
      { auteurs: ['David Baldacci'], categorie: 'Thriller & spanning' },
      { auteurs: ['Michel van Egmond'], categorie: 'Sport' },
    ];
    expect(raadCategorie({ auteurs: ['David Baldacci'], onderwerpen: ['History'] }, mijn)).toBe('Thriller & spanning');
    expect(raadCategorie({ auteurs: ['Onbekend'], onderwerpen: ['Biography & Autobiography'] }, mijn)).toBe('Biografie & levensverhaal');
    expect(raadCategorie({ auteurs: ['Onbekend'] }, mijn)).toBe('');
  });

  it('laat een onbekende categorie uit een backup leeg', () => {
    expect(normaliseerBoek({ titel: 'X', categorie: 'Sport' }).categorie).toBe('Sport');
    expect(normaliseerBoek({ titel: 'X', categorie: '<b>' }).categorie).toBe('');
  });
});

describe('indeellijst importeren', () => {
  const bestaand = [
    { id: 1, titel: 'Ik ben Pelgrim', auteurs: ['Terry Hayes'], categorie: '' },
    { id: 2, titel: 'Inferno', auteurs: ['Dan Brown'], categorie: 'Roman & humor' },
  ];

  it('vult alleen lege categorieën aan en voegt niets toe', async () => {
    const nieuw = await leesExcel(
      excelBestand([
        ['Auteur', 'Titel', 'Categorie'],
        ['Terry Hayes', 'Ik ben Pelgrim', 'Thriller & spanning'],
        ['Dan Brown', 'Inferno', 'Thriller & spanning'],
        ['Robert Harris', 'Vaderland', 'Thriller & spanning'],
      ])
    );
    expect(nieuw.alleenIndelen).toBe(true);
    const { toevoegen, bijwerken, overslaan, nietGevonden } = planImport(nieuw, bestaand);
    expect(bijwerken).toEqual([expect.objectContaining({ wijzigingen: { categorie: 'Thriller & spanning' } })]);
    expect(bijwerken[0].al.id).toBe(1);
    expect(overslaan).toHaveLength(1);
    expect(toevoegen).toHaveLength(0);
    expect(nietGevonden.map((b) => b.titel)).toEqual(['Vaderland']);
  });

  it('een gewone lijst met categorie voegt nieuwe boeken wel toe', async () => {
    const nieuw = await leesExcel(
      excelBestand([
        ['Auteur', 'Titel', 'Status', 'Categorie'],
        ['Robert Harris', 'Vaderland', 'Gelezen', 'thriller'],
      ])
    );
    expect(nieuw.alleenIndelen).toBe(false);
    expect(planImport(nieuw, bestaand).toevoegen[0].categorie).toBe('Thriller & spanning');
  });
});
