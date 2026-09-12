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
    children: [
      {
        name: 'Classificação',
        standings: {
          entries: Array.from({ length: 20 }, (_, i) => ({
            team: { displayName: `Time ${i}` },
            stats: [
              { name: 'gamesPlayed', value: 10 },
              { name: 'wins', value: 5 },
              { name: 'ties', value: 3 },
              { name: 'losses', value: 2 },
              { name: 'goalsFor', value: 12 },
              { name: 'goalsAgainst', value: 7 },
              { name: 'goalDifference', value: 5 },
              { name: 'points', value: 18 },
              { name: 'rank', value: i + 1 },
            ],
          })),
        },
      },
    ],
  };
}

describe('Futebol', () => {
  it('extrai classificação da API JSON da ESPN', () => {
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
    incomplete.children[0]!.standings.entries.pop();
    expect(() => parseStandings(incomplete)).toThrow();

    const duplicate = standingsPayload();
    duplicate.children[0]!.standings.entries[19]!.team.displayName =
      'Time 0';
    expect(() => parseStandings(duplicate)).toThrow();
  });

  it('aceita differential como fallback para saldo de gols', () => {
    const payload = standingsPayload();
    const stats = payload.children[0]!.standings.entries[0]!.stats;
    const goalDifference = stats.find(
      (item) => item.name === 'goalDifference',
    )!;
    goalDifference.name = 'differential';
    expect(parseStandings(payload)[0]!.difference).toBe(5);
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
