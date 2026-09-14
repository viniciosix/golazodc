import { describe, expect, it } from 'vitest';
import { ComponentType, ButtonStyle, MessageFlags } from 'discord.js';
import {
  narrationPanel,
  narrationPayload,
  pausedNarrationPanel,
} from '../src/modules/football/narration.js';
import { TRICORD_RED } from '../src/core/brand.js';
const match = {
  id: '1',
  date: '',
  state: 'in' as const,
  clock: "46'",
  home: { id: 'a', name: 'São Paulo', score: 2 },
  away: { id: 'b', name: 'River Plate', score: 1 },
};
describe('Placar dentro do painel', () => {
  it('inclui placar e times em botões cinzas sem ação', () => {
    const data = narrationPanel(match, []).toJSON();
    expect(data.type).toBe(ComponentType.Container);
    expect(data.accent_color).toBe(TRICORD_RED);
    const row = data.components.find((c) => c.type === ComponentType.ActionRow);
    expect(
      row?.components.map((b) =>
        b.type === ComponentType.Button && 'label' in b
          ? [b.label, b.style, b.disabled]
          : null,
      ),
    ).toEqual([
      ['São Paulo', ButtonStyle.Secondary, true],
      ['2 × 1', ButtonStyle.Secondary, true],
      ['River Plate', ButtonStyle.Secondary, true],
    ]);
  });
  it('atualiza o placar, mantém a narração e limpa lances após gol', () => {
    const next = narrationPanel(
      { ...match, home: { ...match.home, score: 3 } },
      [
        { sequence: 1, clock: '', text: 'Lance anterior' },
        { sequence: 2, clock: '', text: 'Lance novo' },
      ],
      1,
    ).toJSON();
    const text = JSON.stringify(next);
    expect(text).toContain('3 × 1');
    expect(text).toContain('Lance novo');
    expect(text).not.toContain('Lance anterior');
    expect(
      JSON.stringify(narrationPanel({ ...match, state: 'post' }, []).toJSON()),
    ).toContain('ENCERRADA');
  });
  it('usa componentes V2 também ao pausar e limita nomes longos', () => {
    const payload = narrationPayload(pausedNarrationPanel());
    expect(payload.flags).toBe(MessageFlags.IsComponentsV2);
    expect(payload).not.toHaveProperty('embeds');
    expect(JSON.stringify(payload.components[0]?.toJSON())).toContain(
      'pausada',
    );
    expect(() =>
      narrationPanel(
        { ...match, home: { ...match.home, name: 'A'.repeat(500) } },
        [],
      ).toJSON(),
    ).not.toThrow();
  });
});
