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

function standingsPayload() {
  return {
    standings: [
      {
        type: 'total',
        rows: Array.from({ length: 20 }, (_, i) => ({
          team: { name: `Time ${i}` },
          position: i + 1,
          matches: 10,
          wins: 5,
          draws: 3,
          losses: 2,
          scoresFor: 12,
          scoresAgainst: 7,
          points: 18,
        })),
      },
    ],
  };
}

describe('Futebol', () => {
  it('extrai classificação da API JSON do Sofascore', () => {
    const table = parseStandings(JSON.stringify(standingsPayload()));
    expect(table).toHaveLength(20);
    expect(table[0]).toMatchObject({
      position: 1,
      team: 'Time 0',
      played: 10,
      points: 18,
      difference: 5,
    });
  });

  it('rejeita classificação alterada, incompleta ou duplicada', () => {
    expect(() => parseStandings('{}')).toThrow();

    const incomplete = standingsPayload();
    incomplete.standings[0]!.rows.pop();
    expect(() => parseStandings(incomplete)).toThrow();

    const duplicate = standingsPayload();
    duplicate.standings[0]!.rows[19]!.team.name = 'Time 0';
    expect(() => parseStandings(duplicate)).toThrow();
  });

  it('calcula saldo de gols a partir dos placares', () => {
    const payload = standingsPayload();
    payload.standings[0]!.rows[0]!.scoresFor = 20;
    payload.standings[0]!.rows[0]!.scoresAgainst = 9;
    expect(parseStandings(payload)[0]!.difference).toBe(11);
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
