import { describe, expect, it } from 'vitest';
import { parseStandings } from '../src/modules/football/standings.js';
import { goalChange, scoreFor } from '../src/modules/football/goals.js';
import { parseMatches, type Match } from '../src/modules/football/provider.js';
const match: Match = {
  id: '1',
  date: '2026-09-12T01:00:00Z',
  state: 'in',
  clock: '30',
  home: { id: '2026', name: 'São Paulo', score: 1 },
  away: { id: '1', name: 'Outro', score: 0 },
};
function html() {
  const names = Array.from(
    { length: 20 },
    (_, i) =>
      `<tr data-idx="${i}"><td><span class="team-position">${i + 1}</span><abbr title="Time ${i}">T</abbr></td></tr>`,
  ).join('');
  const values = Array.from(
    { length: 20 },
    (_, i) =>
      `<tr data-idx="${i}">${[10, 5, 3, 2, 12, 7, 5, 18].map((n) => `<td><span class="stat-cell">${n}</span></td>`).join('')}</tr>`,
  ).join('');
  return `<table><tbody>${names}</tbody></table><table><thead><tr>${['J', 'V', 'E', 'D', 'GP', 'GC', 'SG', 'PTS'].map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${values}</tbody></table>`;
}
describe('Futebol', () => {
  it('extrai classificação HTML usando regex e valida colunas', () => {
    const table = parseStandings(html());
    expect(table).toHaveLength(20);
    expect(table[0]).toMatchObject({
      position: 1,
      played: 10,
      points: 18,
      difference: 5,
    });
  });
  it('rejeita HTML alterado, incompleto e colunas trocadas', () => {
    expect(() => parseStandings('<html>erro</html>')).toThrow();
    expect(() =>
      parseStandings(html().replace('<th>V</th>', '<th>E</th>')),
    ).toThrow();
    expect(() => parseStandings(html().replace('Time 19', 'Time 0'))).toThrow();
  });
  it('separa gol, gol adversário, repetição e correção', () => {
    expect(goalChange({ own: 0, other: 0 }, { own: 1, other: 0 })).toBe('goal');
    expect(goalChange({ own: 1, other: 0 }, { own: 1, other: 0 })).toBeNull();
    expect(goalChange({ own: 1, other: 0 }, { own: 1, other: 1 })).toBeNull();
    expect(goalChange({ own: 1, other: 0 }, { own: 0, other: 0 })).toBe(
      'correction',
    );
  });
  it('reconhece o time mandante e visitante', () => {
    expect(scoreFor(match, '2026')).toEqual({ own: 1, other: 0 });
    expect(scoreFor(match, '1')).toEqual({ own: 0, other: 1 });
    expect(scoreFor(match, 'missing')).toBeNull();
  });
  it('rejeita score inválido sem substituir por zero', () => {
    expect(() => parseMatches({ events: [{ id: 'x' }] })).toThrow();
    expect(parseMatches({ events: [] })).toEqual([]);
  });
});
