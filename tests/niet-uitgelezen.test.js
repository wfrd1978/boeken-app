import { describe, expect, it } from 'vitest';
import { statusNaam } from '../src/db.js';
import { smaak, ordenTips } from '../src/tips.js';
import { berekenStatistieken } from '../src/statistieken.js';
import { maandRapport } from '../src/analyse.js';

const gestopt = { titel: 'X', auteurs: ['Jan Smit'], status: 'Gestopt', categorie: 'Sport', leesdata: ['2026-10-05'] };
const gelezen = { titel: 'Y', auteurs: ['Piet'], status: 'Gelezen', categorie: 'Sport', leesdata: ['2026-10-06'], sterren: 4 };

describe('niet uitgelezen', () => {
  it('heet zo in beeld, de opslag blijft Gestopt', () => {
    expect(statusNaam('Gestopt')).toBe('Niet uitgelezen');
  });
  it('telt niet mee als gelezen', () => {
    expect(berekenStatistieken([gestopt, gelezen], '2026-01', new Date(2026, 10, 6)).perMaand.find((m) => m.maand === '2026-10').aantal).toBe(1);
    expect(maandRapport([gestopt, gelezen], '2026-10').aantal).toBe(1);
  });
  it('zet tips van die schrijver achteraan', () => {
    const tips = [{ id: '1', titel: 'A', auteurs: ['Jan Smit'] }, { id: '2', titel: 'B', auteurs: ['Kees'] }];
    expect(ordenTips(tips, smaak({}, [gestopt])).map((t) => t.id)).toEqual(['2', '1']);
  });
});
