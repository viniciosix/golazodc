import { expect, it, vi } from 'vitest';
import type { Interaction } from 'discord.js';
import type { Context } from '../src/core/types.js';
import type { Handlers } from '../src/core/loader.js';
import { route } from '../src/core/router.js';
const context = {} as Context;
const handlers = (): Handlers => ({
  commands: new Map(),
  buttons: new Map(),
  selects: new Map(),
  modals: new Map(),
  events: [],
});
function interaction(kind: string, extra = {}) {
  return {
    id: 'test',
    customId: 'test:123',
    commandName: 'test',
    isChatInputCommand: () => kind === 'command',
    isAutocomplete: () => kind === 'autocomplete',
    isButton: () => kind === 'button',
    isAnySelectMenu: () => kind === 'select',
    isModalSubmit: () => kind === 'modal',
    isRepliable: () => kind !== 'autocomplete',
    deferred: false,
    replied: false,
    responded: false,
    reply: vi.fn(),
    respond: vi.fn(),
    ...extra,
  } as unknown as Interaction;
}
it.each(['command', 'button', 'select', 'modal'])('roteia %s', async (kind) => {
  const h = handlers();
  const execute = vi.fn();
  if (kind === 'command')
    h.commands.set('test', {
      data: { toJSON: () => ({ name: 'test', description: 'Test', type: 1 }) },
      execute,
    });
  if (kind === 'button') h.buttons.set('test', { id: 'test', execute });
  if (kind === 'select') h.selects.set('test', { id: 'test', execute });
  if (kind === 'modal') h.modals.set('test', { id: 'test', execute });
  await route(interaction(kind), context, h);
  expect(execute).toHaveBeenCalledOnce();
});
it('responde autocomplete sem handler', async () => {
  const respond = vi.fn();
  await route(interaction('autocomplete', { respond }), context, handlers());
  expect(respond).toHaveBeenCalledWith([]);
});
it('centraliza erros e responde sem vazar mensagens internas', async () => {
  const h = handlers();
  const reply = vi.fn();
  h.buttons.set('test', {
    id: 'test',
    execute: async () => {
      throw new Error('database password');
    },
  });
  await route(interaction('button', { reply }), context, h);
  expect(reply).toHaveBeenCalledOnce();
  expect(JSON.stringify(reply.mock.calls)).not.toContain('database password');
});
it('edita resposta adiada quando falha', async () => {
  const editReply = vi.fn();
  await route(
    interaction('button', { deferred: true, editReply }),
    context,
    handlers(),
  );
  expect(editReply).toHaveBeenCalledOnce();
});
