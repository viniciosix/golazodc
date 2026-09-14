import { expect, it } from 'vitest';
import { parseMatches } from '../src/modules/football/provider.js';
import { parseCommentary } from '../src/modules/football/commentary.js';
import { narrationText } from '../src/modules/football/narration.js';
function event(id = '100') {
  return {
    id,
    date: '2026-09-12T12:00:00Z',
    status: {
      displayClock: '45:00',
      type: { state: 'in', name: 'STATUS_HALFTIME', detail: 'Halftime' },
    },
    competitions: [
      {
        competitors: [
          {
            homeAway: 'home',
            score: '1',
            team: { id: '2026', displayName: 'São Paulo' },
          },
          {
            homeAway: 'away',
            score: '0',
            team: { id: '1', displayName: 'Outro' },
          },
        ],
      },
    ],
  };
}
it('preserva ID e placar na transição intervalo → segundo tempo', () => {
  const halftime = event();
  const second = {
    ...halftime,
    status: {
      displayClock: null,
      type: { state: 'in', detail: 'Início do segundo tempo' },
    },
  };
  const a = parseMatches({ events: [halftime] })[0]!;
  const b = parseMatches({ events: [second] })[0]!;
  expect(a.clock).toBe('Intervalo');
  expect(b.clock).toBe('Início do segundo tempo');
  expect(a.id).toBe(b.id);
  expect(a.home.score).toBe(b.home.score);
  expect(
    parseCommentary({
      commentary: [
        { sequence: '101', text: 'Início do segundo tempo.', time: null },
      ],
    }),
  ).toEqual([{ sequence: 101, clock: '', text: 'Início do segundo tempo.' }]);
  expect(parseCommentary({ commentary: null })).toEqual([]);
});
it('isola partida incompleta sem paralisar outra partida da competição', () => {
  const partial = event('101');
  partial.competitions[0]!.competitors[0]!.score = '';
  expect(parseMatches({ events: [event(), partial] }).map((m) => m.id)).toEqual(
    ['100'],
  );
  expect(() => parseMatches({ events: [partial] })).toThrow('incompletas');
  expect(parseMatches({ events: [event('101')] })[0]!.home.score).toBe(1);
});
it('aceita placar numérico sem transformar null ou vazio em zero', () => {
  const numeric = event();
  const raw = JSON.parse(JSON.stringify(numeric));
  raw.competitions[0].competitors[0].score = 1;
  expect(parseMatches({ events: [raw] })[0]!.home.score).toBe(1);
  raw.competitions[0].competitors[0].score = null;
  expect(() => parseMatches({ events: [raw] })).toThrow();
});
it('mantém a descrição dentro do limite do Discord após escapar os lances', () => {
  const match = parseMatches({ events: [event()] })[0]!;
  const lines = Array.from({ length: 5 }, (_, sequence) => ({
    sequence,
    clock: '45',
    text: '*'.repeat(500),
  }));
  expect(narrationText(match, lines).length).toBeLessThanOrEqual(4096);
});
