import { expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { Context } from '../src/core/types.js';
vi.mock('../src/modules/football/provider.js', async (importOriginal) => ({
  ...(await importOriginal<
    typeof import('../src/modules/football/provider.js')
  >()),
  fetchMatches: vi.fn().mockResolvedValue([]),
  fetchTeams: vi
    .fn()
    .mockRejectedValue(new Error('Catálogo temporariamente indisponível')),
}));
vi.mock('../src/modules/football/goals.js', () => ({
  enableGoals: vi.fn().mockResolvedValue({}),
}));
import command from '../src/handlers/commands/gols.js';
import { enableGoals } from '../src/modules/football/goals.js';
import { fetchMatches, fetchTeams } from '../src/modules/football/provider.js';
it('liga São Paulo na Sul-Americana sem depender do catálogo de times', async () => {
  const reply = vi.fn();
  const db = {} as Context['db'];
  const interaction = {
    guildId: 'guild',
    channelId: 'channel',
    memberPermissions: { has: () => true },
    appPermissions: { has: () => true },
    channel: { isTextBased: () => true, isThread: () => false, send: vi.fn() },
    deferReply: vi.fn(),
    editReply: reply,
    options: {
      getSubcommand: () => 'ligar',
      getString: (name: string) =>
        name === 'competicao' ? 'conmebol.sudamericana' : null,
    },
  } as unknown as ChatInputCommandInteraction;
  await command.execute(interaction, { db } as Context);
  expect(fetchMatches).toHaveBeenCalledWith('conmebol.sudamericana');
  expect(fetchTeams).not.toHaveBeenCalled();
  expect(enableGoals).toHaveBeenCalledWith(
    db,
    expect.objectContaining({
      league: 'conmebol.sudamericana',
      teamId: '2026',
      teamName: 'São Paulo',
    }),
    [],
  );
  expect(reply).toHaveBeenCalledWith(expect.stringContaining('Sul-Americana'));
  expect(JSON.stringify(command.data.toJSON())).toContain(
    'conmebol.sudamericana',
  );
});
