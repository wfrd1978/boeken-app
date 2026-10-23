import { describe, expect, it } from 'vitest';
import { ordenTips, smaak } from '../src/tips.js';

describe('tips ordenen naar smaak', () => {
  const tips = [
    { id: 'a', categorie: 'Roman & humor', soort: 'nieuw' },
    { id: 'b', categorie: 'Sport', soort: 'nieuw' },
    { id: 'c', categorie: 'Thriller & spanning', soort: 'parel' },
    { id: 'd', categorie: 'Sport', soort: 'parel' },
  ];

  it('zet categorieën die je toevoegde bovenaan en die je afwees onderaan', () => {
    const score = smaak({
      x: { reactie: 'wil', categorie: 'Sport', soort: 'nieuw' },
      y: { reactie: 'nee', categorie: 'Roman & humor', soort: 'nieuw' },
    });
    expect(ordenTips(tips, score).map((t) => t.id)).toEqual(['b', 'd', 'c', 'a']);
  });

  it('zonder reacties blijft de volgorde gelijk', () => {
    expect(ordenTips(tips, smaak({})).map((t) => t.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('vijfsterrenboeken tellen licht mee', () => {
    const score = smaak({}, [{ sterren: 5, categorie: 'Thriller & spanning' }]);
    expect(ordenTips(tips, score)[0].id).toBe('c');
  });
});
