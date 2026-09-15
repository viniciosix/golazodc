import { describe, expect, it } from 'vitest';
import { ButtonStyle, MessageFlags } from 'discord.js';
import {
  newSimulation,
  simulationAction,
  simulationView,
  registerSimulation,
  updateSimulation,
} from '../src/modules/football/simulator.js';

describe('manual narration simulator', () => {
  it('updates scores and concise events without changing the original state', () => {
    const original = newSimulation('owner', 'guild');
    let state = simulationAction(original, 'goal');
    state = simulationAction(state, 'away');
    expect(original.match.home.score).toBe(0);
    expect(state.match.home.score).toBe(1);
    expect(state.match.away.score).toBe(1);
    expect(JSON.stringify(simulationView(state))).toContain('Calleri');
    for (const action of [
      'foul',
      'corner',
      'yellow',
      'red',
      'substitution',
    ] as const)
      state = simulationAction(state, action);
    expect(state.lines).toHaveLength(5);
    const json = JSON.stringify(simulationView(state));
    for (const text of ['Falta', 'Escanteio', '🟨', '🟥', 'Luciano'])
      expect(json).toContain(text);
  });
  it('renders a clearly labeled red V2 panel with only gray buttons and a competition thumbnail', () => {
    const payload = simulationView(newSimulation('owner', 'guild'));
    expect(payload.flags).toBe(MessageFlags.IsComponentsV2);
    const panel = payload.components[0]!.toJSON();
    expect(panel.accent_color).toBe(0xf5320c);
    const json = JSON.stringify(panel);
    expect(json).toContain('TESTE SIMULADO');
    expect(json).toContain('Clique nos botões');
    expect(json).toContain('leaguelogos');
    expect(json).not.toContain('NARRAÇÃO AO VIVO');
    const buttons = panel.components
      .filter((c) => c.type === 1)
      .flatMap((c) => c.components);
    expect(buttons).toHaveLength(15);
    expect(
      buttons.every((b) => b.type === 2 && b.style === ButtonStyle.Secondary),
    ).toBe(true);
  });
  it('handles halftime, second half, ending and reset', () => {
    let state = simulationAction(newSimulation('owner', 'guild'), 'halftime');
    expect(state.match.clock).toBe('Intervalo');
    state = simulationAction(state, 'second');
    expect(state.match.clock).toBe("46'");
    state = simulationAction(state, 'minute');
    expect(state.match.clock).toBe("51'");
    state = simulationAction(state, 'end');
    expect(state.match.state).toBe('post');
    expect(() => simulationAction(state, 'goal')).toThrow('terminou');
    const rows = simulationView(state)
      .components[0]!.toJSON()
      .components.filter((c) => c.type === 1);
    const controls = rows.slice(1).flatMap((c) => c.components);
    expect(controls.filter((b) => !b.disabled)).toHaveLength(1);
    const reset = simulationAction(state, 'reset');
    expect(reset.match.state).toBe('in');
    expect(reset.lines).toHaveLength(0);
    expect(reset.expires).toBe(state.expires);
  });
  it('rejects other users, other guilds, missing and expired sessions', async () => {
    registerSimulation('security', newSimulation('owner', 'guild'));
    const render = async () => {};
    await expect(
      updateSimulation('security', 'other', 'guild', 'goal', render),
    ).rejects.toThrow('Somente');
    await expect(
      updateSimulation('security', 'owner', 'other', 'goal', render),
    ).rejects.toThrow('Somente');
    await expect(
      updateSimulation('missing', 'owner', 'guild', 'goal', render),
    ).rejects.toThrow('expirado');
    registerSimulation('expired', {
      ...newSimulation('owner', 'guild'),
      expires: 0,
    });
    await expect(
      updateSimulation('expired', 'owner', 'guild', 'goal', render),
    ).rejects.toThrow('expirado');
  });
  it('blocks concurrent clicks and rolls back failed Discord edits', async () => {
    registerSimulation('concurrent', newSimulation('owner', 'guild'));
    let finish!: () => void;
    const pending = updateSimulation(
      'concurrent',
      'owner',
      'guild',
      'goal',
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    await expect(
      updateSimulation('concurrent', 'owner', 'guild', 'goal', async () => {}),
    ).rejects.toThrow('Aguarde');
    finish();
    await pending;
    await expect(
      updateSimulation('concurrent', 'owner', 'guild', 'goal', async () => {
        throw new Error('Discord unavailable');
      }),
    ).rejects.toThrow('Discord unavailable');
    await updateSimulation(
      'concurrent',
      'owner',
      'guild',
      'goal',
      async (state) => {
        expect(state.match.home.score).toBe(2);
      },
    );
  });
});
