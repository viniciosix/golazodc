import { describe, expect, it } from 'vitest';
import { ComponentType } from 'discord.js';
import fixture from './fixtures/sudamericana-sao-paulo.json' with { type: 'json' };
import {
  compactEvent,
  formatCommentary,
  EVENT_EMOJIS,
  resolveEventEmojis,
} from '../src/modules/football/event-format.js';
import {
  parseMatches,
  competitionInfo,
} from '../src/modules/football/provider.js';
import { parseCommentary } from '../src/modules/football/commentary.js';
import {
  narrationPanel,
  narrationText,
} from '../src/modules/football/narration.js';
import type { Client, Guild } from 'discord.js';
describe('Lances curtos e logo da competição', () => {
  it.each([
    [
      'Gol! LDU Quito 1, São Paulo 0. Jhojan Julio (LDU Quito) finalização com o pé direito.',
      'goal',
      'Jhojan Julio (LDU Quito)',
    ],
    ['Escanteio, São Paulo. Cedido por X.', 'corner', 'Para São Paulo'],
    [
      'Falta cometida por Gabriel Neves (São Paulo).',
      'foul',
      'Cometida por Gabriel Neves (São Paulo)',
    ],
    [
      'Paolo Guerrero (LDU Quito) sofre uma falta no campo adversário.',
      'foul',
      'Paolo Guerrero (LDU Quito) sofreu a infração',
    ],
    [
      'Rafinha (São Paulo) recebe cartão amarelo por uma entrada perigosa.',
      'yellow',
      'Rafinha (São Paulo)',
    ],
    ['X (Time) recebe segundo cartão amarelo.', 'red', 'X (Time)'],
    [
      'Substituição LDU Quito, entra em campo Alexander Alvarado substituindo Mauricio Martínez.',
      'substitution',
      'LDU Quito · entra Alexander Alvarado · sai Mauricio Martínez',
    ],
    [
      'Substituição São Paulo, entra em campo Alan Franco substituindo Beraldo uma lesão.',
      'substitution',
      'São Paulo · entra Alan Franco · sai Beraldo',
    ],
    [
      'Substitution, Team. Player A replaces Player B.',
      'substitution',
      'Team · entra Player A · sai Player B',
    ],
    [
      'Goal! Team 1, Other 0. Player (Team) right footed shot.',
      'goal',
      'Player (Team)',
    ],
  ])('resume %s', (text, kind, detail) => {
    expect(compactEvent(text)).toMatchObject({ kind, detail });
  });
  it('não confunde gol anulado, tiro de meta ou nome Alvarado com gol ou VAR', () => {
    expect(compactEvent('Gol anulado pelo VAR.').kind).toBe('var');
    expect(compactEvent('Tiro de meta para o São Paulo.').kind).not.toBe(
      'goal',
    );
    expect(compactEvent('Goal kick for Team.').kind).not.toBe('goal');
    expect(compactEvent('Falta cometida por Alvarado.').kind).toBe('foul');
  });
  it('mantém emoji fora do escape Markdown, limita texto e permite fallback', () => {
    const custom = {
      ...EVENT_EMOJIS,
      corner: '<:escanteio:1549263062807089233>',
    };
    expect(
      formatCommentary(
        { sequence: 1, clock: "37'", text: 'Escanteio, São Paulo.' },
        custom,
      ),
    ).toContain(
      '<:escanteio:1549263062807089233> **Escanteio** Para São Paulo',
    );
    expect(
      formatCommentary({ sequence: 1, clock: '', text: '*'.repeat(5000) })
        .length,
    ).toBeLessThan(350);
    expect(resolveEventEmojis({} as Client)).toEqual(EVENT_EMOJIS);
    const emoji = {
      available: true,
      roles: { cache: new Map() },
      toString: () => custom.corner,
    };
    const guild = {
      emojis: { cache: new Map([['1549263062807089233', emoji]]) },
    } as unknown as Guild;
    expect(resolveEventEmojis({} as Client, guild).corner).toBe(custom.corner);
  });
  it('extrai logo real da Sul-Americana e a inclui como thumbnail com o placar nos botões', () => {
    const match = parseMatches(fixture, 'conmebol.sudamericana')[0]!;
    expect([match.home.id, match.away.id]).toContain('2026');
    expect(match.competition).toEqual({
      name: 'Sul-Americana',
      logo: 'https://a.espncdn.com/i/leaguelogos/soccer/500/1208.png',
    });
    const panel = narrationPanel(match, parseCommentary(fixture)).toJSON();
    const section = panel.components.find(
      (c) => c.type === ComponentType.Section,
    );
    expect(section?.accessory).toMatchObject({
      type: ComponentType.Thumbnail,
      media: { url: match.competition!.logo },
    });
    expect(
      panel.components.some((c) => c.type === ComponentType.ActionRow),
    ).toBe(true);
  });
  it('deduplica as duas descrições da mesma falta sem eliminar escanteios distintos', () => {
    const match = parseMatches(fixture)[0]!;
    const lines = parseCommentary(fixture);
    const foul = lines.filter((l) => l.sequence === 2 || l.sequence === 3);
    expect(narrationText(match, foul)).toContain('Paolo Guerrero');
    expect(narrationText(match, foul)).not.toContain('Gabriel Neves');
    expect(narrationText(match, foul, 3)).not.toContain('Paolo Guerrero');
    expect(
      (
        narrationText(
          match,
          lines.filter((l) => l.sequence === 6 || l.sequence === 8),
        ).match(/Escanteio/g) || []
      ).length,
    ).toBe(2);
  });
  it('metadados ausentes ou logo inválida não interrompem a partida', () => {
    expect(
      competitionInfo({
        leagues: [{ name: 'Teste', logos: [{ href: 'javascript:alert(1)' }] }],
      }),
    ).toEqual({ name: 'Teste' });
    const match = parseMatches(
      { events: fixture.events },
      'conmebol.sudamericana',
    )[0]!;
    expect(match.competition).toEqual({ name: 'Sul-Americana' });
    expect(() => narrationPanel(match, []).toJSON()).not.toThrow();
  });
});
