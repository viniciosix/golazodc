import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  GuildTextBasedChannel,
  Message,
  ChatInputCommandInteraction,
} from 'discord.js';
import type { Context } from '../src/core/types.js';
import {
  cancelBanter,
  sendBanter,
  reactToNotice,
  GOAL_PHRASES,
  CONCEDED_PHRASES,
  replyCandidates,
} from '../src/modules/football/banter.js';
import command from '../src/handlers/commands/resenha.js';

function fixture() {
  const person = {
    id: 'message',
    author: { id: 'person', bot: false },
    createdTimestamp: Date.now(),
    system: false,
    webhookId: null,
  } as Message;
  const send = vi.fn().mockResolvedValue({ id: 'sent' });
  const fetch = vi.fn().mockResolvedValue(new Map([[person.id, person]]));
  const channel = {
    id: 'chat',
    send,
    messages: { fetch },
  } as unknown as GuildTextBasedChannel;
  return { person, channel, send, fetch };
}
afterEach(() => {
  cancelBanter();
  vi.useRealTimers();
});
describe('resenha', () => {
  it('sends a celebration then replies once at 5s, mentioning only the selected person', async () => {
    vi.useFakeTimers();
    const { channel, send, fetch } = fixture();
    await sendBanter(channel, 'goal', 'timing');
    expect(GOAL_PHRASES).toContain(send.mock.calls[0]![0].content);
    await vi.advanceTimersByTimeAsync(4999);
    expect(send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledWith({ limit: 50 });
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]![0]).toMatchObject({
      reply: { messageReference: 'message', failIfNotExists: true },
      allowedMentions: { parse: [], users: ['person'], repliedUser: true },
    });
    await sendBanter(channel, 'goal', 'timing');
    await vi.advanceTimersByTimeAsync(10000);
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('never targets people after conceded goals', async () => {
    vi.useFakeTimers();
    const { channel, send, fetch } = fixture();
    await sendBanter(channel, 'conceded', 'conceded');
    expect(CONCEDED_PHRASES).toContain(send.mock.calls[0]![0].content);
    await vi.advanceTimersByTimeAsync(10000);
    expect(send).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('excludes bots, webhooks, system and old messages; skips empty chat', async () => {
    vi.useFakeTimers();
    const { person, channel, send, fetch } = fixture();
    const messages = [
      person,
      { ...person, author: { ...person.author, bot: true } },
      { ...person, system: true },
      { ...person, webhookId: 'hook' },
      { ...person, createdTimestamp: Date.now() - 900001 },
    ] as Message[];
    expect(replyCandidates(messages)).toEqual([person]);
    fetch.mockResolvedValue(new Map());
    await sendBanter(channel, 'goal', 'empty');
    await vi.advanceTimersByTimeAsync(5000);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('cancels pending replies and rechecks live settings', async () => {
    vi.useFakeTimers();
    const { channel, send } = fixture();
    await sendBanter(channel, 'goal', 'cancel');
    cancelBanter('chat');
    await vi.advanceTimersByTimeAsync(5000);
    expect(send).toHaveBeenCalledTimes(1);
    await sendBanter(channel, 'goal', 'disabled', {
      stillEnabled: async () => false,
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('ignores corrections, legacy notices, other teams and disabled channels', async () => {
    const { channel, send } = fixture();
    const setting = vi.fn().mockResolvedValue(null);
    const context = {
      db: { goalBanter: { findUnique: setting } },
    } as unknown as Context;
    for (const kind of ['correction', 'legacy'])
      await reactToNotice(
        context,
        channel,
        { id: kind, kind, subscriptionId: 'sub', revision: 'rev' },
        '2026',
      );
    await reactToNotice(
      context,
      channel,
      { id: 'other', kind: 'goal', subscriptionId: 'sub', revision: 'rev' },
      'otherteam',
    );
    expect(setting).not.toHaveBeenCalled();
    await reactToNotice(
      context,
      channel,
      { id: 'off', kind: 'goal', subscriptionId: 'sub', revision: 'rev' },
      '2026',
    );
    expect(send).not.toHaveBeenCalled();
  });
  it('runs an explicitly labeled manual test without database or match API', async () => {
    vi.useFakeTimers();
    const { channel, send } = fixture();
    Object.assign(channel, {
      isDMBased: () => false,
      isTextBased: () => true,
      isThread: () => false,
    });
    const interaction = {
      id: 'manual',
      guildId: 'guild',
      channelId: 'chat',
      channel,
      memberPermissions: { has: () => true },
      appPermissions: { has: () => true },
      deferReply: vi.fn(),
      editReply: vi.fn(),
      options: { getSubcommand: () => 'teste', getString: () => 'goal' },
    } as unknown as ChatInputCommandInteraction;
    const db = new Proxy(
      {},
      {
        get: () => {
          throw new Error('Test must not use DB');
        },
      },
    );
    await command.execute(interaction, { db } as Context);
    expect(send.mock.calls[0]![0].content).toMatch(/^\[TESTE\]/);
    await vi.advanceTimersByTimeAsync(5000);
    expect(send.mock.calls[1]![0].content).toMatch(/^\[TESTE\]/);
    Object.assign(interaction, { memberPermissions: { has: () => false } });
    await expect(
      command.execute(interaction, { db } as Context),
    ).rejects.toThrow('Gerenciar servidor');
  });
});
