import { expect, it } from 'vitest';
import { parseCommentary } from '../src/modules/football/commentary.js';
import { narrationEmbed } from '../src/modules/football/narration.js';
import { TRICORD_RED } from '../src/core/brand.js';
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
it('embed vermelho limita lances e respeita o reinício após gol', () => {
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
  const embed = narrationEmbed(match, lines, 8).toJSON();
  expect(embed.color).toBe(TRICORD_RED);
  expect(embed.description).toContain('Lance 9');
  expect(embed.description).not.toContain('Lance 8');
  expect(narrationEmbed(match, [], -1, true).toJSON().description).toContain(
    'indisponível',
  );
  expect(
    narrationEmbed({ ...match, state: 'post' }, []).toJSON().description,
  ).toContain('ENCERRADA');
});
