import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { leesExcel, planImport } from '../src/importeren.js';

function excelBestand(rijen) {
  const werkmap = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(werkmap, XLSX.utils.aoa_to_sheet(rijen), 'Boeken');
  const inhoud = XLSX.write(werkmap, { bookType: 'xlsx', type: 'array' });
  return { arrayBuffer: async () => inhoud };
}

describe('Excel inlezen', () => {
  it('leest kolommen, maanddatums, sterren, meerdere auteurs en Kobo-label', async () => {
    const boeken = await leesExcel(
      excelBestand([
        ['Auteur', 'Titel', 'Gelezen (maand)', 'Sterren', 'Opmerking', 'Status'],
        ['Marcel van de Ven & Willem Asman', 'De prijs', 'oktober 2025', 3, '', ''],
        ['Ingar Johnsrud', 'Infiltrant', '', '', 'Jens Meidel 2 · Kobo Plus: nee', 'Wil ik lezen'],
        ['', '', '', '', '', ''],
        ['Michael Connelly', 'De dichter', '14-10-2026', '****', '', 'aan het lezen'],
      ])
    );
    expect(boeken).toHaveLength(3);
    expect(boeken[0]).toMatchObject({ auteurs: ['Marcel van de Ven', 'Willem Asman'], leesdata: ['2025-10'], sterren: 3, status: 'Gelezen' });
    expect(boeken[1]).toMatchObject({ status: 'Wil ik lezen', koboWacht: true, opmerking: 'Jens Meidel 2' });
    expect(boeken[2]).toMatchObject({ leesdata: ['2026-10-14'], sterren: 4, status: 'Bezig' });
  });

  it('bewaart geen leesdatum die niet bestaat', async () => {
    const boeken = await leesExcel(
      excelBestand([
        ['Auteur', 'Titel', 'Gelezen (maand)'],
        ['A', 'Een', '31-2-2025'],
        ['B', 'Twee', '1/13/2025'],
        ['C', 'Drie', '28-2-2025'],
      ])
    );
    expect(boeken.map((b) => b.leesdata)).toEqual([[], [], ['2025-02-28']]);
  });

  it('geeft een duidelijke fout zonder kolom Titel', async () => {
    await expect(leesExcel(excelBestand([['Naam'], ['iets']]))).rejects.toThrow(/Titel/);
  });
});

describe('import plannen', () => {
  const bestaand = [
    { id: 1, titel: 'Ik ben Pelgrim', auteurs: ['Terry Hayes'], sterren: null },
    { id: 2, titel: 'Inferno', auteurs: ['Dan Brown'], sterren: 3 },
  ];
  it('vult alleen ontbrekende sterren aan en slaat de rest over', () => {
    const { toevoegen, bijwerken, overslaan } = planImport(
      [
        { titel: 'Ik ben Pelgrim', auteurs: ['Terry Hayes'], sterren: 5 },
        { titel: 'Inferno', auteurs: ['Dan Brown'], sterren: 5 },
        { titel: 'Vaderland', auteurs: ['Robert Harris'], sterren: null },
        { titel: 'Vaderland', auteurs: ['Robert Harris'], sterren: null },
      ],
      bestaand
    );
    expect(bijwerken.map((b) => b.al.id)).toEqual([1]);
    expect(toevoegen.map((b) => b.titel)).toEqual(['Vaderland']);
    expect(overslaan).toHaveLength(2);
  });
});
