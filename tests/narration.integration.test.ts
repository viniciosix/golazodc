import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { MessageFlags } from 'discord.js';
import { PrismaClient } from '@prisma/client';
import type { Context } from '../src/core/types.js';
import type { Match } from '../src/modules/football/provider.js';
import { enableGoals } from '../src/modules/football/goals.js';
import { syncNarration } from '../src/modules/football/narration.js';
import { pollGoals } from '../src/modules/football/worker.js';
const db = new PrismaClient({ datasourceUrl: process.env.TEST_DATABASE_URL });
const channelId = randomUUID();
const match: Match = {
  id: '12345',
  date: new Date().toISOString(),
  state: 'in',
  clock: "10'",
  home: { id: '2026', name: 'São Paulo', score: 0 },
  away: { id: '1', name: 'Outro', score: 0 },
};
describe.skipIf(!process.env.TEST_DATABASE_URL)('Narração persistente', () => {
  afterAll(async () => {
    await db.goalSubscription.deleteMany({ where: { channelId } });
    await db.$disconnect();
  });
  it('edita a mesma mensagem e no gol envia, apaga e recria nessa ordem', async () => {
    const sub = await enableGoals(
      db,
      {
        channelId,
        guildId: 'test',
        league: 'bra.1',
        teamId: '2026',
        teamName: 'São Paulo',
      },
      [match],
    );
    const actions: string[] = [];
    let serial = 0;
    const send = vi.fn(async () => {
      actions.push('send');
      return { id: `msg-${++serial}` };
    });
    const edit = vi.fn(async () => {
      actions.push('edit');
    });
    const remove = vi.fn(async () => {
      actions.push('delete');
    });
    const fetch = vi.fn(async () => ({ delete: remove }));
    const context = {
      db,
      client: {
        channels: {
          fetch: vi.fn(async () => ({
            isTextBased: () => true,
            send,
            messages: { edit, fetch },
          })),
        },
      },
    } as unknown as Context;
    const lines = [
      { sequence: 1, clock: "10'", text: 'Escanteio para São Paulo.' },
    ];
    await syncNarration(context, sub, match, lines);
    await syncNarration(context, sub, match, lines);
    expect(actions).toEqual(['send']);
    await syncNarration(context, sub, { ...match, clock: "11'" }, lines);
    expect(actions).toEqual(['send', 'edit']);
    expect(edit).toHaveBeenLastCalledWith(
      'msg-1',
      expect.objectContaining({
        flags: MessageFlags.IsComponentsV2,
        content: null,
        embeds: [],
        attachments: [],
      }),
    );
    expect(
      (
        await db.matchNarration.findUnique({
          where: { subscriptionId: sub.id },
        })
      )?.messageId,
    ).toBe('msg-1');
    actions.length = 0;
    const goal = { ...match, home: { ...match.home, score: 1 } };
    await pollGoals(
      context,
      async () => [goal],
      async () => lines,
    );
    expect(actions).toEqual(['send', 'delete', 'send']);
    expect(fetch).toHaveBeenCalledWith('msg-1');
    expect(
      (
        await db.matchNarration.findUnique({
          where: { subscriptionId: sub.id },
        })
      )?.messageId,
    ).toBe('msg-3');
    actions.length = 0;
    await pollGoals(
      context,
      async () => [goal],
      async () => lines,
    );
    expect(actions).toEqual([]);
    await syncNarration(context, sub, goal, [
      ...lines,
      { sequence: 2, clock: "12'", text: 'Falta no meio-campo.' },
    ]);
    expect(actions).toEqual(['edit']);
    edit.mockRejectedValueOnce({ code: 10008 });
    await syncNarration(context, sub, { ...goal, clock: "13'" }, lines);
    expect(actions.at(-1)).toBe('send');
    const count = send.mock.calls.length;
    edit.mockRejectedValueOnce({ code: 50013 });
    await expect(
      syncNarration(context, sub, { ...goal, clock: "14'" }, lines),
    ).rejects.toMatchObject({ code: 50013 });
    expect(send).toHaveBeenCalledTimes(count);
  });
  it('mantém a mensagem ao entrar no segundo tempo e recupera edição transitória', async () => {
    await db.matchNarration.deleteMany({
      where: { subscription: { channelId } },
    });
    const sub = await enableGoals(
      db,
      {
        channelId,
        guildId: 'test',
        league: 'bra.1',
        teamId: '2026',
        teamName: 'São Paulo',
      },
      [match],
    );
    const send = vi.fn().mockResolvedValue({ id: 'halftime-message' });
    const edit = vi.fn().mockResolvedValue({});
    const context = {
      db,
      client: {
        channels: {
          fetch: vi.fn().mockResolvedValue({
            isTextBased: () => true,
            send,
            messages: { edit },
          }),
        },
      },
    } as unknown as Context;
    await syncNarration(context, sub, { ...match, clock: 'Intervalo' }, []);
    edit.mockRejectedValueOnce(new Error('Temporary network failure'));
    const second = { ...match, clock: 'Início do segundo tempo' };
    await expect(syncNarration(context, sub, second, [])).rejects.toThrow(
      'Temporary network failure',
    );
    await syncNarration(context, sub, second, [
      { sequence: 100, clock: "46'", text: 'Início do segundo tempo.' },
    ]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(edit).toHaveBeenLastCalledWith(
      'halftime-message',
      expect.anything(),
    );
    expect(
      (
        await db.matchNarration.findUnique({
          where: { subscriptionId: sub.id },
        })
      )?.messageId,
    ).toBe('halftime-message');
    expect(
      await db.goalNotice.count({
        where: { subscriptionId: sub.id, sentAt: null },
      }),
    ).toBe(0);
  });
});
