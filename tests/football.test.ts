import { describe, expect, it } from 'vitest';
import {
  parseCbfStandings,
  parseGeStandings,
} from '../src/modules/football/standings.js';
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

function cbfHtml(count = 20) {
  const rows = Array.from(
    { length: count },
    (_, index) => `
      <tr>
        <td><strong>${index + 1}</strong><span>0</span><a href="/time/${index}">Time ${index}</a></td>
        <td>18</td><td>10</td><td>5</td><td>3</td><td>2</td>
        <td>12</td><td>7</td><td>5</td><td>10</td><td>1</td><td>60</td>
      </tr>`,
  ).join('');
  return `<html><body><table><tbody>${rows}</tbody></table></body></html>`;
}

function geHtml(count = 20) {
  const payload = {
    classificacao: Array.from({ length: count }, (_, index) => ({
      ordem: index + 1,
      nome_popular: `Time ${index}`,
      pontos: 18,
      jogos: 10,
      vitorias: 5,
      empates: 3,
      derrotas: 2,
      gols_pro: 12,
      gols_contra: 7,
      saldo_gols: 5,
    })),
  };
  return `<script type="text/javascript" id="scriptReact">const classificacao = ${JSON.stringify(payload)};</script>`;
}

describe('Futebol', () => {
  it('extrai classificação da CBF', () => {
    const table = parseCbfStandings(cbfHtml());
    expect(table).toHaveLength(20);
    expect(table[0]).toMatchObject({
      position: 1,
      team: 'Time 0',
      played: 10,
      points: 18,
      difference: 5,
    });
  });

  it('extrai classificação do GE', () => {
    const table = parseGeStandings(geHtml());
    expect(table).toHaveLength(20);
    expect(table[19]).toMatchObject({
      position: 20,
      team: 'Time 19',
      points: 18,
    });
  });

  it('rejeita classificação incompleta ou duplicada', () => {
    expect(() => parseCbfStandings(cbfHtml(19))).toThrow();
    expect(() => parseGeStandings(geHtml(19))).toThrow();
    expect(() => parseCbfStandings(cbfHtml().replace('Time 19', 'Time 0'))).toThrow();
  });

  it('rejeita estatísticas inconsistentes', () => {
    expect(() => parseCbfStandings(cbfHtml().replace('<td>12</td><td>7</td><td>5</td>', '<td>12</td><td>7</td><td>6</td>'))).toThrow();
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
