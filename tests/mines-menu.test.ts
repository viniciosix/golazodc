import { beforeEach, expect, it, vi } from 'vitest';
import type {
  ButtonInteraction,
  StringSelectMenuInteraction,
} from 'discord.js';
import type { Context } from '../src/core/types.js';
import {
  menuId,
  menuView,
  newMenu,
  parseMenu,
} from '../src/modules/mines/menu.js';
vi.mock('../src/modules/mines/service.js', () => ({
  startMines: vi.fn(),
  getGame: vi.fn(),
  resumeMines: vi.fn(),
}));
import { startMines, getGame } from '../src/modules/mines/service.js';
import { handleMinesMenu } from '../src/modules/mines/menu-handler.js';
import command from '../src/handlers/commands/mines.js';
const game = {
  id: 'game',
  userId: 'internal',
  ownerId: '123',
  activeOwner: '123',
  guildId: 'guild',
  bet: 5n,
  bombs: [0, 1, 2],
  revealed: [],
  status: 'ACTIVE',
  prize: 0n,
  revision: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};
function setup(action: string, selectValue?: string) {
  const menu = newMenu('123', 5, 3);
  const context = {
    db: {
      user: { findUnique: vi.fn().mockResolvedValue({ coins: 10n }) },
      economyOperation: { findUnique: vi.fn().mockResolvedValue(null) },
    },
  } as unknown as Context;
  const interaction = {
    guildId: 'guild',
    user: { id: '123', username: 'Test' },
    message: { id: menu.token },
    customId: menuId(menu, action),
    deferred: false,
    values: selectValue ? [selectValue] : [],
    isStringSelectMenu: () => selectValue !== undefined,
    deferUpdate: vi.fn(async () => {
      interaction.deferred = true;
    }),
    editReply: vi.fn(),
    followUp: vi.fn(),
  };
  return {
    menu,
    context,
    interaction,
    cast: interaction as unknown as
      ButtonInteraction | StringSelectMenuInteraction,
  };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(startMines).mockResolvedValue(game);
  vi.mocked(getGame).mockResolvedValue(game);
});
it('opens /mines without arguments and provides menus, preview and gray controls', async () => {
  const { context, menu } = setup('plus');
  expect(command.data.toJSON().options).toEqual([]);
  const payload = await menuView(context.db, menu);
  const rows = payload.components.map((r) => r.toJSON());
  expect(rows).toHaveLength(4);
  const bet = rows[0]!.components[0]!;
  expect(bet.type).toBe(3);
  if (bet.type === 3) {
    expect(bet.options).toHaveLength(25);
    expect(bet.options.find((o) => o.default)?.value).toBe('5');
  }
  expect(JSON.stringify(payload)).toContain('Primeiro acerto');
  expect(
    rows
      .slice(2)
      .every((r) => r.components.every((b) => b.type === 2 && b.style === 2)),
  ).toBe(true);
  expect(startMines).not.toHaveBeenCalled();
});
it('changes configuration and updates the same message without charging', async () => {
  for (const [action, value, expected] of [
    ['bet', '12', 'Aposta:** 12'],
    ['bombs', '7', 'Bombas:** 7'],
    ['double', undefined, 'Aposta:** 10'],
    ['half', undefined, 'Aposta:** 2'],
  ] as const) {
    const { cast, context, interaction } = setup(action, value);
    await handleMinesMenu(cast, context);
    expect(interaction.editReply).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(interaction.editReply.mock.calls[0])).toContain(
      expected,
    );
  }
  expect(startMines).not.toHaveBeenCalled();
});
it('starts only on Jogar with a stable payment key and recovers a repeated click', async () => {
  const { cast, context, interaction, menu } = setup('start');
  await handleMinesMenu(cast, context);
  expect(startMines).toHaveBeenCalledWith(
    context.db,
    interaction.user,
    `mines-start:${menu.token}`,
    5,
    3,
    'guild',
  );
  vi.mocked(context.db.economyOperation.findUnique).mockResolvedValue({
    actorId: '123',
    result: { gameId: 'game' },
  } as never);
  await handleMinesMenu(cast, context);
  expect(startMines).toHaveBeenCalledTimes(1);
  expect(getGame).toHaveBeenCalledWith(context.db, '123', 'game', 'guild');
});
it('restricts controls to the owner and rejects invalid choices', async () => {
  const { menu, context, cast, interaction } = setup('bet', '999');
  expect(() => parseMenu(menuId(menu, 'start'), 'other')).toThrow('próprio');
  await handleMinesMenu(cast, context);
  expect(interaction.followUp).toHaveBeenCalled();
  expect(startMines).not.toHaveBeenCalled();
});
it('disables unaffordable bets and opens a new round without charging', async () => {
  const { context, menu, cast, interaction } = setup('new');
  const payload = await menuView(context.db, { ...menu, bet: 25 });
  expect(payload.components[3]!.toJSON().components[0]!.disabled).toBe(true);
  await handleMinesMenu(cast, context);
  const data = JSON.stringify(interaction.editReply.mock.calls[0]);
  expect(data).not.toContain(menu.token);
  expect(startMines).not.toHaveBeenCalled();
});
