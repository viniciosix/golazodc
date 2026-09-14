import { expect, it } from 'vitest';
import { parseCommentary } from '../src/modules/football/commentary.js';
import { narrationText } from '../src/modules/football/narration.js';
it('ordena, remove duplicatas e ignora eventos inválidos', () => {
  expect(
    parseCommentary({
      commentary: [
        { sequence: 2, text: 'Falta', time: { displayValue: "2'" } },
        { sequence: 1, text: 'Começou' },
        { sequence: 2, text: 'Falta corrigida' },
        { text: 'Inválido' },
      ],
    }),
  ).toEqual([
    { sequence: 1, clock: '', text: 'Começou' },
    { sequence: 2, clock: '', text: 'Falta corrigida' },
  ]);
  expect(parseCommentary({})).toEqual([]);
});
it('narração limita lances e respeita o reinício após gol', () => {
  const match = {
    id: '1',
    date: '',
    state: 'in' as const,
    clock: "20'",
    home: { id: '1', name: 'A', score: 1 },
    away: { id: '2', name: 'B', score: 0 },
  };
  const lines = Array.from({ length: 10 }, (_, sequence) => ({
    sequence,
    clock: '',
    text: `Lance ${sequence}`,
  }));
  const text = narrationText(match, lines, 8);
  expect(text).toContain('Lance 9');
  expect(text).not.toContain('Lance 8');
  expect(narrationText(match, [], -1, true)).toContain('indisponível');
  expect(narrationText({ ...match, state: 'post' }, [])).toContain('ENCERRADA');
});
